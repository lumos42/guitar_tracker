from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.bookmark import Bookmark, BookmarkType
from app.schemas.bookmark import BookmarkUpdate, BookmarkResponse
from app.services.storage_service import save_file, get_file_url
from app.utils.pagination import PageResponse

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


def _to_response(b: Bookmark) -> BookmarkResponse:
    resp = BookmarkResponse.model_validate(b)
    if b.file_path:
        resp.file_url = get_file_url(b.file_path)
    return resp


@router.get("", response_model=PageResponse[BookmarkResponse])
async def list_bookmarks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[BookmarkType] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    filters = [Bookmark.user_id == current_user.id, Bookmark.deleted_at.is_(None)]
    if type:
        filters.append(Bookmark.type == type)

    total = (await db.execute(
        select(func.count()).select_from(Bookmark).where(and_(*filters))
    )).scalar_one()
    result = await db.execute(
        select(Bookmark).where(and_(*filters))
        .order_by(Bookmark.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    bookmarks = result.scalars().all()
    return PageResponse(items=[_to_response(b) for b in bookmarks], total=total, page=page, limit=limit)


@router.post("", response_model=BookmarkResponse, status_code=201)
async def create_bookmark(
    type: BookmarkType = Form(...),
    title: str = Form(...),
    url: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_path = None
    mime_type = None
    file_size = None

    if type == BookmarkType.photo:
        if not file:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "file required for photo bookmark")
        file_path, file_size = await save_file(file, "bookmarks", current_user.id)
        mime_type = file.content_type
    else:
        if not url:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "url required for youtube/weblink bookmark")

    bookmark = Bookmark(
        user_id=current_user.id,
        type=type,
        title=title,
        url=url,
        notes=notes,
        file_path=file_path,
        mime_type=mime_type,
        file_size_bytes=file_size,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return _to_response(bookmark)


@router.get("/{bookmark_id}", response_model=BookmarkResponse)
async def get_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    b = (await db.execute(
        select(Bookmark).where(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == current_user.id,
            Bookmark.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bookmark not found")
    return _to_response(b)


@router.patch("/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(
    bookmark_id: int,
    body: BookmarkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    b = (await db.execute(
        select(Bookmark).where(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == current_user.id,
            Bookmark.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bookmark not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    return _to_response(b)


@router.delete("/{bookmark_id}", status_code=204)
async def delete_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    b = (await db.execute(
        select(Bookmark).where(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == current_user.id,
            Bookmark.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bookmark not found")
    b.deleted_at = datetime.now(timezone.utc)
    await db.commit()
