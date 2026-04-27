from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.song import SongResponse


class PracticeSessionCreate(BaseModel):
    song_id: int
    practiced_at: Optional[datetime] = None
    notes: Optional[str] = None


class PracticeSessionUpdate(BaseModel):
    notes: Optional[str] = None
    duration_seconds: Optional[int] = None


class PracticeSessionResponse(BaseModel):
    id: int
    song_id: int
    practiced_at: datetime
    duration_seconds: Optional[int]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PracticeSessionDetailResponse(PracticeSessionResponse):
    song: SongResponse
    recordings: List["RecordingResponse"] = []


from app.schemas.recording import RecordingResponse  # noqa: E402
PracticeSessionDetailResponse.model_rebuild()
