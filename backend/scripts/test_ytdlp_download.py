#!/usr/bin/env python3
"""
test_ytdlp_download.py — search YouTube and download MP3 via yt-dlp (no spotdl).

Uses cookies from ~/.config/spotdl/cookies.txt by default (same as spotdl).

Usage
-----
  # Search only — show best match, no download
  python scripts/test_ytdlp_download.py "The Beatles - Hey Jude" --search-only

  # Search + download MP3
  python scripts/test_ytdlp_download.py "The Beatles - Hey Jude"

  # Custom output directory
  python scripts/test_ytdlp_download.py "Stevie Wonder - Isn't She Lovely" -o /tmp/ytdlp-test

  # Override cookies path
  python scripts/test_ytdlp_download.py "Artist - Title" --cookies /path/to/cookies.txt
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import yt_dlp

DEFAULT_COOKIES = Path.home() / ".config" / "spotdl" / "cookies.txt"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / ".ytdlp_test_output"


def _base_ydl_opts(cookies: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
    }
    if cookies.is_file():
        opts["cookiefile"] = str(cookies)
    return opts


def _first_entry(info: dict) -> dict:
    if info.get("_type") == "playlist" and info.get("entries"):
        entry = info["entries"][0]
        if entry is None:
            raise RuntimeError("Search returned no results")
        return entry
    return info


def search(query: str, cookies: Path) -> dict:
    """Return metadata for ytsearch1 best match."""
    search_url = f"ytsearch1:{query}"
    opts = _base_ydl_opts(cookies, DEFAULT_OUTPUT)
    opts["skip_download"] = True

    print(f"[search] query={query!r}")
    print(f"[search] url={search_url}")
    if cookies.is_file():
        print(f"[search] cookies={cookies}")
    else:
        print(f"[search] cookies=MISSING ({cookies}) — continuing without cookies")

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(search_url, download=False)

    video = _first_entry(info)
    print()
    print("[match]")
    print(f"  title   : {video.get('title')}")
    print(f"  channel : {video.get('channel') or video.get('uploader')}")
    print(f"  id      : {video.get('id')}")
    print(f"  duration: {video.get('duration')}s")
    print(f"  url     : {video.get('webpage_url') or video.get('url')}")
    return video


def download(query: str, cookies: Path, output_dir: Path) -> Path:
    """Search via ytsearch1 and download best match as MP3."""
    if not shutil.which("ffmpeg"):
        print("[warn] ffmpeg not found on PATH — MP3 conversion may fail")

    search_url = f"ytsearch1:{query}"
    opts = _base_ydl_opts(cookies, output_dir)

    print(f"[download] query={query!r}")
    print(f"[download] url={search_url}")
    print(f"[download] output_dir={output_dir}")
    if cookies.is_file():
        print(f"[download] cookies={cookies}")
    else:
        print(f"[download] cookies=MISSING ({cookies}) — continuing without cookies")
    print()

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(search_url, download=True)
        video = _first_entry(info)

    # After FFmpegExtractAudio, extension is usually .mp3
    title = video.get("title") or "download"
    mp3_candidates = sorted(output_dir.glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
    if mp3_candidates:
        path = mp3_candidates[0]
        print()
        print(f"[ok] saved: {path}")
        print(f"     size: {path.stat().st_size:,} bytes")
        return path

    raise RuntimeError(
        f"Download finished but no .mp3 found in {output_dir}. "
        "Check ffmpeg is installed and yt-dlp output above for errors."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test YouTube search + MP3 download with yt-dlp (local helper prototype)."
    )
    parser.add_argument(
        "query",
        help='Search term, e.g. "The Beatles - Hey Jude"',
    )
    parser.add_argument(
        "--search-only",
        action="store_true",
        help="Only resolve the best YouTube match; do not download",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Directory for downloaded MP3 (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--cookies",
        type=Path,
        default=DEFAULT_COOKIES,
        help=f"Netscape cookies file (default: {DEFAULT_COOKIES})",
    )
    args = parser.parse_args()

    try:
        if args.search_only:
            search(args.query, args.cookies)
            return 0
        download(args.query, args.cookies, args.output_dir)
        return 0
    except Exception as exc:
        print(f"\n[fail] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
