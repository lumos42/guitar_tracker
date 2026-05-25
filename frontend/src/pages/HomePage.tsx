import { useNavigate } from 'react-router-dom'
import { Play, Clock, Music2, ChevronRight, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePracticeSessions } from '@/hooks/usePractice'
import { useSongs } from '@/hooks/useSongs'
import { Spinner } from '@/components/ui/Spinner'
import { formatRelative, formatDuration } from '@/lib/utils'

export function HomePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { data: sessions, isLoading } = usePracticeSessions()
  const { data: songs } = useSongs()

  const songMap = Object.fromEntries((songs ?? []).map((s) => [s.id, s]))
  const lastSession = sessions?.[0]
  const lastSong = lastSession ? songMap[lastSession.song_id] : null
  const recentSessions = sessions?.slice(0, 5) ?? []

  const totalTime = sessions?.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) ?? 0
  const thisWeek = (sessions ?? []).filter((s) => {
    const diff = (Date.now() - new Date(s.practiced_at).getTime()) / 86400000
    return diff <= 7
  }).length

  const hour = new Date().getHours()
  const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const firstName = user?.display_name?.split(' ')[0] ?? 'there'

  return (
    <div className="animate-fade-up">
      {/* Hero — last practiced song */}
      <div className="relative h-[340px] overflow-hidden">
        {/* Blurred album art background */}
        {lastSong?.album_art_url ? (
          <>
            <img
              src={lastSong.album_art_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl"
              style={{ opacity: 0.35 }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, oklch(0.80 0.175 72 / 0.12), transparent 70%)' }}
          />
        )}

        {/* Gradient fade to base */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, oklch(0.09 0.006 50 / 0.3) 0%, oklch(0.09 0.006 50) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-end px-5 pb-6">
          <p
            className="text-xs font-semibold uppercase tracking-[0.1em] mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Good {timeLabel}, {firstName}
          </p>

          {lastSong ? (
            <div className="flex items-end gap-4">
              {/* Album art */}
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

          {/* CTA */}
          <div className="mt-5">
            {lastSong ? (
              <button
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
      </div>

      {/* Stats strip */}
      {sessions && sessions.length > 0 && (
        <div
          className="mx-5 mt-4 grid grid-cols-2 gap-3 animate-fade-up delay-100"
        >
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {thisWeek}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              sessions this week
            </p>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {formatDuration(totalTime)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              total practice
            </p>
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div className="px-5 mt-8 animate-fade-up delay-150">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-xs font-bold uppercase tracking-[0.1em]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Recent Sessions
          </h3>
          {recentSessions.length > 0 && (
            <button
              onClick={() => navigate('/songs')}
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              All songs <ChevronRight size={12} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : recentSessions.length === 0 ? (
          <EmptyRecent onAddSong={() => navigate('/songs')} />
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map((session, i) => {
              const song = songMap[session.song_id]
              return (
                <button
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="w-full text-left animate-fade-up"
                  style={{ animationDelay: `${200 + i * 50}ms` }}
                >
                  <div
                    className="flex items-center gap-4 p-3 rounded-2xl transition-all duration-150 active:scale-[0.99]"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {song?.album_art_url ? (
                      <img
                        src={song.album_art_url}
                        alt={song.title}
                        className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)' }}
                      >
                        <Music2 size={16} style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-sm truncate"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                      >
                        {song?.title ?? 'Unknown Song'}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {song?.artist}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {formatRelative(session.practiced_at)}
                      </p>
                      {session.duration_seconds ? (
                        <p
                          className="text-xs font-semibold mt-0.5"
                          style={{ color: 'var(--accent)' }}
                        >
                          {formatDuration(session.duration_seconds)}
                        </p>
                      ) : (
                        <Clock size={12} style={{ color: 'var(--text-tertiary)', marginTop: 2 }} className="ml-auto" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="px-5 mt-8 mb-4 animate-fade-up delay-200">
        <button
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

function EmptyRecent({ onAddSong }: { onAddSong: () => void }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
      >
        <Play size={24} style={{ color: 'var(--accent)' }} fill="currentColor" />
      </div>
      <p
        className="font-bold text-base mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Start your first session
      </p>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', maxWidth: '24ch', margin: '4px auto 20px' }}>
        Add a song you're learning and log your first practice.
      </p>
      <button
        onClick={onAddSong}
        className="h-10 px-5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
        style={{
          fontFamily: 'var(--font-display)',
          background: 'var(--accent)',
          color: 'var(--bg-base)',
        }}
      >
        Add a song
      </button>
    </div>
  )
}
