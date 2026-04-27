---
name: Guitar Tracker project state
description: Current build status and what's been completed vs. what's next
type: project
---

Backend is complete (9/9 tests pass). Frontend scaffold and full UI implemented.

## Backend (complete)
- FastAPI + SQLAlchemy async
- Auth: Google OAuth + JWT (access + refresh tokens)
- Routers: songs, practice_sessions, recordings, exercises (BPM logs), bookmarks, spotify, files
- Alembic migrations ready

## Frontend (complete)
- React + Vite + TypeScript in `/frontend`
- Capacitor configured for iOS/Android (`capacitor.config.ts`, web-dir=dist)
- Tailwind v4 via `@tailwindcss/vite`
- Routing: react-router-dom v6
- State: Zustand (auth store with persist)
- Data fetching: TanStack Query
- HTTP: Axios with JWT interceptor + auto-refresh

### Pages built
- `/login` — Google OAuth CTA
- `/auth/callback` — token exchange
- `/` — Home (hero with last-practiced song, stats, recent sessions)
- `/songs` — list with Spotify search add flow
- `/songs/:id` — song detail with sessions + stats, song notes editor, chord chart uploads, and in-page audio recording
- `/sessions/:id` — session detail with recordings
- `/exercises` — BPM tracker (PR detection)
- `/bookmarks` — YouTube / links / photos

### Design system
- Design context saved to `.impeccable.md`
- Fonts: Archivo (display/headings) + Hanken Grotesk (body) via Google Fonts
- OKLCH color tokens in `index.css` (warm guitar-gold accent ~oklch(0.80 0.175 72))
- Stagger entrance animations, bottom-sheet modals, mobile-first layout

## Still needed
- `.env` setup for backend (DATABASE_URL, Google OAuth creds, Spotify creds, JWT_SECRET)
- Database migration: `alembic upgrade head`
- Capacitor platform add: `npx cap add ios` / `npx cap add android`
- Wire auth callback URL in Google Cloud Console → `/auth/callback`

## Latest updates (Apr 21, 2026)
- Removed the `Log Session` CTA from song detail and replaced it with a `Write Notes` action that updates `songs.notes`.
- Added chord chart management to song detail (upload + list with file view links).
- Added song-level recording support so users can record while practicing from the song screen and upload directly.
- Backend now mounts `chord_charts` routes and serves `chord_charts` files via `/api/v1/files/...`.

**Why:** Personal guitar practice tracking app for a casual hobbyist. Mobile-first (Capacitor). Album art as hero UI pattern.
