import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.utils.jwt import create_access_token


async def _create_user(db: AsyncSession) -> tuple[User, str]:
    uid = uuid.uuid4().hex[:8]
    user = User(
        google_sub=f"ex_sub_{uid}",
        email=f"ex_{uid}@test.com",
        display_name="Test User",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token, _ = create_access_token(user.id)
    return user, token


@pytest.mark.asyncio
async def test_create_weblink_exercise(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/exercises", data={
        "name": "Spider Exercise",
        "media_type": "weblink",
        "media_url": "https://www.youtube.com/watch?v=example",
    }, headers=headers)
    assert resp.status_code == 201
    ex = resp.json()
    assert ex["name"] == "Spider Exercise"
    assert ex["last_bpm"] is None


@pytest.mark.asyncio
async def test_log_bpm_updates_last_bpm(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/v1/exercises", data={
        "name": "Chromatic Run",
        "media_type": "weblink",
        "media_url": "https://example.com",
    }, headers=headers)
    ex_id = create_resp.json()["id"]

    await client.post(f"/api/v1/exercises/{ex_id}/bpm", json={"bpm": 120}, headers=headers)
    await client.post(f"/api/v1/exercises/{ex_id}/bpm", json={"bpm": 140}, headers=headers)

    history = await client.get(f"/api/v1/exercises/{ex_id}/bpm", headers=headers)
    assert history.json()["last_bpm"] == 140
    assert len(history.json()["items"]) == 2
