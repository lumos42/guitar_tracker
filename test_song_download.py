"""
Manual API test for song download flow.

Uses the sample song:
{
  "id": 1,
  "spotify_track_id": "1eT2CjXwFXNx6oY5ydvzKU",
  "title": "Hey Jude",
  "artist": "The Beatles"
}

Run:
    python test_song_download.py

Optional env vars:
    API_BASE_URL=http://localhost:8000
    SONG_ID=1
    USER_ID=1
    ACCESS_TOKEN=<token>
    JWT_SECRET_KEY=<secret>  # used only if ACCESS_TOKEN is missing
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from jose import jwt
from dotenv import load_dotenv


SAMPLE_SONG = {
    "id": 1,
    "spotify_track_id": "1eT2CjXwFXNx6oY5ydvzKU",
    "title": "Hey Jude",
    "artist": "The Beatles",
}


def load_backend_env() -> None:
    """Load backend/.env so JWT secret matches the API config."""
    repo_root = Path(__file__).resolve().parent
    env_path = repo_root / "backend" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"[ENV] Loaded environment from {env_path}")
    else:
        print(f"[ENV] backend .env not found at {env_path}, using current environment")


def make_access_token(user_id: int, secret: str, algorithm: str = "HS256") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def build_access_token(user_id: int) -> str:
    provided = os.getenv("ACCESS_TOKEN")
    if provided:
        print("[AUTH] Using ACCESS_TOKEN from environment")
        return provided

    secret = os.getenv("JWT_SECRET_KEY", "change-me")
    print("[AUTH] ACCESS_TOKEN not set, generating token from JWT secret")
    return make_access_token(user_id=user_id, secret=secret)


def poll_song_status(
    client: httpx.Client,
    song_id: int,
    max_attempts: int = 30,
    interval_seconds: float = 2.0,
) -> int:
    print(f"[POLL] Polling /songs/{song_id} for completion")
    for attempt in range(1, max_attempts + 1):
        response = client.get(f"/api/v1/songs/{song_id}")
        if response.status_code != 200:
            print(f"[POLL] Attempt {attempt}: unexpected HTTP {response.status_code} -> {response.text}")
            return 1

        body = response.json()
        status = body.get("download_status")
        local_file_path = body.get("local_file_path")
        print(
            f"[POLL] Attempt {attempt}/{max_attempts} "
            f"status={status!r} local_file_path={local_file_path!r}"
        )

        if status == "downloaded":
            print("[PASS] Download completed successfully")
            return 0

        if status == "failed":
            print("[FAIL] Download failed")
            return 1

        time.sleep(interval_seconds)

    print("[FAIL] Timed out waiting for download completion")
    return 1


def main() -> int:
    load_backend_env()
    base_url = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
    song_id = int(os.getenv("SONG_ID", str(SAMPLE_SONG["id"])))
    user_id = int(os.getenv("USER_ID", "1"))
    token = build_access_token(user_id=user_id)

    headers = {"Authorization": f"Bearer {token}"}
    print(f"[INFO] Base URL: {base_url}")
    print(f"[INFO] Using song_id={song_id}, user_id={user_id}")
    print(f"[INFO] Expected sample spotify_track_id={SAMPLE_SONG['spotify_track_id']}")

    with httpx.Client(base_url=base_url, timeout=30.0, headers=headers) as client:
        me_response = client.get("/api/v1/auth/me")
        print(f"[AUTH] GET /api/v1/auth/me -> {me_response.status_code}")
        if me_response.status_code != 200:
            print(f"[AUTH] Response body: {me_response.text}")
            print(
                "[FAIL] Auth check failed. Ensure one of these is true:\n"
                "       1) ACCESS_TOKEN is a valid token from this backend, or\n"
                "       2) backend/.env has the correct JWT_SECRET_KEY, and\n"
                "       3) USER_ID points to an existing user in DB."
            )
            return 1

        print(f"[STEP] Triggering download: POST /api/v1/songs/{song_id}/download")
        response = client.post(f"/api/v1/songs/{song_id}/download")
        print(f"[STEP] Response status: {response.status_code}")
        print(f"[STEP] Response body: {response.text}")

        if response.status_code != 200:
            print("[FAIL] Download trigger request failed")
            return 1

        body = response.json()
        if body.get("spotify_track_id") != SAMPLE_SONG["spotify_track_id"]:
            print("[WARN] Song spotify_track_id does not match provided sample")

        return poll_song_status(client=client, song_id=song_id)


if __name__ == "__main__":
    sys.exit(main())
