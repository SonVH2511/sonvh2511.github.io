from __future__ import annotations

import json
import os
import re
import time
import argparse
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "posts.json"
READING_WORDS_PER_MINUTE = 220


def fetch_with_retry(url: str, headers: dict[str, str] | None = None, retries: int = 3) -> tuple[int | None, str | None]:
    request_headers = headers or {}

    for attempt in range(retries):
        try:
            request = Request(url, headers=request_headers)
            with urlopen(request) as response:
                status = getattr(response, "status", 200)
                return status, response.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            if exc.code == 404:
                return exc.code, None
            if exc.code == 403:
                wait_time = 2 * (attempt + 1)
                print(f"[!] HTTP 403 on {url}, rate limited. Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            if attempt == retries - 1:
                raise
        except URLError:
            if attempt == retries - 1:
                raise
            time.sleep(attempt + 1)

    return None, None


def get_latest_commit_date(owner: str, repo: str, ref: str, file_path: str, github_token: str | None) -> datetime | None:
    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/commits"
        f"?path={quote(file_path)}&sha={ref}&per_page=1"
    )
    headers = {"User-Agent": "Python"}
    if github_token:
        headers["Authorization"] = f"token {github_token}"

    status, payload = fetch_with_retry(api_url, headers=headers)
    if status != 200 or not payload:
        return None

    data = json.loads(payload)
    if not data:
        return None

    return datetime.fromisoformat(data[0]["commit"]["committer"]["date"].replace("Z", "+00:00"))


def fetch_github_content(owner: str, repo: str, ref: str, file_path: str, github_token: str | None) -> str | None:
    if not github_token:
        return None

    api_url = (
        f"https://api.github.com/repos/{owner}/{repo}/contents/{quote(file_path)}"
        f"?ref={quote(ref)}"
    )
    headers = {
        "User-Agent": "Python",
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.raw"
    }

    status, payload = fetch_with_retry(api_url, headers=headers)
    if status != 200 or not payload:
        return None
    return payload


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

        for raw_url in candidates:
            if "raw.githubusercontent.com" not in raw_url:
                continue

            match = re.search(r"raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)", raw_url)
            if not match:
                continue

            owner, repo, ref, file_path = match.groups()
            text = fetch_github_content(owner, repo, ref, file_path, github_token)
            if text is None:
                status, text = fetch_with_retry(raw_url)
                if status != 200:
                    text = None

            if not text or not text.strip():
                continue

            words = count_words(text)
            post["wordCount"] = words
            post["readingTime"] = format_reading_time(words)

            commit_date = get_latest_commit_date(owner, repo, ref, file_path, github_token)
            if commit_date:
                date_string = commit_date.strftime("%Y-%m-%d")
                post["updatedAt"] = date_string
                if not post.get("publishedAt"):
                    post["publishedAt"] = date_string

            print(f"[+] Updated metadata for {slug}: {words} words, {post['readingTime']}, Last updated: {post.get('updatedAt')}")
            found_valid = True
            break

        if not found_valid:
            print(f"[-] Could not fetch data or invalid format for {slug}")

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Finished updating posts.json")


if __name__ == "__main__":
    args = parse_args()
    process_posts(args.token or os.getenv("GITHUB_TOKEN"))
