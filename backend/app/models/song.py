from sqlalchemy import String, Text, ForeignKey, DateTime, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from datetime import datetime
from typing import Optional, List


class Song(Base, TimestampMixin):
    __tablename__ = "songs"
    __table_args__ = (
        Index("ix_songs_user_spotify", "user_id", "spotify_track_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    spotify_track_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    artist: Mapped[str] = mapped_column(String(255), nullable=False)
    album: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    album_art_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    download_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    local_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="songs")
    practice_sessions: Mapped[List["PracticeSession"]] = relationship("PracticeSession", back_populates="song", lazy="select")
    chord_charts: Mapped[List["ChordChart"]] = relationship("ChordChart", back_populates="song", lazy="select")
