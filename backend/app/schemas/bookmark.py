from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.bookmark import BookmarkType


class BookmarkUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None


class BookmarkResponse(BaseModel):
    id: int
    type: BookmarkType
    title: str
    url: Optional[str]
    file_url: Optional[str] = None  # computed in router
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
