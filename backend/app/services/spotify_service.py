import time
import base64
import httpx
from fastapi import HTTPException, status
from app.config import settings

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"


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


spotify_service = SpotifyService()
