import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select, func, and_
from datetime import datetime, timezone
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.song import Song
from app.models.practice_session import PracticeSession
from app.models.recording import Recording
from app.schemas.song import SongCreate, SongUpdate, SongResponse, SongDetailResponse, SongStats
from app.utils.pagination import PageResponse
from app.config import settings

router = APIRouter(prefix="/songs", tags=["songs"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PageResponse[SongResponse])
async def list_songs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = and_(Song.user_id == current_user.id, Song.deleted_at.is_(None))
    if q:
        like = f"%{q}%"
        base = and_(base, (Song.title.ilike(like) | Song.artist.ilike(like)))

    total_result = await db.execute(select(func.count()).select_from(Song).where(base))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Song).where(base).order_by(Song.updated_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )
    songs = result.scalars().all()
    return PageResponse(items=songs, total=total, page=page, limit=limit)


@router.post("", response_model=SongResponse, status_code=201)
async def create_song(
    body: SongCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    song = Song(**body.model_dump(), user_id=current_user.id)
    db.add(song)
    await db.commit()
    await db.refresh(song)
    return song


@router.get("/{song_id}", response_model=SongDetailResponse)
async def get_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )
    song = result.scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    sessions_q = await db.execute(
        select(func.count()).select_from(PracticeSession).where(
            PracticeSession.song_id == song_id, PracticeSession.deleted_at.is_(None)
        )
    )
    recordings_q = await db.execute(
        select(func.count()).select_from(Recording)
        .join(PracticeSession, Recording.practice_session_id == PracticeSession.id)
        .where(PracticeSession.song_id == song_id, Recording.deleted_at.is_(None))
    )
    last_q = await db.execute(
        select(func.max(PracticeSession.practiced_at)).where(
            PracticeSession.song_id == song_id, PracticeSession.deleted_at.is_(None)
        )
    )
    stats = SongStats(
        total_sessions=sessions_q.scalar_one(),
        total_recordings=recordings_q.scalar_one(),
        last_practiced_at=last_q.scalar_one(),
    )
    return SongDetailResponse(**SongResponse.model_validate(song).model_dump(), stats=stats)


@router.patch("/{song_id}", response_model=SongResponse)
async def update_song(
    song_id: int,
    body: SongUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )
    song = result.scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(song, k, v)
    await db.commit()
    await db.refresh(song)
    return song


@router.delete("/{song_id}", status_code=204)
async def delete_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )
    song = result.scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")
    song.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def _run_spotdl_download(
    song_id: int,
    user_id: int,
    spotify_track_id: str,
    session_factory: async_sessionmaker,
) -> None:
    """Background task: run spotdl and update song download_status."""
    logger.info(
        "Download task started",
        extra={
            "song_id": song_id,
            "user_id": user_id,
            "spotify_track_id": spotify_track_id,
        },
    )
    output_dir = settings.UPLOAD_DIR / "songs" / str(user_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Ensured output directory exists: %s", output_dir)

    async def _set_status(db: AsyncSession, s: str, file_path: Optional[str] = None) -> None:
        logger.info(
            "Setting song download status",
            extra={
                "song_id": song_id,
                "status": s,
                "file_path": file_path,
            },
        )
        result = await db.execute(select(Song).where(Song.id == song_id))
        song = result.scalar_one_or_none()
        if song:
            song.download_status = s
            if file_path:
                song.local_file_path = file_path
            await db.commit()
            logger.info(
                "Committed song download status update",
                extra={
                    "song_id": song_id,
                    "status": s,
                    "file_path": file_path,
                },
            )
        else:
            logger.warning(
                "Song not found while setting download status",
                extra={"song_id": song_id, "status": s},
            )

    async with session_factory() as db:
        await _set_status(db, "downloading")

    query = f"spotify:track:{spotify_track_id}"
    logger.info(
        "Launching spotdl process",
        extra={
            "song_id": song_id,
            "query": query,
            "output_dir": str(output_dir),
        },
    )
    try:
        proc = await asyncio.create_subprocess_exec(
            "spotdl",
            "download",
            query,
            "--output", str(output_dir),
            "--format", "mp3",
            "--bitrate", "128k",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        stdout_text = stdout.decode(errors="replace")
        stderr_text = stderr.decode(errors="replace")
        logger.info(
            "spotdl process completed",
            extra={
                "song_id": song_id,
                "return_code": proc.returncode,
                "stdout_preview": stdout_text[:1000],
                "stderr_preview": stderr_text[:1000],
            },
        )

        if proc.returncode != 0:
            raise RuntimeError(stderr_text)

        # Find the most recently created mp3 in the output dir
        mp3_files = sorted(output_dir.glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
        logger.info(
            "Scanned output directory for mp3 files",
            extra={"song_id": song_id, "found_count": len(mp3_files)},
        )
        if not mp3_files:
            raise RuntimeError("spotdl completed but no mp3 file found")

        relative_path = f"songs/{user_id}/{mp3_files[0].name}"
        logger.info(
            "Download successful",
            extra={"song_id": song_id, "relative_path": relative_path},
        )
        async with session_factory() as db:
            await _set_status(db, "downloaded", relative_path)

    except Exception:
        logger.exception(
            "Download task failed",
            extra={
                "song_id": song_id,
                "user_id": user_id,
                "spotify_track_id": spotify_track_id,
            },
        )
        async with session_factory() as db:
            await _set_status(db, "failed")


@router.post("/{song_id}/download", response_model=SongResponse)
async def download_song(
    song_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        "Download endpoint called",
        extra={"song_id": song_id, "user_id": current_user.id},
    )
    result = await db.execute(
        select(Song).where(Song.id == song_id, Song.user_id == current_user.id, Song.deleted_at.is_(None))
    )
    song = result.scalar_one_or_none()
    if not song:
        logger.warning(
            "Download requested for missing song",
            extra={"song_id": song_id, "user_id": current_user.id},
        )
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    if not song.spotify_track_id:
        logger.warning(
            "Download requested for song without spotify_track_id",
            extra={"song_id": song_id, "user_id": current_user.id},
        )
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Song has no Spotify track ID")

    if song.download_status in ("downloading", "pending"):
        logger.info(
            "Download already in progress, returning existing song state",
            extra={
                "song_id": song_id,
                "user_id": current_user.id,
                "download_status": song.download_status,
            },
        )
        return song

    song.download_status = "pending"
    await db.commit()
    await db.refresh(song)
    logger.info(
        "Marked song download as pending",
        extra={"song_id": song_id, "user_id": current_user.id},
    )

    from app.database import get_session_factory  # noqa: PLC0415
    sf = get_session_factory()
    background_tasks.add_task(
        _run_spotdl_download,
        song_id=song.id,
        user_id=current_user.id,
        spotify_track_id=song.spotify_track_id,
        session_factory=sf,
    )
    logger.info(
        "Queued background download task",
        extra={"song_id": song.id, "user_id": current_user.id},
    )

    return song
