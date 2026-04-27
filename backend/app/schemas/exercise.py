from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.exercise import ExerciseMediaType


class ExerciseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    media_type: ExerciseMediaType
    media_url: Optional[str] = None  # for weblink


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class BpmLogCreate(BaseModel):
    bpm: int
    notes: Optional[str] = None


class BpmLogResponse(BaseModel):
    id: int
    exercise_id: int
    bpm: int
    logged_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


class BpmHistoryResponse(BaseModel):
    items: List[BpmLogResponse]
    last_bpm: Optional[int]


class ExerciseResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    media_type: ExerciseMediaType
    media_url: Optional[str]
    file_url: Optional[str] = None  # computed in router
    last_bpm: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
