# Github.io theme

Inspired by [Hexo theme Reimu](https://github.com/D-Sketon/hexo-theme-reimu)

Personal static blog / portfolio site for writeups, tools, malware notes, and GitHub-backed post content.

Live site: <https://sonvh2511.github.io>

## Overview

This repo is a static frontend that:

- renders the homepage from `data/posts.json`
- loads post content dynamically from external GitHub repositories via Markdown files
- groups entries into sections such as `writeup`, `tools`, `blog`, and `malware`
- builds a random homepage music playlist from local MP3 files in `assets/music`
- reads embedded MP3 cover art directly from ID3 metadata in the browser

There is no backend. Content and metadata are driven by JSON files plus a few maintenance scripts.

## Main Files

- `index.html`: homepage layout and inline styles
- `post/index.html`: post detail page shell
- `assets/homepage.js`: homepage rendering, section routing, random playlist, embedded cover extraction
- `assets/post-page.js`: post loader, Markdown rendering, TOC generation, private repo token flow
- `assets/post.css`: post page styles
- `data/posts.json`: site config, sections, and post metadata
- `data/music-library.json`: generated music manifest for the homepage playlist
- `scripts/generate_music_library.py`: scans `assets/music` and regenerates `data/music-library.json`
- `scripts/update_meta.py`: updates `wordCount`, `readingTime`, and `updatedAt` from GitHub Markdown sources
- `scripts/update_meta.js`: Node version of the same metadata updater

## Content Model

`data/posts.json` contains 3 main parts:

- `site`: global site settings such as owner name, hero text, profile info, default backgrounds, and `musicSampleSize`
- `sections`: homepage groups and the ordered list of post keys shown in each group
- `posts`: metadata for each card/post

Typical post fields:

- `slug`: stable identifier used by `/post/?slug=...`
- `title`, `summary`, `description`
- `tag`, `tags`
- `cover`, `background`
- `publishedAt`, `updatedAt`
- `wordCount`, `readingTime`
- `source`: source repository/page
- `candidates`: raw GitHub Markdown URLs to try when loading post content
- `external`: if true, homepage links directly to `route`
- `private`: used by the frontend to hide entries from normal public listing

## Music System

Homepage music is no longer a fixed list in `posts.json`.

Instead:

1. `scripts/generate_music_library.py` scans `assets/music/*.mp3`
2. it writes a manifest to `data/music-library.json`
3. homepage loads that manifest
4. on each page load, it shuffles the library, picks `site.musicSampleSize` tracks, and tries to autoplay the first one

Notes:

- autoplay still depends on browser policy
- cover art is extracted from the MP3 file itself when an `APIC` frame exists
- if no embedded art is found, the player falls back to `site.musicCover`

## Update Music Library

Whenever you add/remove MP3 files in `assets/music`, regenerate the manifest:

```powershell
python scripts/generate_music_library.py
```

## Update Post Metadata

Use this when you want to refresh:

- `wordCount`
- `readingTime`
- `updatedAt`

### Python

```powershell
python scripts/update_meta.py
```

With GitHub token:

```powershell
python scripts/update_meta.py --token YOUR_GITHUB_TOKEN
```

### Node

```powershell
node scripts/update_meta.js --token YOUR_GITHUB_TOKEN
```

### Why a token may be needed

A token is needed when post content lives in a private repository.

The updater scripts now:

- first try GitHub Contents API when a token is available
- then fall back to `raw.githubusercontent.com`

For private repos, use a token with enough read access.

## Private Post Content

The post detail page supports loading Markdown from private GitHub repositories.

If a post cannot be fetched publicly but has GitHub raw candidates, the page can prompt for a GitHub Personal Access Token and retry through the GitHub API.

This is handled client-side in `assets/post-page.js`.

## Deployment

This repo is designed to be deployed as a static site, for example with GitHub Pages.

No build step is required.

## Maintenance Notes

- if a post shows wrong reading time, refresh metadata with `scripts/update_meta.py`
- if a music file is added but never appears in the playlist, regenerate `data/music-library.json`
- if a post fails to load, check the `candidates` paths in `data/posts.json`
- if a private repo fails to load, verify the token scope and repo access
