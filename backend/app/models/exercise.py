from sqlalchemy import String, Text, ForeignKey, DateTime, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from datetime import datetime
from typing import Optional, List
import enum


class ExerciseMediaType(str, enum.Enum):
    image = "image"
    video = "video"
    weblink = "weblink"


class Exercise(Base, TimestampMixin):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_type: Mapped[ExerciseMediaType] = mapped_column(SAEnum(ExerciseMediaType), nullable=False)
    media_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_bpm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="exercises")
    bpm_logs: Mapped[List["ExerciseBpmLog"]] = relationship("ExerciseBpmLog", back_populates="exercise", lazy="select", order_by="ExerciseBpmLog.logged_at.desc()")
