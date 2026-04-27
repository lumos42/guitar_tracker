import secrets
import bcrypt
import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.models.user import User

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

_SCOPES = "openid email profile"


def build_google_auth_url(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": _SCOPES,
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{query}"


async def exchange_google_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google token exchange failed")
    return resp.json()


async def get_google_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Failed to fetch Google user info")
    return resp.json()


async def upsert_user(db: AsyncSession, claims: dict) -> User:
    google_sub = claims["sub"]
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            google_sub=google_sub,
            email=claims["email"],
            display_name=claims.get("name", claims["email"]),
            avatar_url=claims.get("picture"),
        )
        db.add(user)
    else:
        user.display_name = claims.get("name", user.display_name)
        user.avatar_url = claims.get("picture", user.avatar_url)
    await db.commit()
    await db.refresh(user)
    return user


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return bcrypt.hashpw(token.encode(), bcrypt.gensalt()).decode()


def verify_refresh_token(token: str, token_hash: str) -> bool:
    return bcrypt.checkpw(token.encode(), token_hash.encode())


async def save_refresh_token(db: AsyncSession, user: User, token: str) -> None:
    user.refresh_token_hash = hash_refresh_token(token)
    await db.commit()


async def get_user_by_refresh_token(db: AsyncSession, token: str) -> User:
    # We can't query by hash directly — scan users with non-null hash
    # In practice the cookie lifespan limits exposure; for scale, add a token_id column
    result = await db.execute(
        select(User).where(User.refresh_token_hash.is_not(None))
    )
    for user in result.scalars():
        if verify_refresh_token(token, user.refresh_token_hash):
            return user
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
