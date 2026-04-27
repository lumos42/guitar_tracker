from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.song import Song
from app.models.practice_session import PracticeSession
from app.models.recording import Recording
from app.schemas.practice_session import (
    PracticeSessionCreate, PracticeSessionUpdate,
    PracticeSessionResponse, PracticeSessionDetailResponse,
)
from app.schemas.recording import RecordingResponse
from app.schemas.song import SongResponse
from app.services.storage_service import get_file_url
from app.utils.pagination import PageResponse

router = APIRouter(prefix="/practice-sessions", tags=["practice-sessions"])


def _recording_to_response(r: Recording) -> RecordingResponse:
    resp = RecordingResponse.model_validate(r)
    resp.stream_url = get_file_url(r.file_path)
    return resp


@router.get("", response_model=PageResponse[PracticeSessionResponse])
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    song_id: Optional[int] = None,
    from_date: Optional[datetime] = Query(default=None, alias="from"),
    to_date: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [PracticeSession.user_id == current_user.id, PracticeSession.deleted_at.is_(None)]
    if song_id:
        filters.append(PracticeSession.song_id == song_id)
    if from_date:
        filters.append(PracticeSession.practiced_at >= from_date)
    if to_date:
        filters.append(PracticeSession.practiced_at <= to_date)

    from sqlalchemy import func
    total = (await db.execute(
        select(func.count()).select_from(PracticeSession).where(and_(*filters))
    )).scalar_one()

    result = await db.execute(
        select(PracticeSession).where(and_(*filters))
        .order_by(PracticeSession.practiced_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    sessions = result.scalars().all()
    return PageResponse(items=sessions, total=total, page=page, limit=limit)


@router.post("", response_model=PracticeSessionResponse, status_code=201)
async def create_session(
    body: PracticeSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    song = (await db.execute(
        select(Song).where(Song.id == body.song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    session = PracticeSession(
        user_id=current_user.id,
        song_id=body.song_id,
        practiced_at=body.practiced_at or datetime.now(timezone.utc),
        notes=body.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=PracticeSessionDetailResponse)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.recordings), selectinload(PracticeSession.song))
        .where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == current_user.id,
            PracticeSession.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    recordings = [_recording_to_response(r) for r in session.recordings if r.deleted_at is None]
    return PracticeSessionDetailResponse(
        **PracticeSessionResponse.model_validate(session).model_dump(),
        song=SongResponse.model_validate(session.song),
        recordings=recordings,
    )


@router.patch("/{session_id}", response_model=PracticeSessionResponse)
async def update_session(
    session_id: int,
    body: PracticeSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == current_user.id,
            PracticeSession.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(session, k, v)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession).where(
            PracticeSession.id == session_id,
            PracticeSession.user_id == current_user.id,
            PracticeSession.deleted_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    now = datetime.now(timezone.utc)
    session.deleted_at = now
    # Cascade soft-delete to recordings
    recordings = (await db.execute(
        select(Recording).where(Recording.practice_session_id == session_id, Recording.deleted_at.is_(None))
    )).scalars().all()
    for r in recordings:
        r.deleted_at = now
    await db.commit()
