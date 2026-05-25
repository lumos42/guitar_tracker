#!/usr/bin/env python
"""
test_download.py — two ways to exercise the song-download pipeline:

  MODE 1 (--api):  full HTTP round-trip through the running FastAPI server.
    • Mints a JWT for --user-id (reads JWT_SECRET_KEY + JWT_ALGORITHM from .env)
    • Creates a throwaway song (or re-uses --song-id if given)
    • POSTs to /songs/{id}/download
    • Polls /songs/{id}/download-status until done or timeout

  MODE 2 (--direct):  calls _run_spotdl_download() in-process (no server needed).
    • Useful to confirm the function itself works and to watch stdout live

Usage examples
--------------
  # API mode (server must be running on APP_BASE_URL)
  python scripts/test_download.py --api \
      --user-id 1 \
      --artist "Stevie Wonder" --title "Isn't She Lovely"

  # API mode, re-use an existing song
  python scripts/test_download.py --api --user-id 1 --song-id 42

  # Direct mode (no server needed)
  python scripts/test_download.py --direct \
      --user-id 1 --song-id 99 \
      --artist "Stevie Wonder" --title "Isn't She Lovely"
"""

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Make sure we can import app.* even when called from the repo root
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Load .env early so Settings picks it up
from dotenv import load_dotenv  # type: ignore

load_dotenv(BACKEND_DIR / ".env")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mint_jwt(user_id: int) -> str:
    """Forge a valid access token for any user-id using the local .env secret."""
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


# ---------------------------------------------------------------------------
# MODE 1 — API
# ---------------------------------------------------------------------------


def run_api_test(user_id: int, artist: str, title: str, song_id: int | None, timeout: int) -> None:
    import httpx

    token = _mint_jwt(user_id)
    base = _base_url()
    headers = {"Authorization": f"Bearer {token}"}

    # ── create a throwaway song if no song_id supplied ─────────────────────
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

    # ── trigger download ────────────────────────────────────────────────────
    print(f"[api] POST /api/v1/songs/{song_id}/download …")
    resp = httpx.post(f"{base}/api/v1/songs/{song_id}/download", headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    print(f"[api] Response: download_status={data.get('download_status')!r}")

    # ── poll until done ─────────────────────────────────────────────────────
    deadline = time.monotonic() + timeout
    poll_interval = 3
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
        print("[api] TIMEOUT reached — download still in progress.")
        return

    if ds == "downloaded":
        print(f"[api] ✓ Download succeeded.  local_file_path={status_data.get('local_file_path')!r}")
    else:
        print(f"[api] ✗ Download failed.  Full status payload: {status_data}")
        # Fetch log for debugging
        log_resp = httpx.get(
            f"{base}/api/v1/songs/{song_id}/download-log",
            headers=headers,
            timeout=10,
        )
        if log_resp.is_success:
            log_text = log_resp.json().get("log", "")
            print("[api] --- spotdl log (last 2 KB) ---")
            print(log_text[-2048:])
            print("[api] ---")


# ---------------------------------------------------------------------------
# MODE 2 — Direct
# ---------------------------------------------------------------------------


async def _run_direct(user_id: int, song_id: int, artist: str, title: str) -> None:
    from app.database import get_session_factory, init_db  # noqa: PLC0415

    print(f"[direct] Initialising DB …")
    await init_db()
    sf = get_session_factory()

    print(f"[direct] Calling _run_spotdl_download(song_id={song_id}, user_id={user_id}, …)")
    from app.routers.songs import _run_spotdl_download  # noqa: PLC0415

    await _run_spotdl_download(
        song_id=song_id,
        user_id=user_id,
        artist=artist,
        title=title,
        session_factory=sf,
    )
    print("[direct] _run_spotdl_download returned.")


def run_direct_test(user_id: int, song_id: int, artist: str, title: str) -> None:
    asyncio.run(_run_direct(user_id, song_id, artist, title))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Test the song-download pipeline.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--api", action="store_true", help="Test via HTTP API (server must be running)")
    mode.add_argument("--direct", action="store_true", help="Call _run_spotdl_download() directly")

    parser.add_argument("--user-id", type=int, default=1, help="User ID to act as (default: 1)")
    parser.add_argument("--song-id", type=int, default=None, help="Re-use existing song id (optional)")
    parser.add_argument("--artist", default="Stevie Wonder", help="Artist name")
    parser.add_argument("--title", default="Isn't She Lovely", help="Song title")
    parser.add_argument("--timeout", type=int, default=300, help="Polling timeout in seconds (api mode)")

    args = parser.parse_args()

    if args.direct and args.song_id is None:
        parser.error("--direct requires --song-id (the song must already exist in the DB)")

    if args.api:
        run_api_test(
            user_id=args.user_id,
            artist=args.artist,
            title=args.title,
            song_id=args.song_id,
            timeout=args.timeout,
        )
    else:
        run_direct_test(
            user_id=args.user_id,
            song_id=args.song_id,
            artist=args.artist,
            title=args.title,
        )


if __name__ == "__main__":
    main()
