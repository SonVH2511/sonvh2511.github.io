from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MUSIC_DIR = ROOT / "assets" / "music"
OUTPUT_PATH = ROOT / "data" / "music-library.json"


def split_title_and_subtitle(stem: str) -> tuple[str, str]:
    parts = stem.rsplit(" - ", 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return stem.strip(), ""


def build_library() -> list[dict[str, str]]:
    tracks = []
    for path in sorted(MUSIC_DIR.glob("*.mp3"), key=lambda item: item.name.lower()):
        title, subtitle = split_title_and_subtitle(path.stem)
        tracks.append({
            "title": title,
            "subtitle": subtitle,
            "audioUrl": f"/assets/music/{path.name}"
        })
    return tracks


def main() -> None:
    OUTPUT_PATH.write_text(
        json.dumps({"tracks": build_library()}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
