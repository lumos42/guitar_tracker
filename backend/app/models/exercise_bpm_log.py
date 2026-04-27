from sqlalchemy import String, ForeignKey, DateTime, Integer, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from datetime import datetime
from typing import Optional


class ExerciseBpmLog(Base):
    __tablename__ = "exercise_bpm_logs"
    __table_args__ = (
        Index("ix_bpm_logs_exercise_date", "exercise_id", "logged_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="bpm_logs")
