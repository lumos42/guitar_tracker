#!/usr/bin/env python
"""
test_download.py — exercise the song-download pipeline (yt-dlp).

  MODE 1 (--api):  HTTP round-trip through a running FastAPI/gunicorn server.
    • Exercises BackgroundTasks on the server worker (same as production)
    • Mints JWT, creates or re-uses a song, POSTs /songs/{id}/download
    • Polls /songs/{id}/download-status until downloaded or failed

  MODE 2 (--direct):  calls _run_ytdlp_download() in this process (no server).
    • Same download function the background task uses
    • Useful to debug yt-dlp/cookies/ffmpeg without gunicorn

Usage
-----
  # API mode — server must be running (uvicorn or gunicorn)
  python scripts/test_download.py --api --user-id 1 \\
      --artist "Stevie Wonder" --title "Isn't She Lovely"

  python scripts/test_download.py --api --user-id 1 --song-id 42

  # Direct mode — no server; requires existing song row
  python scripts/test_download.py --direct --user-id 1 --song-id 99 \\
      --artist "Stevie Wonder" --title "Isn't She Lovely"
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # type: ignore

load_dotenv(BACKEND_DIR / ".env")


def _mint_jwt(user_id: int) -> str:
    from jose import jwt  # type: ignore

    secret = os.environ.get("JWT_SECRET_KEY", "change-me")
    algorithm = os.environ.get("JWT_ALGORITHM", "HS256")
    expire_minutes = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expire_minutes),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def _base_url() -> str:
    return os.environ.get("APP_BASE_URL", "http://localhost:9000").rstrip("/")


def _read_db_status(song_id: int) -> str | None:
    """Read download_status from DB after direct run."""
    from sqlalchemy import select  # noqa: PLC0415

    from app.database import get_session_factory, init_db  # noqa: PLC0415
    from app.models.song import Song  # noqa: PLC0415

    async def _read() -> str | None:
        await init_db()
        sf = get_session_factory()
        async with sf() as db:
            result = await db.execute(select(Song).where(Song.id == song_id))
            song = result.scalar_one_or_none()
            if not song:
                print(f"[direct] song id={song_id} not found in DB")
                return None
            print(
                f"[direct] DB status={song.download_status!r} "
                f"local_file_path={song.local_file_path!r}"
            )
            return song.download_status

    return asyncio.run(_read())


def run_api_test(
    user_id: int,
    artist: str,
    title: str,
    song_id: int | None,
    timeout: int,
) -> int:
    import httpx

    token = _mint_jwt(user_id)
    base = _base_url()
    headers = {"Authorization": f"Bearer {token}"}

    if song_id is None:
        print(f"[api] Creating song  '{artist} – {title}'  for user {user_id} …")
        resp = httpx.post(
            f"{base}/api/v1/songs",
            json={"title": title, "artist": artist},
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        song_id = resp.json()["id"]
        print(f"[api] Created song id={song_id}")
    else:
        print(f"[api] Re-using song id={song_id}")

    print(f"[api] POST /api/v1/songs/{song_id}/download  (background task on server) …")
    resp = httpx.post(f"{base}/api/v1/songs/{song_id}/download", headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    print(f"[api] Response: download_status={data.get('download_status')!r}")

    deadline = time.monotonic() + timeout
    poll_interval = 3
    ds = None
    status_data: dict = {}
    print(f"[api] Polling status (timeout={timeout}s) …")
    while time.monotonic() < deadline:
        resp = httpx.get(
            f"{base}/api/v1/songs/{song_id}/download-status",
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        status_data = resp.json()
        ds = status_data.get("download_status")
        print(f"[api]   status={ds!r}  ({datetime.now().strftime('%H:%M:%S')})")
        if ds in ("downloaded", "failed"):
            break
        time.sleep(poll_interval)
    else:
        print("[api] TIMEOUT — download still in progress (background task may still be running).")
        return 1

    if ds == "downloaded":
        print(
            f"[api] ✓ Download succeeded.  local_file_path={status_data.get('local_file_path')!r}"
        )
        return 0

    print(f"[api] ✗ Download failed.  Full status payload: {status_data}")
    log_resp = httpx.get(
        f"{base}/api/v1/songs/{song_id}/download-log",
        headers=headers,
        timeout=10,
    )
    if log_resp.is_success:
        log_text = log_resp.json().get("log", "")
        print("[api] --- yt-dlp log (last 2 KB) ---")
        print(log_text[-2048:])
        print("[api] ---")
    return 1


async def _run_direct(user_id: int, song_id: int, artist: str, title: str) -> None:
    from app.database import get_session_factory, init_db  # noqa: PLC0415
    from app.routers.songs import _run_ytdlp_download  # noqa: PLC0415

    print("[direct] Initialising DB …")
    await init_db()
    sf = get_session_factory()

    print(
        f"[direct] Calling _run_ytdlp_download(song_id={song_id}, user_id={user_id}, …)"
    )
    await _run_ytdlp_download(
        song_id=song_id,
        user_id=user_id,
        artist=artist,
        title=title,
        session_factory=sf,
    )
    print("[direct] _run_ytdlp_download returned.")


def run_direct_test(user_id: int, song_id: int, artist: str, title: str) -> int:
    asyncio.run(_run_direct(user_id, song_id, artist, title))
    status = _read_db_status(song_id)
    if status == "downloaded":
        print("[direct] ✓ Download succeeded")
        return 0
    print(f"[direct] ✗ Download did not succeed (status={status!r})")
    return 1


async def _ensure_song(user_id: int, song_id: int | None, artist: str, title: str) -> int:
    """Create a song row for direct mode when --song-id omitted."""
    from app.database import get_session_factory, init_db  # noqa: PLC0415
    from app.models.song import Song  # noqa: PLC0415

    await init_db()
    sf = get_session_factory()
    if song_id is not None:
        return song_id

    async with sf() as db:
        song = Song(user_id=user_id, title=title, artist=artist)
        db.add(song)
        await db.commit()
        await db.refresh(song)
        print(f"[direct] Created song id={song.id}")
        return song.id


def main() -> None:
    parser = argparse.ArgumentParser(description="Test yt-dlp song download pipeline.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--api",
        action="store_true",
        help="Test via HTTP API (exercises server BackgroundTasks)",
    )
    mode.add_argument(
        "--direct",
        action="store_true",
        help="Call _run_ytdlp_download() in-process",
    )

    parser.add_argument("--user-id", type=int, default=1)
    parser.add_argument("--song-id", type=int, default=None)
    parser.add_argument("--artist", default="Stevie Wonder")
    parser.add_argument("--title", default="Isn't She Lovely")
    parser.add_argument("--timeout", type=int, default=300, help="API poll timeout (seconds)")

    args = parser.parse_args()

    if args.api:
        sys.exit(
            run_api_test(
                user_id=args.user_id,
                artist=args.artist,
                title=args.title,
                song_id=args.song_id,
                timeout=args.timeout,
            )
        )

    song_id = args.song_id
    if song_id is None:
        song_id = asyncio.run(
            _ensure_song(args.user_id, None, args.artist, args.title)
        )
    sys.exit(run_direct_test(args.user_id, song_id, args.artist, args.title))


if __name__ == "__main__":
    main()
