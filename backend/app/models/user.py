from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from datetime import datetime
from typing import Optional, List


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    google_sub: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    songs: Mapped[List["Song"]] = relationship("Song", back_populates="user", lazy="select")
    practice_sessions: Mapped[List["PracticeSession"]] = relationship("PracticeSession", back_populates="user", lazy="select")
    recordings: Mapped[List["Recording"]] = relationship("Recording", back_populates="user", lazy="select")
    exercises: Mapped[List["Exercise"]] = relationship("Exercise", back_populates="user", lazy="select")
    bookmarks: Mapped[List["Bookmark"]] = relationship("Bookmark", back_populates="user", lazy="select")
