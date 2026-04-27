import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.utils.jwt import create_access_token


async def _create_user(db: AsyncSession) -> tuple[User, str]:
    uid = uuid.uuid4().hex[:8]
    user = User(
        google_sub=f"bm_sub_{uid}",
        email=f"bm_{uid}@test.com",
        display_name="Test User",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token, _ = create_access_token(user.id)
    return user, token


@pytest.mark.asyncio
async def test_create_youtube_bookmark(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/bookmarks", data={
        "type": "youtube",
        "title": "Justin Guitar Lesson",
        "url": "https://www.youtube.com/watch?v=example",
    }, headers=headers)
    assert resp.status_code == 201
    b = resp.json()
    assert b["type"] == "youtube"
    assert b["url"] == "https://www.youtube.com/watch?v=example"


@pytest.mark.asyncio
async def test_filter_bookmarks_by_type(client: AsyncClient, db_session: AsyncSession):
    _, token = await _create_user(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/bookmarks", data={"type": "youtube", "title": "YT", "url": "https://yt.com"}, headers=headers)
    await client.post("/api/v1/bookmarks", data={"type": "weblink", "title": "Web", "url": "https://web.com"}, headers=headers)

    resp = await client.get("/api/v1/bookmarks?type=youtube", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(b["type"] == "youtube" for b in items)
