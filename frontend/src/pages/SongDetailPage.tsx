import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Music2, Clock, Trash2, ChevronRight, Download, AlertCircle, FileMusic, Mic, Square, Pencil, Play, Pause, Share2 } from 'lucide-react'
import {
  useSong,
  useDownloadSong,
  useUpdateSong,
  useSongChordCharts,
  useUploadChordChart,
  useSongRecordings,
  useUploadSongRecording,
} from '@/hooks/useSongs'
import { usePracticeSessions, useDeletePracticeSession } from '@/hooks/usePractice'
import { useAuthenticatedMediaUrl } from '@/hooks/useAuthenticatedMediaUrl'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { SongPlayer } from '@/components/SongPlayer'
import { formatRelative, formatDuration } from '@/lib/utils'
import type { Recording } from '@/types'

function SongNotesModal({
  songNotes,
  open,
  onClose,
  onSave,
  isSaving,
}: {
  songNotes: string | null
  open: boolean
  onClose: () => void
  onSave: (nextNotes: string) => void
  isSaving: boolean
}) {
  const [notes, setNotes] = useState(songNotes ?? '')

  useEffect(() => {
    if (open) setNotes(songNotes ?? '')
  }, [open, songNotes])

  return (
    <Modal open={open} onClose={onClose} title="Song notes">
      <div className="flex flex-col gap-4">
        <textarea
          rows={5}
          placeholder="Add practice notes, reminders, tricky sections..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-[15px] focus:outline-none transition-colors resize-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)', color: 'var(--text-primary)' }}
        />
        <Button type="button" size="lg" className="w-full" disabled={isSaving} onClick={() => onSave(notes)}>
          {isSaving ? <Spinner className="w-4 h-4" /> : 'Save Notes'}
        </Button>
      </div>
    </Modal>
  )
}

function RecordingPlayer({ recording }: { recording: Recording }) {
  const { data: mediaUrl, isLoading } = useAuthenticatedMediaUrl(recording.stream_url)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSharing, setIsSharing] = useState(false)

  const formatAudioTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!recording.stream_url) return null

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Spinner className="w-3 h-3" />
        <span>Loading recording…</span>
      </div>
    )
  }

  if (!mediaUrl) {
    return (
      <p className="text-xs" style={{ color: 'var(--danger)' }}>
        Unable to load recording.
      </p>
    )
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const nextTime = Number(event.target.value)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const shareRecording = async () => {
    if (!mediaUrl || isSharing) return
    setIsSharing(true)
    try {
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const extension = blob.type.includes('mp3')
        ? 'mp3'
        : blob.type.includes('wav')
          ? 'wav'
          : blob.type.includes('ogg')
            ? 'ogg'
            : 'webm'
      const baseName = (recording.label || `take-${recording.id}`)
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        || `take-${recording.id}`
      const file = new File([blob], `${baseName}.${extension}`, {
        type: blob.type || 'audio/webm',
      })

      if (navigator.share) {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: recording.label || `Take ${recording.id}`,
            text: 'Shared from Guitar Tracker',
            files: [file],
          })
          return
        }
        await navigator.share({
          title: recording.label || `Take ${recording.id}`,
          text: 'Shared from Guitar Tracker',
        })
        return
      }

      const downloadUrl = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.name
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div
      className="rounded-2xl px-3 py-2.5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <audio
        ref={audioRef}
        src={mediaUrl}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
          aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
        </button>

        <button
          type="button"
          onClick={shareRecording}
          disabled={isSharing}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
          aria-label="Share recording"
          title="Share recording"
        >
          <Share2 size={15} />
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex items-center justify-between text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>()
  const songId = Number(id)
  const navigate = useNavigate()
  const [notesOpen, setNotesOpen] = useState(false)
  const [chartLabel, setChartLabel] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const isDownloading = (status: string | null | undefined) =>
    status === 'pending' || status === 'downloading'

  const { data: song, isLoading: songLoading } = useSong(songId, true)
  const { data: sessions, isLoading: sessionsLoading } = usePracticeSessions(songId)
  const { data: chordCharts, isLoading: chartsLoading } = useSongChordCharts(songId)
  const { data: recordings, isLoading: recordingsLoading } = useSongRecordings(songId)
  const deleteSession = useDeletePracticeSession()
  const downloadSong = useDownloadSong()
  const updateSong = useUpdateSong()
  const uploadChordChart = useUploadChordChart(songId)
  const uploadSongRecording = useUploadSongRecording(songId)

  if (songLoading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!song) return null

  const totalTime = sessions?.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) ?? 0
  const recordingTime = recordings?.reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0) ?? 0

  const saveNotes = (nextNotes: string) => {
    updateSong.mutate(
      { id: songId, data: { notes: nextNotes.trim() || null } },
      { onSuccess: () => setNotesOpen(false) }
    )
  }

  const handleChordChartUpload = (file: File | null) => {
    if (!file) return
    uploadChordChart.mutate({ file, label: chartLabel || undefined })
    setChartLabel('')
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const preferredMimeTypes = [
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ]
      const selectedMimeType = preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const recordingMimeType = mediaRecorder.mimeType || selectedMimeType || chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: recordingMimeType })
        uploadSongRecording.mutate({ file: blob })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setIsRecording(false)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="relative">
        {song.album_art_url ? (
          <img
            src={song.album_art_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl"
            style={{ opacity: 0.25 }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, oklch(0.80 0.175 72 / 0.1), transparent 70%)' }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, oklch(0.09 0.006 50 / 0.4), var(--bg-base))' }}
        />

        <div className="relative z-10 px-5 pt-14 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-8 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>Songs</span>
          </button>

          <div className="flex items-end gap-5">
            {song.album_art_url ? (
              <img
                src={song.album_art_url}
                alt={song.title}
                className="w-24 h-24 rounded-2xl object-cover shadow-2xl flex-shrink-0"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-2xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <Music2 size={32} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h1
                className="text-2xl font-black leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                {song.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{song.artist}</p>
              {song.album && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{song.album}</p>
              )}

              {song.spotify_track_id && song.download_status !== 'downloaded' && (
                <div className="mt-3">
                  {isDownloading(song.download_status) ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="w-3 h-3" />
                      <span
                        className="text-xs font-semibold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
                      >
                        {song.download_status === 'pending' ? 'Starting download…' : 'Downloading…'}
                      </span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={song.download_status === 'failed' ? 'secondary' : 'primary'}
                      onClick={() => downloadSong.mutate(songId)}
                      disabled={downloadSong.isPending}
                    >
                      {song.download_status === 'failed' ? (
                        <><AlertCircle size={13} /> Retry Download</>
                      ) : (
                        <><Download size={13} /> Download Song</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-3xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {sessions?.length ?? 0}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>sessions</p>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-3xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {formatDuration(totalTime)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>total</p>
          </div>
        </div>

        {song.download_status === 'downloaded' && song.audio_url && (
          <div className="mb-8">
            <SongPlayer audioUrl={song.audio_url} title={song.title} />
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xs font-bold uppercase tracking-[0.1em]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Practice Sessions
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>History</span>
        </div>

        {sessionsLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !sessions?.length ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <Clock size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
            <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
              No sessions yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Song recordings will appear here as session history.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="w-full text-left"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.99]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-[15px]"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                    >
                      {formatRelative(session.practiced_at)}
                    </p>
                    {session.notes && (
                      <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {session.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {session.duration_seconds && (
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
                      >
                        {formatDuration(session.duration_seconds)}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession.mutate(session.id) }}
                      className="transition-colors p-1"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
            >
              Notes
            </p>
            <Button size="sm" variant="secondary" onClick={() => setNotesOpen(true)}>
              <Pencil size={13} /> Write Notes
            </Button>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {song.notes || 'No notes yet.'}
          </p>
        </div>

        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Chord Charts
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={chartLabel}
              onChange={(e) => setChartLabel(e.target.value)}
              placeholder="Optional label"
              className="flex-1 h-10 px-3 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', color: 'var(--text-primary)' }}
            />
            <label>
              <input type="file" className="hidden" onChange={(e) => handleChordChartUpload(e.target.files?.[0] ?? null)} />
              <span className="inline-flex items-center gap-2 px-3 h-10 rounded-xl cursor-pointer" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                <FileMusic size={14} /> Upload
              </span>
            </label>
          </div>
          {chartsLoading ? <Spinner className="w-4 h-4" /> : !chordCharts?.length ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No chord charts yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {chordCharts.map((chart) => (
                <a
                  key={chart.id}
                  href={chart.view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {chart.label || `Chord chart ${new Date(chart.created_at).toLocaleDateString()}`}
                </a>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
            >
              Song Recordings
            </p>
            <Button
              size="sm"
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              disabled={uploadSongRecording.isPending}
            >
              {isRecording ? <><Square size={13} /> Stop</> : <><Mic size={13} /> Record</>}
            </Button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Total recorded: {formatDuration(Math.round(recordingTime))}
          </p>
          {recordingsLoading ? <Spinner className="w-4 h-4" /> : !recordings?.length ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No recordings yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recordings.map((recording) => (
                <div key={recording.id} className="rounded-xl p-3" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)' }}>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {recording.label || `Take ${recording.id}`}
                  </p>
                  <RecordingPlayer recording={recording} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SongNotesModal
        songNotes={song.notes}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        onSave={saveNotes}
        isSaving={updateSong.isPending}
      />
    </div>
  )
}
