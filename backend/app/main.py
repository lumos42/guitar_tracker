from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import init_db, close_db
from app.services.spotify_service import spotify_service
from app.routers import auth, songs, practice_sessions, recordings, exercises, bookmarks, spotify, files, chord_charts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.SPOTIFY_CLIENT_ID:
        await spotify_service.init_token()
    yield
    await close_db()


app = FastAPI(
    title="Guitar Tracker API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.CORS_ORIGINS,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(songs.router, prefix=PREFIX)
app.include_router(practice_sessions.router, prefix=PREFIX)
app.include_router(recordings.router, prefix=PREFIX)
app.include_router(exercises.router, prefix=PREFIX)
app.include_router(bookmarks.router, prefix=PREFIX)
app.include_router(spotify.router, prefix=PREFIX)
app.include_router(files.router, prefix=PREFIX)
app.include_router(chord_charts.router, prefix=PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
