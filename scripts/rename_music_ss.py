from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MUSIC_DIR = ROOT / "assets" / "music"
SOURCE_TEXT = "Stella Sora "
TARGET_TEXT = "SS "


def main() -> None:
    renamed = 0

    for path in sorted(MUSIC_DIR.glob("*.mp3"), key=lambda item: item.name.lower()):
        if SOURCE_TEXT not in path.name:
            continue

        target = path.with_name(path.name.replace(SOURCE_TEXT, TARGET_TEXT))
        if target.exists():
            raise FileExistsError(f"Refusing to overwrite existing file: {target}")

        path.rename(target)
        renamed += 1

    print(f"Done. Renamed {renamed} files.")


if __name__ == "__main__":
    main()
