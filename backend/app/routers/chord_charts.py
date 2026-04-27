from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional, List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.song import Song
from app.models.chord_chart import ChordChart
from app.schemas.chord_chart import ChordChartResponse
from app.services.storage_service import save_file, delete_file, get_file_url

router = APIRouter(tags=["chord-charts"])


def _to_response(c: ChordChart) -> ChordChartResponse:
    resp = ChordChartResponse.model_validate(c)
    resp.view_url = get_file_url(c.file_path)
    return resp


@router.get("/songs/{song_id}/chord-charts", response_model=List[ChordChartResponse])
async def list_chord_charts(
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
        select(ChordChart).where(
            ChordChart.song_id == song_id,
            ChordChart.user_id == current_user.id,
            ChordChart.deleted_at.is_(None),
        ).order_by(ChordChart.created_at.desc())
    )
    return [_to_response(c) for c in result.scalars().all()]


@router.post("/songs/{song_id}/chord-charts", response_model=ChordChartResponse, status_code=201)
async def upload_chord_chart(
    song_id: int,
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

    file_path, file_size = await save_file(file, "chord_charts", current_user.id)
    now = datetime.now(timezone.utc)
    chart = ChordChart(
        user_id=current_user.id,
        song_id=song_id,
        file_path=file_path,
        mime_type=file.content_type,
        file_size_bytes=file_size,
        label=label,
        created_at=now,
    )
    db.add(chart)
    await db.commit()
    await db.refresh(chart)
    return _to_response(chart)


@router.delete("/chord-charts/{chart_id}", status_code=204)
async def delete_chord_chart(
    chart_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chart = (await db.execute(
        select(ChordChart).where(
            ChordChart.id == chart_id,
            ChordChart.user_id == current_user.id,
            ChordChart.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if not chart:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chord chart not found")
    chart.deleted_at = datetime.now(timezone.utc)
    await db.commit()
