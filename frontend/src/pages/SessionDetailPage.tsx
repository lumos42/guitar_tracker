import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mic } from 'lucide-react'
import { usePracticeSession } from '@/hooks/usePractice'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDuration } from '@/lib/utils'

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: session, isLoading } = usePracticeSession(Number(id))

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!session) return null

  return (
    <div className="px-5 pt-14 animate-fade-up">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-8 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>Back</span>
      </button>

      <div className="mb-8">
        <p
          className="text-xs font-bold uppercase tracking-[0.1em] mb-1"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
        >
          Practice Session
        </p>
        <h1
          className="text-3xl font-black"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {formatDate(session.practiced_at)}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {session.duration_seconds && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-3xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {formatDuration(session.duration_seconds)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>duration</p>
          </div>
        )}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p
            className="text-3xl font-black"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
          >
            {session.recordings?.length ?? 0}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>recordings</p>
        </div>
      </div>

      {/* Notes */}
      {session.notes && (
        <div
          className="rounded-2xl p-4 mb-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Notes
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {session.notes}
          </p>
        </div>
      )}

      {/* Recordings */}
      <p
        className="text-xs font-bold uppercase tracking-[0.1em] mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
      >
        Recordings
      </p>

      {!session.recordings?.length ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <Mic size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recordings</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {session.recordings.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
              >
                <Mic size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-[15px]"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  {rec.label ?? `${rec.section.charAt(0).toUpperCase() + rec.section.slice(1)} take`}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {rec.duration_seconds ? formatDuration(Math.round(rec.duration_seconds)) : '—'}
                  {rec.speed_percent && rec.speed_percent !== 100 && ` · ${rec.speed_percent}% speed`}
                </p>
              </div>
              <span
                className="text-xs capitalize flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {rec.section}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
