import logging
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.utils.jwt import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger("uvicorn.error")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        logger.warning(
            "Authentication failed: missing bearer token method=%s path=%s has_authorization_header=%s",
            request.method,
            request.url.path,
            "authorization" in request.headers,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = int(payload["sub"])
    logger.warning(
        "Resolving authenticated user from JWT method=%s path=%s jwt_sub=%s resolved_user_id=%s",
        request.method,
        request.url.path,
        payload.get("sub"),
        user_id,
    )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        logger.warning("JWT resolved to missing user resolved_user_id=%s", user_id)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    logger.warning("Authenticated user resolved user_id=%s email=%s", user.id, user.email)
    return user
