export interface User {
  id: number
  email: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type SongDownloadStatus = 'pending' | 'downloading' | 'downloaded' | 'failed' | null

export interface Song {
  id: number
  title: string
  artist: string
  album: string | null
  album_art_url: string | null
  duration_ms: number | null
  notes: string | null
  spotify_track_id: string | null
  download_status: SongDownloadStatus
  download_started_at: string | null
  audio_url: string | null
  last_accessed_at: string | null
  created_at: string
  updated_at: string
}

export interface DownloadStatus {
  song_id: number
  download_status: SongDownloadStatus
  download_started_at: string | null
  elapsed_seconds: number | null
}

export interface PracticeSession {
  id: number
  song_id: number
  song?: Song
  practiced_at: string
  duration_seconds: number | null
  notes: string | null
  recordings?: Recording[]
  created_at: string
}

export type RecordingSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'full'

export interface Recording {
  id: number
  practice_session_id: number
  file_path: string
  mime_type: string
  file_size_bytes: number
  duration_seconds: number | null
  speed_percent: number | null
  section: RecordingSection
  recorded_at: string
  label: string | null
  created_at?: string
  stream_url?: string
}

export interface ChordChart {
  id: number
  song_id: number
  mime_type: string
  file_size_bytes: number
  label: string | null
  created_at: string
  view_url: string
}

export type ExerciseMediaType = 'image' | 'video' | 'weblink'

export interface ExerciseBpmLog {
  id: number
  exercise_id: number
  bpm: number
  logged_at: string
}

export interface Exercise {
  id: number
  name: string
  description: string | null
  media_type: ExerciseMediaType
  media_url: string | null
  file_url?: string | null
  last_bpm: number | null
  bpm_logs?: ExerciseBpmLog[]
  created_at: string
  updated_at?: string
}

export type BookmarkType = 'youtube' | 'weblink' | 'photo'

export interface Bookmark {
  id: number
  type: BookmarkType
  title: string
  url: string | null
  file_path: string | null
  notes: string | null
  created_at: string
}

export interface SpotifyTrack {
  id: string
  name: string
  artist: string
  album: string
  album_art_url: string | null
  duration_ms: number
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
