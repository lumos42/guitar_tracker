from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncEngine
from typing import AsyncGenerator, Optional
from app.config import settings

_engine: Optional[AsyncEngine] = None
_session_factory = None


def _get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            echo=not settings.is_production,
            connect_args={"check_same_thread": False},
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker:
    _get_engine()
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    _get_engine()
    async with _session_factory() as session:
        yield session


async def init_db() -> None:
    from app.models.base import Base
    import app.models  # noqa: F401 — ensure all models are registered
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _reset_stale_downloads()


async def _reset_stale_downloads() -> None:
    """On startup, any download that was in-flight when the server last died gets reset to failed."""
    from sqlalchemy import update
    from app.models.song import Song
    async with _session_factory() as session:
        await session.execute(
            update(Song)
            .where(Song.download_status.in_(["pending", "downloading"]))
            .values(download_status="failed")
        )
        await session.commit()


async def close_db() -> None:
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
