import base64
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, Response, Cookie, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import TokenResponse, UserResponse
from app.services import auth_service
from app.utils.jwt import create_access_token
from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

OAUTH_STATE_COOKIE = "oauth_state"
_OAUTH_STATE_TTL_SECONDS = 600


def _sign_oauth_state(state: str, frontend_url: str) -> str:
    payload = {
        "state": state,
        "frontend_url": frontend_url,
        "exp": int(time.time()) + _OAUTH_STATE_TTL_SECONDS,
    }
    body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()
    sig = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{body}.{sig}"


def _verify_oauth_state_cookie(cookie_value: str, state: str) -> str | None:
    try:
        body, sig = cookie_value.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(body.encode()))
    except (json.JSONDecodeError, ValueError):
        return None
    if payload.get("state") != state:
        return None
    if payload.get("exp", 0) < time.time():
        return None
    frontend_url = payload.get("frontend_url")
    if not isinstance(frontend_url, str):
        return None
    return frontend_url


def _extract_origin(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


@router.get("/google/login")
async def google_login(request: Request):
    state = secrets.token_urlsafe(16)
    request_origin = _extract_origin(request.headers.get("origin"))
    request_referer = _extract_origin(request.headers.get("referer"))
    frontend_url = request_origin or request_referer or settings.FRONTEND_URL
    auth_url = auth_service.build_google_auth_url(state)
    response = RedirectResponse(url=auth_url)
    response.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=_sign_oauth_state(state, frontend_url),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/api/v1/auth",
        max_age=_OAUTH_STATE_TTL_SECONDS,
    )
    return response


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None, alias=OAUTH_STATE_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    if not oauth_state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state")

    frontend_url = _verify_oauth_state_cookie(oauth_state, state)
    if frontend_url is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid OAuth state")

    token_data = await auth_service.exchange_google_code(code)
    claims = await auth_service.get_google_userinfo(token_data["access_token"])
    user = await auth_service.upsert_user(db, claims)

    access_token, _ = create_access_token(user.id)
    refresh_token = auth_service.generate_refresh_token()
    await auth_service.save_refresh_token(db, user, refresh_token)

    redirect = RedirectResponse(url=f"{frontend_url}/auth/callback?access_token={access_token}")
    redirect.delete_cookie(OAUTH_STATE_COOKIE, path="/api/v1/auth")
    redirect.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/api/v1/auth/refresh",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return redirect


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    refresh_token: str = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")

    user = await auth_service.get_user_by_refresh_token(db, refresh_token)

    # Rotate refresh token
    new_refresh = auth_service.generate_refresh_token()
    await auth_service.save_refresh_token(db, user, new_refresh)

    access_token, expires_in = create_access_token(user.id)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/api/v1/auth/refresh",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    return TokenResponse(access_token=access_token, expires_in=expires_in)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.refresh_token_hash = None
    await db.commit()
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
