import mimetypes
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from app.dependencies import get_current_user
from app.models.user import User
from app.services.storage_service import resolve_path

router = APIRouter(prefix="/files", tags=["files"])
logger = logging.getLogger("uvicorn.error")

ALLOWED_CATEGORIES = {"recordings", "exercises", "bookmarks", "songs", "chord_charts"}


@router.get("/{category}/{user_id}/{filename}")
async def serve_file(
    category: str,
    user_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
):
    logger.warning(
        "File request received category=%s requested_user_id=%s authenticated_user_id=%s filename=%s",
        category,
        user_id,
        current_user.id,
        filename,
    )
    if category not in ALLOWED_CATEGORIES:
        logger.warning("File request rejected: unsupported category=%s filename=%s user_id=%s", category, filename, user_id)
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if current_user.id != user_id:
        logger.warning(
            "File request rejected: user mismatch requested_user_id=%s authenticated_user_id=%s category=%s filename=%s",
            user_id,
            current_user.id,
            category,
            filename,
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    path = resolve_path(f"{category}/{user_id}/{filename}")
    logger.warning("Resolved file path path=%s", str(path))
    if not path.exists():
        logger.warning("File request failed: path does not exist path=%s", str(path))
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")

    media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    logger.warning("Serving file response path=%s media_type=%s", str(path), media_type)
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Accept-Ranges": "bytes"},
    )
