from sqlalchemy import String, ForeignKey, DateTime, Integer, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from datetime import datetime
from typing import Optional
import enum


class RecordingSection(str, enum.Enum):
    intro = "intro"
    verse = "verse"
    chorus = "chorus"
    bridge = "bridge"
    solo = "solo"
    outro = "outro"
    full = "full"


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    practice_session_id: Mapped[int] = mapped_column(ForeignKey("practice_sessions.id"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    section: Mapped[RecordingSection] = mapped_column(
        SAEnum(RecordingSection), nullable=False, default=RecordingSection.full
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="recordings")
    practice_session: Mapped["PracticeSession"] = relationship("PracticeSession", back_populates="recordings")
