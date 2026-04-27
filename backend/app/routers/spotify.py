from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.models.user import User
from app.services.spotify_service import spotify_service

router = APIRouter(prefix="/spotify", tags=["spotify"])


@router.get("/search")
async def search_tracks(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    tracks = await spotify_service.search_tracks(q, limit)
    return tracks
