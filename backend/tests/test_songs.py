import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.services.spotify_service import spotify_service
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
async def test_create_song_rejects_duplicate_spotify_track(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": "Isn't She Lovely",
        "artist": "Stevie Wonder",
        "spotify_track_id": "3NlLmKBJozwoi0k03Feb1N",
    }

    first = await client.post("/api/v1/songs", json=payload, headers=headers)
    assert first.status_code == 201

    duplicate = await client.post("/api/v1/songs", json=payload, headers=headers)
    assert duplicate.status_code == 409
    detail = duplicate.json()["detail"]
    assert detail["existing_song_id"] == first.json()["id"]


@pytest.mark.asyncio
async def test_create_song_with_spotify_stores_bpm(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    async def mock_bpm(track_id: str) -> int:
        assert track_id == "3NlLmKBJozwoi0k03Feb1N"
        return 120

    monkeypatch.setattr(spotify_service, "get_track_bpm", mock_bpm)

    resp = await client.post("/api/v1/songs", json={
        "title": "Isn't She Lovely",
        "artist": "Stevie Wonder",
        "spotify_track_id": "3NlLmKBJozwoi0k03Feb1N",
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["bpm"] == 120


@pytest.mark.asyncio
async def test_create_song_without_spotify_has_null_bpm(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/songs", json={
        "title": "Stairway",
        "artist": "Led Zeppelin",
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["bpm"] is None


@pytest.mark.asyncio
async def test_create_song_spotify_failure_still_succeeds(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    async def mock_bpm(_track_id: str) -> None:
        return None

    monkeypatch.setattr(spotify_service, "get_track_bpm", mock_bpm)

    resp = await client.post("/api/v1/songs", json={
        "title": "Test Track",
        "artist": "Test Artist",
        "spotify_track_id": "abc123",
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["bpm"] is None


@pytest.mark.asyncio
async def test_get_song_backfills_bpm(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    call_count = 0

    async def mock_bpm(track_id: str) -> int | None:
        nonlocal call_count
        call_count += 1
        assert track_id == "track_backfill"
        if call_count == 1:
            return None
        return 98

    monkeypatch.setattr(spotify_service, "get_track_bpm", mock_bpm)

    create_resp = await client.post("/api/v1/songs", json={
        "title": "Backfill Test",
        "artist": "Artist",
        "spotify_track_id": "track_backfill",
    }, headers=headers)
    assert create_resp.status_code == 201
    assert create_resp.json()["bpm"] is None
    song_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/songs/{song_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["bpm"] == 98


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
