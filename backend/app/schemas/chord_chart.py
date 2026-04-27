from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ChordChartResponse(BaseModel):
    id: int
    song_id: int
    mime_type: str
    file_size_bytes: int
    label: Optional[str]
    created_at: datetime
    view_url: str = ""

    model_config = {"from_attributes": True}
