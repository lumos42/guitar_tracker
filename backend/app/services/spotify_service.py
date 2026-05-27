import logging
import time
import base64
import httpx
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
AUDIO_FEATURES_URL = "https://api.spotify.com/v1/audio-features/{track_id}"


class SpotifyService:
    def __init__(self):
        self._token: str = ""
        self._token_expiry: float = 0.0

    async def init_token(self) -> None:
        await self._refresh_token()

    async def _refresh_token(self) -> None:
        creds = f"{settings.SPOTIFY_CLIENT_ID}:{settings.SPOTIFY_CLIENT_SECRET}"
        b64 = base64.b64encode(creds.encode()).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                SPOTIFY_TOKEN_URL,
                headers={"Authorization": f"Basic {b64}"},
                data={"grant_type": "client_credentials"},
            )
        if resp.status_code != 200:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Spotify auth failed")
        data = resp.json()
        self._token = data["access_token"]
        self._token_expiry = time.time() + data["expires_in"] - 60  # 60s buffer

    async def _get_token(self) -> str:
        if time.time() > self._token_expiry:
            await self._refresh_token()
        return self._token

    async def search_tracks(self, q: str, limit: int = 10) -> list[dict]:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                SPOTIFY_SEARCH_URL,
                headers={"Authorization": f"Bearer {token}"},
                params={"q": q, "type": "track", "limit": limit, "market": "US"},
            )

        if resp.status_code == 401:
            # Token expired mid-flight — force refresh and retry once
            await self._refresh_token()
            token = self._token
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    SPOTIFY_SEARCH_URL,
                    headers={"Authorization": f"Bearer {token}"},
                    params={"q": q, "type": "track", "limit": limit, "market": "US"},
                )

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After", "5")
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Spotify rate limit hit",
                headers={"Retry-After": retry_after},
            )

        if resp.status_code != 200:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Spotify search failed")

        items = resp.json().get("tracks", {}).get("items", [])
        results = []
        for item in items:
            images = item.get("album", {}).get("images", [])
            # index 1 is ~300x300; fall back to index 0 if only one image
            album_art = images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else None)
            artists = ", ".join(a["name"] for a in item.get("artists", []))
            results.append({
                "id": item["id"],
                "name": item["name"],
                "artist": artists,
                "album": item.get("album", {}).get("name"),
                "album_art_url": album_art,
                "duration_ms": item.get("duration_ms"),
            })
        return results

    async def get_track_bpm(self, track_id: str) -> int | None:
        token = await self._get_token()
        url = AUDIO_FEATURES_URL.format(track_id=track_id)

        async def _fetch(auth_token: str) -> httpx.Response:
            async with httpx.AsyncClient() as client:
                return await client.get(
                    url,
                    headers={"Authorization": f"Bearer {auth_token}"},
                )

        resp = await _fetch(token)

        if resp.status_code == 401:
            await self._refresh_token()
            resp = await _fetch(self._token)

        if resp.status_code == 404:
            logger.info("Spotify audio features not found for track %s", track_id)
            return None

        if resp.status_code != 200:
            logger.warning(
                "Spotify audio features failed for track %s: status=%s",
                track_id,
                resp.status_code,
            )
            return None

        tempo = resp.json().get("tempo")
        if tempo is None:
            return None
        return round(tempo)


spotify_service = SpotifyService()
