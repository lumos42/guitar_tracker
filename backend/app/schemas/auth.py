from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
