import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, TrendingUp, Activity } from 'lucide-react'
import { useExercise, useExerciseBpmLogs, useUpdateExercise } from '@/hooks/useExercises'
import { useAuthenticatedMediaUrl } from '@/hooks/useAuthenticatedMediaUrl'
import { Spinner } from '@/components/ui/Spinner'
import { formatRelative } from '@/lib/utils'
import { useMetronomeStore } from '@/store/metronomeStore'
import type { Exercise } from '@/types'

function ExerciseFileMedia({ exercise }: { exercise: Exercise }) {
  const { data: mediaUrl, isLoading } = useAuthenticatedMediaUrl(exercise.file_url ?? undefined)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <Spinner className="w-4 h-4" />
        Loading media…
      </div>
    )
  }

  if (!mediaUrl) return null

  if (exercise.media_type === 'image') {
    return <img src={mediaUrl} alt={exercise.name} className="w-full rounded-xl object-cover max-h-72" />
  }

  return <video src={mediaUrl} controls className="w-full rounded-xl max-h-72" />
}

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const exerciseId = Number(id)
  const navigate = useNavigate()
  const { data: exercise, isLoading } = useExercise(exerciseId)
  const { data: bpmData, isLoading: logsLoading } = useExerciseBpmLogs(exerciseId)
  const updateExercise = useUpdateExercise()
  const bpm = useMetronomeStore((s) => s.bpm)
  const beatsPerBar = useMetronomeStore((s) => s.beatsPerBar)
  const setExerciseContext = useMetronomeStore((s) => s.setExerciseContext)

  useEffect(() => {
    if (!exercise) return
    setExerciseContext(exercise.id, { bpm: bpmData?.last_bpm ?? exercise.last_bpm ?? 80, beatsPerBar: 4 })
  }, [exercise, bpmData?.last_bpm, setExerciseContext])

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!exercise) return null

  const hasMedia = Boolean(exercise.file_url || exercise.media_url)
  const logs = bpmData?.items ?? []
  const maxLog = logs.length ? Math.max(...logs.map((log) => log.bpm)) : null
  const handleMediaUpdate = (mediaType: 'weblink' | 'image' | 'video', mediaUrl?: string, file?: File | null) => {
    const fd = new FormData()
    fd.append('media_type', mediaType)
    if (mediaType === 'weblink') {
      fd.append('media_url', mediaUrl?.trim() ?? '')
    } else if (file) {
      fd.append('file', file)
    }
    updateExercise.mutate({ id: exerciseId, data: fd })
  }

  return (
    <div className="px-5 pt-14 pb-8 animate-fade-up">
      <button
        onClick={() => navigate('/exercises')}
        className="flex items-center gap-2 mb-6 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>Exercises</span>
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          {exercise.name}
        </h1>
        {exercise.description && (
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {exercise.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Metronome BPM</p>
          <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
            {bpm}
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Time Signature</p>
          <p className="text-3xl font-black tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
            {beatsPerBar}/4
          </p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
          Exercise Media
        </h2>
        {!hasMedia ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No media attached yet.</p>
        ) : (exercise.media_type === 'image' || exercise.media_type === 'video') && exercise.file_url ? (
          <ExerciseFileMedia exercise={exercise} />
        ) : exercise.media_url ? (
          <a
            href={exercise.media_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            <Link2 size={14} />
            Open exercise link
          </a>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Media format not supported.</p>
        )}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label
            className="h-10 px-3 rounded-xl text-sm flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
          >
            Add Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleMediaUpdate('image', undefined, e.target.files?.[0] ?? null)}
            />
          </label>
          <label
            className="h-10 px-3 rounded-xl text-sm flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
          >
            Add Video
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleMediaUpdate('video', undefined, e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const nextUrl = window.prompt('Enter media link URL', exercise.media_type === 'weblink' ? exercise.media_url ?? '' : '')
              if (nextUrl === null) return
              handleMediaUpdate('weblink', nextUrl)
            }}
            className="h-10 px-3 rounded-xl text-sm"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', color: 'var(--text-secondary)' }}
          >
            Add Link
          </button>
        </div>
        {updateExercise.isPending && (
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Spinner className="w-3 h-3" />
            Updating media...
          </div>
        )}
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>
            BPM History
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {logs.length} logs
          </span>
        </div>
        {logsLoading ? (
          <div className="flex justify-center py-4"><Spinner className="w-4 h-4" /></div>
        ) : !logs.length ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Start the metronome to log your first BPM.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Activity size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatRelative(log.logged_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {maxLog !== null && log.bpm === maxLog && <TrendingUp size={12} style={{ color: 'var(--accent)' }} />}
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: log.bpm === maxLog ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {log.bpm}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
