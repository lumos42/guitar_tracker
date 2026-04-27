from sqlalchemy import Text, ForeignKey, DateTime, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from datetime import datetime
from typing import Optional, List


class PracticeSession(Base, TimestampMixin):
    __tablename__ = "practice_sessions"
    __table_args__ = (
        Index("ix_practice_sessions_user_date", "user_id", "practiced_at"),
        Index("ix_practice_sessions_user_song", "user_id", "song_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id"), nullable=False, index=True)
    practiced_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="practice_sessions")
    song: Mapped["Song"] = relationship("Song", back_populates="practice_sessions")
    recordings: Mapped[List["Recording"]] = relationship("Recording", back_populates="practice_session", lazy="select")
