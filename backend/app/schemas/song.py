from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional


class SongCreate(BaseModel):
    spotify_track_id: Optional[str] = None
    title: str
    artist: str
    album: Optional[str] = None
    album_art_url: Optional[str] = None
    duration_ms: Optional[int] = None
    notes: Optional[str] = None


class SongUpdate(BaseModel):
    notes: Optional[str] = None


class SongStats(BaseModel):
    total_sessions: int
    total_recordings: int
    last_practiced_at: Optional[datetime]


class SongResponse(BaseModel):
    id: int
    spotify_track_id: Optional[str]
    title: str
    artist: str
    album: Optional[str]
    album_art_url: Optional[str]
    duration_ms: Optional[int]
    notes: Optional[str]
    download_status: Optional[str] = None
    audio_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def build_audio_url(cls, values):
        if hasattr(values, "__dict__"):
            local_file_path = getattr(values, "local_file_path", None)
            if local_file_path:
                values.__dict__["audio_url"] = f"/api/v1/files/{local_file_path}"
            return values
        if isinstance(values, dict):
            local_file_path = values.get("local_file_path")
            if local_file_path:
                values["audio_url"] = f"/api/v1/files/{local_file_path}"
        return values


class SongDetailResponse(SongResponse):
    stats: SongStats
