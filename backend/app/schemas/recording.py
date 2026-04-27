from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional
from app.models.recording import RecordingSection
from app.services.storage_service import get_file_url


class RecordingUpdate(BaseModel):
    label: Optional[str] = None
    speed_percent: Optional[int] = None
    section: Optional[RecordingSection] = None


class RecordingResponse(BaseModel):
    id: int
    practice_session_id: int
    mime_type: str
    file_size_bytes: int
    duration_seconds: Optional[float]
    speed_percent: Optional[int]
    section: RecordingSection
    recorded_at: datetime
    label: Optional[str]
    created_at: datetime
    stream_url: str = ""

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def set_stream_url(self) -> "RecordingResponse":
        # stream_url is computed from file_path, which isn't in this schema.
        # Set in the router after construction.
        return self
