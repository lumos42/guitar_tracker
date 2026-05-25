import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Music2, LogOut, ChevronRight, HelpCircle, Dumbbell, Gauge } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePracticeSessions } from '@/hooks/usePractice'
import { useSongs } from '@/hooks/useSongs'
import { useExercises } from '@/hooks/useExercises'
import { pickRandom } from '@/lib/suggestions'
import type { Exercise, Song } from '@/types'

function NudgeRow({
  label,
  title,
  subtitle,
  onClick,
  leading,
}: {
  label: string
  title: string
  subtitle?: string
  onClick: () => void
  leading: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-all duration-150 active:scale-[0.99]"
    >
      <div
        className="flex items-center gap-4 p-3 rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex-shrink-0">{leading}</div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] uppercase tracking-widest mb-0.5"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            {label}
          </p>
          <p
            className="font-semibold text-sm truncate"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            {title}
          </p>
          {subtitle && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} className="flex-shrink-0" />
      </div>
    </button>
  )
}

function SongThumb({ song }: { song: Song }) {
  if (song.album_art_url) {
    return (
      <img
        src={song.album_art_url}
        alt=""
        className="w-12 h-12 rounded-xl object-cover"
      />
    )
  }
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      <Music2 size={18} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
    </div>
  )
}

export function HomePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { data: sessions } = usePracticeSessions({ limit: 1 })
  const { data: songs } = useSongs()
  const { data: exercises } = useExercises()

  const songMap = Object.fromEntries((songs ?? []).map((s) => [s.id, s]))
  const lastSession = sessions?.[0]
  const lastSong = lastSession ? songMap[lastSession.song_id] : null

  const suggestedSong = useMemo(
    (): Song | null => pickRandom(songs ?? [], lastSong?.id),
    [songs, lastSong?.id],
  )

  const suggestedExercise = useMemo(
    (): Exercise | null => pickRandom(exercises ?? []),
    [exercises],
  )

  const hour = new Date().getHours()
  const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const firstName = user?.display_name?.split(' ')[0] ?? 'there'

  const openHelp = () => {
    window.open('/help', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="animate-fade-up">
      {/* Greeting */}
      <p
        className="px-5 pb-3 text-lg font-semibold capitalize"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--text-secondary)',
          paddingTop: 'max(var(--space-4), env(safe-area-inset-top))',
        }}
      >
        Good {timeLabel}, {firstName}
      </p>

      {/* Hero — last practiced song */}
      <div className="relative min-h-[240px] overflow-hidden">
        {lastSong?.album_art_url ? (
          <img
            src={lastSong.album_art_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl"
            style={{ opacity: 0.35 }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, oklch(0.80 0.175 72 / 0.12), transparent 70%)',
            }}
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, oklch(0.09 0.006 50 / 0.3) 0%, oklch(0.09 0.006 50) 100%)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-5 px-5 py-5">
          {lastSong ? (
            <div className="flex items-end gap-4">
              {lastSong.album_art_url ? (
                <img
                  src={lastSong.album_art_url}
                  alt={lastSong.title}
                  className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-2xl"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <Music2 size={28} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] uppercase tracking-widest mb-1"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
                >
                  Last practiced
                </p>
                <h2
                  className="text-2xl font-black leading-tight truncate"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  {lastSong.title}
                </h2>
                <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {lastSong.artist}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2
                className="text-3xl font-black leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Ready to play?
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Add a song to get started.
              </p>
            </div>
          )}

          {lastSong ? (
            <button
              type="button"
              onClick={() => navigate(`/songs/${lastSong.id}`)}
              className="flex items-center gap-3 h-12 px-5 rounded-2xl font-semibold text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--accent)',
                color: 'var(--bg-base)',
                boxShadow: '0 4px 24px var(--accent-dim)',
              }}
            >
              <Play size={16} fill="currentColor" />
              Continue Practicing
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/songs')}
              className="flex items-center gap-3 h-12 px-5 rounded-2xl font-semibold text-sm transition-all duration-150 active:scale-[0.97]"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--accent)',
                color: 'var(--bg-base)',
                boxShadow: '0 4px 24px var(--accent-dim)',
              }}
            >
              <Music2 size={16} />
              Add Your First Song
            </button>
          )}
        </div>
      </div>

      {/* Tune first */}
      <div className="px-5 mt-6 animate-fade-up delay-75">
        <NudgeRow
          label="Before you play"
          title="Tune your guitar"
          onClick={() => navigate('/tuner')}
          leading={
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
            >
              <Gauge size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.75} />
            </div>
          }
        />
      </div>

      {/* Nudges */}
      <div className="px-5 mt-8 animate-fade-up delay-100">
        <h3
          className="text-xs font-bold uppercase tracking-[0.1em] mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
        >
          Or try something else
        </h3>

        <div className="flex flex-col gap-2">
          {suggestedSong ? (
            <NudgeRow
              label="Suggested song"
              title={suggestedSong.title}
              subtitle={suggestedSong.artist}
              onClick={() => navigate(`/songs/${suggestedSong.id}`)}
              leading={<SongThumb song={suggestedSong} />}
            />
          ) : songs && songs.length > 0 ? (
            <EmptyNudge
              title="Add another song"
              description="Shuffle suggestions work best with more than one song in your library."
              actionLabel="Browse songs"
              onAction={() => navigate('/songs')}
            />
          ) : (
            <EmptyNudge
              title="Add a song"
              description="Pick something you're learning and we'll suggest it here."
              actionLabel="Add a song"
              onAction={() => navigate('/songs')}
            />
          )}

          {suggestedExercise ? (
            <NudgeRow
              label="Warm up"
              title={suggestedExercise.name}
              subtitle={
                suggestedExercise.last_bpm
                  ? `Last tempo · ${suggestedExercise.last_bpm} BPM`
                  : suggestedExercise.description ?? undefined
              }
              onClick={() => navigate(`/exercises/${suggestedExercise.id}`)}
              leading={
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
                >
                  <Dumbbell size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.75} />
                </div>
              }
            />
          ) : (
            <EmptyNudge
              title="Add an exercise"
              description="Track tempo on drills and we'll nudge you to warm up."
              actionLabel="Add exercise"
              onAction={() => navigate('/exercises')}
            />
          )}
        </div>
      </div>

      {/* Help */}
      <div className="px-5 mt-6 animate-fade-up delay-150">
        <button
          type="button"
          onClick={openHelp}
          className="w-full flex items-center gap-3 h-12 px-4 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
          style={{
            fontFamily: 'var(--font-display)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
          Help & tips
          <ChevronRight size={16} className="ml-auto" style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </div>

      {/* Sign out */}
      <div className="px-5 mt-4 mb-4 animate-fade-up delay-200">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
          style={{
            fontFamily: 'var(--font-display)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-tertiary)',
          }}
        >
          <LogOut size={15} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </div>
  )
}

function EmptyNudge({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p
        className="font-semibold text-sm mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {title}
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="text-xs font-semibold transition-colors"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
      >
        {actionLabel}
      </button>
    </div>
  )
}
