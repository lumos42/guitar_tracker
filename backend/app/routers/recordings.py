from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.practice_session import PracticeSession
from app.models.song import Song
from app.models.recording import Recording, RecordingSection
from app.schemas.recording import RecordingResponse, RecordingUpdate
from app.services.storage_service import save_file, delete_file, get_file_url

router = APIRouter(prefix="/recordings", tags=["recordings"])


def _to_response(r: Recording) -> RecordingResponse:
    resp = RecordingResponse.model_validate(r)
    resp.stream_url = get_file_url(r.file_path)
    return resp


@router.get("/songs/{song_id}", response_model=list[RecordingResponse])
async def list_song_recordings(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    song = (await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    result = await db.execute(
        select(Recording)
        .join(PracticeSession, Recording.practice_session_id == PracticeSession.id)
        .where(
            PracticeSession.song_id == song_id,
            Recording.user_id == current_user.id,
            Recording.deleted_at.is_(None),
            PracticeSession.deleted_at.is_(None),
        )
        .order_by(Recording.created_at.desc())
    )
    return [_to_response(r) for r in result.scalars().all()]


@router.post("/songs/{song_id}", response_model=RecordingResponse, status_code=201)
async def upload_song_recording(
    song_id: int,
    speed_percent: Optional[int] = Form(default=None),
    section: RecordingSection = Form(default=RecordingSection.full),
    label: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    song = (await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    now = datetime.now(timezone.utc)
    session = PracticeSession(
        user_id=current_user.id,
        song_id=song_id,
        practiced_at=now,
        notes="Auto-created from song recording",
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    await db.flush()

    file_path, file_size = await save_file(file, "recordings", current_user.id)
    recording = Recording(
        user_id=current_user.id,
        practice_session_id=session.id,
        file_path=file_path,
        mime_type=file.content_type,
        file_size_bytes=file_size,
        speed_percent=speed_percent,
        section=section,
        recorded_at=now,
        label=label,
        created_at=now,
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    return _to_response(recording)


@router.post("", response_model=RecordingResponse, status_code=201)
async def upload_recording(
    practice_session_id: int = Form(...),
    speed_percent: Optional[int] = Form(default=None),
    section: RecordingSection = Form(default=RecordingSection.full),
    label: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify session belongs to user
    session = (await db.execute(
        select(PracticeSession).where(
            PracticeSession.id == practice_session_id,
            PracticeSession.user_id == current_user.id,
            PracticeSession.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Practice session not found")

    file_path, file_size = await save_file(file, "recordings", current_user.id)
    now = datetime.now(timezone.utc)
    recording = Recording(
        user_id=current_user.id,
        practice_session_id=practice_session_id,
        file_path=file_path,
        mime_type=file.content_type,
        file_size_bytes=file_size,
        speed_percent=speed_percent,
        section=section,
        recorded_at=now,
        label=label,
        created_at=now,
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    return _to_response(recording)


@router.get("/{recording_id}", response_model=RecordingResponse)
async def get_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(
        select(Recording).where(
            Recording.id == recording_id,
            Recording.user_id == current_user.id,
            Recording.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recording not found")
    return _to_response(r)


@router.patch("/{recording_id}", response_model=RecordingResponse)
async def update_recording(
    recording_id: int,
    body: RecordingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(
        select(Recording).where(
            Recording.id == recording_id,
            Recording.user_id == current_user.id,
            Recording.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recording not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return _to_response(r)


@router.delete("/{recording_id}", status_code=204)
async def delete_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(
        select(Recording).where(
            Recording.id == recording_id,
            Recording.user_id == current_user.id,
            Recording.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recording not found")
    r.deleted_at = datetime.now(timezone.utc)
    await db.commit()
