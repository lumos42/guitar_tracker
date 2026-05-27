import asyncio
import logging
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.practice_session import PracticeSession
from app.models.recording import Recording
from app.models.song import Song
from app.models.user import User
from app.schemas.song import (
    DownloadStatusResponse,
    SongCreate,
    SongDetailResponse,
    SongResponse,
    SongStats,
    SongUpdate,
)
from app.services.spotify_service import spotify_service
from app.services.ytdlp_service import download_mp3_from_search
from app.utils.pagination import PageResponse

router = APIRouter(prefix="/songs", tags=["songs"])
logger = logging.getLogger(__name__)

# Maximum time we'll let a download stay "downloading"/"pending" before treating
# it as a stale lock from a crashed worker and allowing a retry to take over.
DOWNLOAD_STALE_AFTER = timedelta(minutes=10)


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
        select(Song).where(base)
        .order_by(Song.last_accessed_at.desc().nulls_last(), Song.created_at.desc())
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
    if body.spotify_track_id:
        existing = await db.execute(
            select(Song).where(
                Song.user_id == current_user.id,
                Song.spotify_track_id == body.spotify_track_id,
                Song.deleted_at.is_(None),
            )
        )
        song = existing.scalar_one_or_none()
        if song:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={
                    "message": "Song already in your library",
                    "existing_song_id": song.id,
                },
            )

    bpm: Optional[int] = None
    if body.spotify_track_id:
        bpm = await spotify_service.get_track_bpm(body.spotify_track_id)

    now = datetime.now(timezone.utc)
    song = Song(**body.model_dump(), user_id=current_user.id, last_accessed_at=now, bpm=bpm)
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

    if song.spotify_track_id and song.bpm is None:
        bpm = await spotify_service.get_track_bpm(song.spotify_track_id)
        if bpm is not None:
            song.bpm = bpm

    song.last_accessed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(song)

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


async def _run_ytdlp_download(
    song_id: int,
    user_id: int,
    artist: str,
    title: str,
    session_factory: async_sessionmaker,
) -> None:
    """Background task: yt-dlp search + MP3 download, then update song download_status."""
    logger.info(
        "Download task started",
        extra={"song_id": song_id, "user_id": user_id, "artist": artist, "title": title},
    )
    final_dir = settings.UPLOAD_DIR / "songs" / str(user_id)
    final_dir.mkdir(parents=True, exist_ok=True)

    tmp_dir = final_dir / f"tmp_{song_id}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    async def _set_status(db: AsyncSession, s: str, file_path: Optional[str] = None) -> None:
        result = await db.execute(select(Song).where(Song.id == song_id))
        song = result.scalar_one_or_none()
        if song:
            song.download_status = s
            if file_path is not None:
                song.local_file_path = file_path
            await db.commit()
            logger.info("Song %s download_status → %s", song_id, s)
        else:
            logger.warning("Song %s not found while setting download_status=%s", song_id, s)

    async with session_factory() as db:
        await _set_status(db, "downloading")

    query = f"{artist} - {title}"
    log_path = final_dir / f"download_{song_id}.log"
    logger.info("Launching yt-dlp: %r  tmp_dir=%s  log=%s", query, tmp_dir, log_path)

    try:
        downloaded = await asyncio.to_thread(
            download_mp3_from_search,
            query,
            tmp_dir,
            log_path,
            settings.YTDLP_COOKIES_PATH,
            settings.YTDLP_AUDIO_QUALITY,
            settings.YTDLP_DENO_PATH,
            settings.YTDLP_NODE_PATH,
        )

        if log_path.exists():
            captured = log_path.read_text(errors="replace")
            logger.info("yt-dlp finished output_tail=%s", captured[-800:])

        final_path = final_dir / f"{song_id}.mp3"
        downloaded.rename(final_path)
        shutil.rmtree(tmp_dir, ignore_errors=True)

        relative_path = f"songs/{user_id}/{song_id}.mp3"
        logger.info("Download successful: %s", relative_path)
        async with session_factory() as db:
            await _set_status(db, "downloaded", relative_path)

    except Exception:
        logger.exception("Download task failed for song %s", song_id)
        shutil.rmtree(tmp_dir, ignore_errors=True)
        async with session_factory() as db:
            await _set_status(db, "failed")


@router.post("/{song_id}/download", response_model=SongResponse)
async def download_song(
    song_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify the song exists and belongs to the user before attempting to claim
    # the download lock — gives us a clean 404 vs 409 distinction.
    result = await db.execute(
        select(Song).where(
            Song.id == song_id,
            Song.user_id == current_user.id,
            Song.deleted_at.is_(None),
        )
    )
    song = result.scalar_one_or_none()
    if not song:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Song not found")

    # Atomic claim: only flip to "pending" if no other worker has an active lock,
    # OR the existing lock is stale (orphaned by a crashed worker). With multiple
    # gunicorn workers a non-atomic SELECT-then-UPDATE will spawn duplicate yt-dlp
    # jobs, which then race on the same URLs and fail.
    now = datetime.now(timezone.utc)
    stale_cutoff = now - DOWNLOAD_STALE_AFTER

    claim = await db.execute(
        update(Song)
        .where(
            Song.id == song_id,
            Song.user_id == current_user.id,
            Song.deleted_at.is_(None),
            or_(
                Song.download_status.is_(None),
                Song.download_status.notin_(["pending", "downloading"]),
                Song.download_started_at.is_(None),
                Song.download_started_at < stale_cutoff,
            ),
        )
        .values(download_status="pending", download_started_at=now, local_file_path=None)
    )
    await db.commit()

    if claim.rowcount == 0:
        # Another worker already owns an active, non-stale lock. Return current
        # state without spawning a duplicate download job.
        await db.refresh(song)
        logger.info(
            "Download already in progress for song %s (status=%s, started_at=%s)",
            song_id,
            song.download_status,
            song.download_started_at,
        )
        return song

    await db.refresh(song)
    logger.info(
        "Claimed download for song %s (%s - %s)", song_id, song.artist, song.title
    )

    from app.database import get_session_factory  # noqa: PLC0415

    sf = get_session_factory()
    background_tasks.add_task(
        _run_ytdlp_download,
        song_id=song.id,
        user_id=current_user.id,
        artist=song.artist,
        title=song.title,
        session_factory=sf,
    )
    return song


@router.get("/{song_id}/download-status", response_model=DownloadStatusResponse)
async def get_download_status(
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
    return DownloadStatusResponse.from_song(song)


@router.get("/{song_id}/download-log")
async def get_download_log(
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

    log_path = settings.UPLOAD_DIR / "songs" / str(current_user.id) / f"download_{song_id}.log"
    if not log_path.exists():
        return {"log": ""}

    text = log_path.read_text(errors="replace")
    # Return last 8 KB to keep it snappy
    return {"log": text[-8192:]}
