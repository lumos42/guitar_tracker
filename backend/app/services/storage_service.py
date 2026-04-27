import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from slugify import slugify
from app.config import settings

ALLOWED_MIMES: dict[str, set[str]] = {
    "recordings": {"audio/webm", "video/webm", "audio/ogg", "audio/mp4", "video/mp4"},
    "exercises": {"image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"},
    "bookmarks": {"image/jpeg", "image/png", "image/gif", "image/webp"},
    "chord_charts": {"image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"},
}


def _get_dest(category: str, user_id: int, filename: str) -> Path:
    return settings.UPLOAD_DIR / category / str(user_id) / filename


def get_file_url(relative_path: str) -> str:
    return f"/api/v1/files/{relative_path}"


async def save_file(file: UploadFile, category: str, user_id: int) -> tuple[str, int]:
    """Save an uploaded file. Returns (relative_path, file_size_bytes)."""
    allowed = ALLOWED_MIMES.get(category, set())
    if file.content_type not in allowed:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"File type {file.content_type!r} not allowed for {category}",
        )

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    stem = slugify(Path(file.filename or "file").stem)[:80]
    suffix = Path(file.filename or "file").suffix or ""
    filename = f"{uuid.uuid4().hex}_{stem}{suffix}"
    dest = _get_dest(category, user_id, filename)
    dest.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > max_bytes:
                await out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
                )
            await out.write(chunk)

    relative_path = f"{category}/{user_id}/{filename}"
    return relative_path, size


def delete_file(relative_path: str) -> None:
    path = settings.UPLOAD_DIR / relative_path
    path.unlink(missing_ok=True)


def resolve_path(relative_path: str) -> Path:
    return settings.UPLOAD_DIR / relative_path
