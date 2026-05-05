from __future__ import annotations

import json
import os
import re
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "posts.json"
READING_WORDS_PER_MINUTE = 220


def is_rate_limited_response(status: int | None, headers: dict[str, str] | None, payload: str | None) -> bool:
    if status not in {403, 429}:
        return False

    normalized_headers = {str(key).lower(): str(value) for key, value in (headers or {}).items()}
    normalized_payload = (payload or "").lower()
    return (
        normalized_headers.get("x-ratelimit-remaining") == "0"
        or "rate limit" in normalized_payload
        or "secondary rate limit" in normalized_payload
    )


def describe_fetch_error(status: int | None, headers: dict[str, str] | None, payload: str | None) -> str:
    if is_rate_limited_response(status, headers, payload):
        return "GitHub API rate limit hit."
    if status in {401, 403}:
        return "GitHub access denied. Configure a token with repo read access."
    if status == 404:
        return "Content was not found at the configured GitHub path."
    if status:
        return f"GitHub returned HTTP {status}."
    return "Request failed before GitHub returned a response."


def fetch_with_retry(url: str, headers: dict[str, str] | None = None, retries: int = 3) -> tuple[int | None, str | None, dict[str, str]]:
    request_headers = headers or {}

    for attempt in range(retries):
        try:
            request = Request(url, headers=request_headers)
            with urlopen(request) as response:
                status = getattr(response, "status", 200)
                response_headers = dict(response.headers.items())
                return status, response.read().decode("utf-8", errors="replace"), response_headers
        except HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            response_headers = dict(exc.headers.items()) if exc.headers else {}
            if exc.code == 404:
                return exc.code, payload or None, response_headers
            if is_rate_limited_response(exc.code, response_headers, payload):
                wait_time = 2 * (attempt + 1)
                print(f"[!] HTTP {exc.code} on {url}, rate limited. Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            if exc.code in {401, 403}:
                return exc.code, payload or None, response_headers
            if attempt == retries - 1:
                raise
        except URLError:
            if attempt == retries - 1:
                raise
            time.sleep(attempt + 1)

    return None, None, {}


def get_latest_commit_date(owner: str, repo: str, ref: str, file_path: str, github_token: str | None) -> datetime | None:
    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?path={quote(file_path)}&sha={ref}&per_page=1"
    )
    headers = {"User-Agent": "Python"}
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    status, payload, _ = fetch_with_retry(api_url, headers=headers)
    if status != 200 or not payload:
        return None

    data = json.loads(payload)
    if not data:
        return None

    return datetime.fromisoformat(data[0]["commit"]["committer"]["date"].replace("Z", "+00:00"))


def fetch_github_content(owner: str, repo: str, ref: str, file_path: str, github_token: str | None) -> tuple[int | None, str | None, dict[str, str]]:
    if not github_token:
        return None, None, {}

    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/contents/{quote(file_path, safe='/')}"
        f"?ref={quote(ref)}"
    )
    headers = {
        "User-Agent": "Python",
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.raw"
    }

    status, payload, response_headers = fetch_with_retry(api_url, headers=headers)
    if status != 200 or not payload:
        return status, None, response_headers
    return status, payload, response_headers


def strip_markdown_for_reading_metrics(markdown: str) -> str:
    text = str(markdown or "")
    text = re.sub(r"^\ufeff", "", text)
    text = re.sub(r"^---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)", "", text, count=1)
    text = re.sub(r"<!--[\s\S]*?-->", " ", text)
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"~~~[\s\S]*?~~~", " ", text)
    text = re.sub(r"`[^`\n]+`", " ", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1 ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1 ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"^\s{0,3}(#{1,6})\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s{0,3}>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\|", "", text, flags=re.MULTILINE)
    text = text.replace("|", " ")
    text = re.sub(r"[*_~]", "", text)
    text = re.sub(r"\r?\n", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def count_words(text: str) -> int:
    normalized = strip_markdown_for_reading_metrics(text)
    if not normalized:
        return 0
    matches = re.findall(r"[\wÀ-ỹ][\wÀ-ỹ'’._-]*", normalized, flags=re.UNICODE)
    return len(matches)


def format_reading_time(word_count: int) -> str:
    minutes = max(1, (word_count + READING_WORDS_PER_MINUTE - 1) // READING_WORDS_PER_MINUTE)
    return f"{minutes} min"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update post metadata from GitHub markdown sources.")
    parser.add_argument("--token", help="GitHub token. Falls back to GITHUB_TOKEN env var when omitted.")
    return parser.parse_args()


def process_posts(github_token: str | None) -> None:
    print("Starting metadata update...")
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    posts = data.get("posts", {})

    for slug, post in posts.items():
        if post.get("external"):
            continue

        candidates = post.get("candidates", [])
        found_valid = False
        last_error = "No valid raw GitHub candidate produced metadata."

        for raw_url in candidates:
            if "raw.githubusercontent.com" not in raw_url:
                continue

            match = re.search(r"raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)", raw_url)
            if not match:
                last_error = f"Candidate URL is not in the expected raw GitHub format: {raw_url}"
                continue

            owner, repo, ref, raw_file_path = match.groups()
            file_path = unquote(raw_file_path)
            api_status, text, api_headers = fetch_github_content(owner, repo, ref, file_path, github_token)
            if text is None and api_status in {401, 403}:
                last_error = describe_fetch_error(api_status, api_headers, None)
            if text is None:
                status, text, response_headers = fetch_with_retry(raw_url)
                if status != 200:
                    last_error = describe_fetch_error(status, response_headers, text)
                    text = None

            if not text or not text.strip():
                continue

            words = count_words(text)
            post["wordCount"] = words
            post["readingTime"] = format_reading_time(words)

            commit_date = get_latest_commit_date(owner, repo, ref, file_path, github_token)
            if commit_date:
                date_string = commit_date.astimezone(timezone.utc).strftime("%Y-%m-%d")
                post["updatedAt"] = date_string
                if not post.get("publishedAt"):
                    post["publishedAt"] = date_string

            print(f"[+] Updated metadata for {slug}: {words} words, {post['readingTime']}, Last updated: {post.get('updatedAt')}")
            found_valid = True
            break

        if not found_valid:
            print(f"[-] Could not update metadata for {slug}: {last_error}")

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Finished updating posts.json")


if __name__ == "__main__":
    args = parse_args()
    process_posts(args.token or os.getenv("GITHUB_TOKEN"))
