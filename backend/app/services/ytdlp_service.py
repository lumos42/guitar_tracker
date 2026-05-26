"""YouTube search + MP3 download via yt-dlp."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

import yt_dlp

logger = logging.getLogger(__name__)

# Common install locations when PATH is minimal (e.g. gunicorn systemd unit).
_DENO_CANDIDATES = (
    Path.home() / ".deno" / "bin" / "deno",
    Path("/usr/local/bin/deno"),
    Path("/usr/bin/deno"),
)
_NODE_CANDIDATES = (
    Path("/usr/bin/node"),
    Path("/usr/local/bin/node"),
    Path.home() / ".nvm" / "current" / "bin" / "node",
)


class _FileLogger:
    """yt-dlp logger that mirrors output to a log file."""

    def __init__(self, log_path: Path) -> None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._file = open(log_path, "w", buffering=1)

    def debug(self, msg: str) -> None:
        if msg.startswith("[debug] "):
            return
        self._write(msg)

    def info(self, msg: str) -> None:
        self._write(msg)

    def warning(self, msg: str) -> None:
        self._write(f"WARNING: {msg}")

    def error(self, msg: str) -> None:
        self._write(f"ERROR: {msg}")

    def _write(self, msg: str) -> None:
        self._file.write(msg + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()


def _resolve_executable(
    name: str,
    configured: str,
    candidates: tuple[Path, ...],
) -> Path | None:
    if configured:
        path = Path(configured).expanduser()
        if path.is_file():
            return path
        logger.warning("Configured %s path not found: %s", name, path)

    found = shutil.which(name)
    if found:
        return Path(found)

    for path in candidates:
        if path.is_file():
            return path
    return None


def build_js_runtimes(deno_path: str = "", node_path: str = "") -> dict[str, dict]:
    """
    JS runtimes for YouTube EJS challenge solving.

    gunicorn/systemd often omit ~/.deno/bin from PATH, so we probe common paths.
    """
    runtimes: dict[str, dict] = {}

    deno = _resolve_executable("deno", deno_path, _DENO_CANDIDATES)
    if deno:
        runtimes["deno"] = {"path": str(deno)}
        logger.info("yt-dlp JS runtime: deno at %s", deno)

    node = _resolve_executable("node", node_path, _NODE_CANDIDATES)
    if node:
        runtimes["node"] = {"path": str(node)}
        logger.info("yt-dlp JS runtime: node at %s", node)

    if not runtimes:
        logger.warning(
            "No JS runtime found for yt-dlp (deno/node). "
            "YouTube downloads will likely fail — set YTDLP_DENO_PATH in .env"
        )
        runtimes["deno"] = {}

    return runtimes


def build_ytdlp_opts(
    output_dir: Path,
    cookies_path: Path | None = None,
    audio_quality: str = "192",
    deno_path: str = "",
    node_path: str = "",
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    opts: dict = {
        "format": "bestaudio/best",
        "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": audio_quality,
            }
        ],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "js_runtimes": build_js_runtimes(deno_path, node_path),
    }
    if cookies_path and cookies_path.is_file():
        opts["cookiefile"] = str(cookies_path)
    return opts


def download_mp3_from_search(
    query: str,
    output_dir: Path,
    log_path: Path,
    cookies_path: Path | None = None,
    audio_quality: str = "192",
    deno_path: str = "",
    node_path: str = "",
) -> Path:
    """
    Search YouTube (ytsearch1) and download the best match as MP3.

    Returns the path to the downloaded .mp3 file inside output_dir.
    """
    search_url = f"ytsearch1:{query}"

    file_logger = _FileLogger(log_path)
    try:
        opts = build_ytdlp_opts(
            output_dir,
            cookies_path,
            audio_quality,
            deno_path,
            node_path,
        )
        opts["logger"] = file_logger

        if cookies_path and cookies_path.is_file():
            logger.info("yt-dlp using cookies: %s", cookies_path)
        else:
            logger.warning("yt-dlp cookies file missing: %s", cookies_path)

        runtimes = opts.get("js_runtimes", {})
        file_logger.info(
            "yt-dlp JS runtimes: "
            + ", ".join(
                f"{name}={cfg.get('path', 'PATH')}" for name, cfg in runtimes.items()
            )
        )
        logger.info("yt-dlp download: %r → %s", search_url, output_dir)

        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([search_url])
    finally:
        file_logger.close()

    mp3s = list(output_dir.glob("*.mp3"))
    if not mp3s:
        tail = log_path.read_text(errors="replace")[-2000:] if log_path.exists() else ""
        raise RuntimeError(
            f"yt-dlp finished but no mp3 found in {output_dir}.\nLog tail:\n{tail}"
        )

    return max(mp3s, key=lambda p: p.stat().st_mtime)
