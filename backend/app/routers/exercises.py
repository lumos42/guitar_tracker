from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.exercise import Exercise, ExerciseMediaType
from app.models.exercise_bpm_log import ExerciseBpmLog
from app.schemas.exercise import (
    ExerciseCreate, ExerciseResponse,
    BpmLogCreate, BpmLogResponse, BpmHistoryResponse,
)
from app.services.storage_service import save_file, get_file_url
from app.utils.pagination import PageResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _to_response(e: Exercise) -> ExerciseResponse:
    resp = ExerciseResponse.model_validate(e)
    if e.file_path:
        resp.file_url = get_file_url(e.file_path)
    return resp


@router.get("", response_model=PageResponse[ExerciseResponse])
async def list_exercises(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    filters = and_(Exercise.user_id == current_user.id, Exercise.deleted_at.is_(None))
    total = (await db.execute(select(func.count()).select_from(Exercise).where(filters))).scalar_one()
    result = await db.execute(
        select(Exercise).where(filters).order_by(Exercise.updated_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    exercises = result.scalars().all()
    return PageResponse(items=[_to_response(e) for e in exercises], total=total, page=page, limit=limit)


@router.post("", response_model=ExerciseResponse, status_code=201)
async def create_exercise(
    name: str = Form(...),
    media_type: ExerciseMediaType = Form(...),
    description: Optional[str] = Form(default=None),
    media_url: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_path = None
    mime_type = None
    file_size = None

    if file:
        file_path, file_size = await save_file(file, "exercises", current_user.id)
        mime_type = file.content_type

    exercise = Exercise(
        user_id=current_user.id,
        name=name,
        description=description,
        media_type=media_type,
        media_url=media_url,
        file_path=file_path,
        mime_type=mime_type,
        file_size_bytes=file_size,
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return _to_response(exercise)


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    e = (await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.user_id == current_user.id,
            Exercise.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    return _to_response(e)


@router.patch("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: int,
    name: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    media_type: Optional[ExerciseMediaType] = Form(default=None),
    media_url: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    e = (await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.user_id == current_user.id,
            Exercise.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    if name is not None:
        e.name = name
    if description is not None:
        e.description = description
    if media_type is not None:
        e.media_type = media_type
    if media_url is not None:
        e.media_url = media_url or None

    if file:
        file_path, file_size = await save_file(file, "exercises", current_user.id)
        e.file_path = file_path
        e.file_size_bytes = file_size
        e.mime_type = file.content_type
        if media_type is None:
            if (file.content_type or "").startswith("image/"):
                e.media_type = ExerciseMediaType.image
            elif (file.content_type or "").startswith("video/"):
                e.media_type = ExerciseMediaType.video

    # If switching to weblink, clear file-backed media fields.
    if media_type == ExerciseMediaType.weblink:
        e.file_path = None
        e.file_size_bytes = None
        e.mime_type = None

    await db.commit()
    await db.refresh(e)
    return _to_response(e)


@router.delete("/{exercise_id}", status_code=204)
async def delete_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    e = (await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.user_id == current_user.id,
            Exercise.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")
    e.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{exercise_id}/bpm", response_model=BpmLogResponse, status_code=201)
async def log_bpm(
    exercise_id: int,
    body: BpmLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    e = (await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.user_id == current_user.id,
            Exercise.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)

    # Compress duplicate logs: same BPM, same exercise, same day -> one record.
    existing_log = (await db.execute(
        select(ExerciseBpmLog).where(
            ExerciseBpmLog.exercise_id == exercise_id,
            ExerciseBpmLog.user_id == current_user.id,
            ExerciseBpmLog.bpm == body.bpm,
            ExerciseBpmLog.logged_at >= start_of_day,
            ExerciseBpmLog.logged_at < end_of_day,
        )
        .order_by(ExerciseBpmLog.logged_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if existing_log:
        existing_log.notes = body.notes or existing_log.notes
        existing_log.logged_at = now
        e.last_bpm = body.bpm
        await db.commit()
        await db.refresh(existing_log)
        return existing_log

    log = ExerciseBpmLog(
        exercise_id=exercise_id,
        user_id=current_user.id,
        bpm=body.bpm,
        notes=body.notes,
        logged_at=now,
    )
    db.add(log)
    e.last_bpm = body.bpm
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{exercise_id}/bpm", response_model=BpmHistoryResponse)
async def get_bpm_history(
    exercise_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    e = (await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.user_id == current_user.id,
            Exercise.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found")

    result = await db.execute(
        select(ExerciseBpmLog)
        .where(ExerciseBpmLog.exercise_id == exercise_id)
        .order_by(ExerciseBpmLog.logged_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return BpmHistoryResponse(items=logs, last_bpm=e.last_bpm)
