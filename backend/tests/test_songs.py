import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.utils.jwt import create_access_token


async def _create_user(db: AsyncSession) -> tuple[User, str]:
    uid = uuid.uuid4().hex[:8]
    user = User(
        google_sub=f"songs_sub_{uid}",
        email=f"songs_{uid}@test.com",
        display_name="Test User",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token, _ = create_access_token(user.id)
    return user, token


@pytest.mark.asyncio
async def test_create_and_list_song(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/songs", json={
        "title": "Hotel California",
        "artist": "Eagles",
        "album": "Hotel California",
    }, headers=headers)
    assert resp.status_code == 201
    song = resp.json()
    assert song["title"] == "Hotel California"
    assert song["id"] is not None

    list_resp = await client.get("/api/v1/songs", headers=headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert any(s["id"] == song["id"] for s in data["items"])


@pytest.mark.asyncio
async def test_delete_song(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post("/api/v1/songs", json={"title": "Stairway", "artist": "Led Zeppelin"}, headers=headers)
    song_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/songs/{song_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/songs/{song_id}", headers=headers)
    assert get_resp.status_code == 404
