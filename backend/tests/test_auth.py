import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_google_login_returns_auth_url(client: AsyncClient):
    resp = await client.get("/api/v1/auth/google/login")
    assert resp.status_code == 200
    data = resp.json()
    assert "auth_url" in data
    assert "accounts.google.com" in data["auth_url"]


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 403  # no bearer token
