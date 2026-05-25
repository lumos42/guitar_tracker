import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Music2, Download, AlertCircle, FileMusic, Mic, Square, Pencil, Play, Pause, Share2 } from 'lucide-react'
import {
  useSong,
  useDownloadSong,
  useDownloadStatus,
  useDownloadLog,
  useUpdateSong,
  useSongChordCharts,
  useUploadChordChart,
  useSongRecordings,
  useUploadSongRecording,
} from '@/hooks/useSongs'
import { useAuthenticatedMediaUrl } from '@/hooks/useAuthenticatedMediaUrl'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { SongPlayer } from '@/components/SongPlayer'
import type { ChordChart, Recording, Song } from '@/types'

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
      const extension = blob.type.includes('mp3') || blob.type.includes('mpeg')
        ? 'mp3'
        : blob.type.includes('wav')
          ? 'wav'
          : blob.type.includes('ogg')
            ? 'ogg'
            : blob.type.includes('mp4')
              ? 'm4a'
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

function ChordChartItem({ chart }: { chart: ChordChart }) {
  const { data: blobUrl, isLoading } = useAuthenticatedMediaUrl(chart.view_url)
  const label = chart.label || `Chord chart ${new Date(chart.created_at).toLocaleDateString()}`

  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <Spinner className="w-3 h-3" />
        {label}
      </span>
    )
  }

  return (
    <a
      href={blobUrl ?? '#'}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium underline underline-offset-2"
      style={{ color: 'var(--accent)' }}
    >
      {label}
    </a>
  )
}

function SongAudioPlayer({ song }: { song: Song }) {
  const { data: blobUrl, isLoading } = useAuthenticatedMediaUrl(
    song.download_status === 'downloaded' && song.audio_url ? song.audio_url : undefined
  )

  if (song.download_status !== 'downloaded' || !song.audio_url) return null

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Spinner className="w-3 h-3" />
        <span>Loading audio…</span>
      </div>
    )
  }

  if (!blobUrl) return null

  return <SongPlayer audioUrl={blobUrl} title={song.title} />
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

  const isActiveDownload = (status: string | null | undefined) =>
    status === 'pending' || status === 'downloading'

  const { data: song, isLoading: songLoading } = useSong(songId)
  const isDownloading = isActiveDownload(song?.download_status)
  const { data: dlStatus } = useDownloadStatus(songId, isDownloading)
  const { data: downloadLog } = useDownloadLog(songId, isDownloading)
  const { data: chordCharts, isLoading: chartsLoading } = useSongChordCharts(songId)
  const { data: recordings, isLoading: recordingsLoading } = useSongRecordings(songId)
  const downloadSong = useDownloadSong()
  const updateSong = useUpdateSong()
  const uploadChordChart = useUploadChordChart(songId)
  const uploadSongRecording = useUploadSongRecording(songId)

  if (songLoading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!song) return null

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
      {/* ── Hero ── */}
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

        <div className="relative z-10 px-5 pt-14 pb-6">
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
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-24 flex flex-col gap-5">

        {/* ── Record CTA ── */}
        {isRecording ? (
          <div
            className="flex items-center gap-4 rounded-2xl px-5 py-4"
            style={{ background: 'oklch(0.22 0.04 15)', border: '1px solid oklch(0.45 0.18 15)' }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: 'oklch(0.65 0.22 15)',
                boxShadow: '0 0 8px oklch(0.65 0.22 15)',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
            <span
              className="flex-1 text-sm font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'oklch(0.80 0.12 15)' }}
            >
              Recording…
            </span>
            <button
              type="button"
              onClick={stopRecording}
              disabled={uploadSongRecording.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: 'oklch(0.45 0.18 15)',
                color: 'oklch(0.96 0.01 15)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploadSongRecording.isPending}
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <Mic size={18} />
            Record a take
          </button>
        )}

        {/* ── Download / progress (only when not downloaded) ── */}
        {song.download_status !== 'downloaded' && (
          <div>
            {isDownloading ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Spinner className="w-3 h-3" />
                  <span
                    className="text-xs font-semibold"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
                  >
                    {song.download_status === 'pending' ? 'Starting download…' : 'Downloading…'}
                  </span>
                  {dlStatus?.elapsed_seconds != null && dlStatus.elapsed_seconds > 0 && (
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      ({dlStatus.elapsed_seconds < 60
                        ? `${dlStatus.elapsed_seconds}s`
                        : `${Math.floor(dlStatus.elapsed_seconds / 60)}m ${dlStatus.elapsed_seconds % 60}s`})
                    </span>
                  )}
                </div>
                {downloadLog && (
                  <pre
                    className="text-[10px] rounded-lg px-2.5 py-2 overflow-x-auto max-h-28 overflow-y-auto leading-relaxed"
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-base)',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {downloadLog || 'Waiting for spotdl output…'}
                  </pre>
                )}
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

        {/* ── Song player ── */}
        <SongAudioPlayer song={song} />

        {/* ── Recordings (Takes) ── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Takes
          </p>
          {recordingsLoading ? (
            <Spinner className="w-4 h-4" />
          ) : !recordings?.length ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No recordings yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recordings.map((recording) => (
                <div key={recording.id}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                    {recording.label || `Take ${recording.id}`}
                  </p>
                  <RecordingPlayer recording={recording} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Chord Charts ── */}
        <div
          className="rounded-2xl p-4"
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
              <span
                className="inline-flex items-center gap-2 px-3 h-10 rounded-xl cursor-pointer text-sm font-semibold"
                style={{
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <FileMusic size={14} /> Upload
              </span>
            </label>
          </div>
          {chartsLoading ? (
            <Spinner className="w-4 h-4" />
          ) : !chordCharts?.length ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No chord charts yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {chordCharts.map((chart) => (
                <ChordChartItem key={chart.id} chart={chart} />
              ))}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div
          className="rounded-2xl p-4"
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
              <Pencil size={13} /> {song.notes ? 'Edit' : 'Write Notes'}
            </Button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: song.notes ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {song.notes || 'No notes yet.'}
          </p>
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
