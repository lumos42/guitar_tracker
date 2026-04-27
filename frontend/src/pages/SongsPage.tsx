import { useState } from 'react'
import { Plus, Search, Music2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSongs, useCreateSong, useSpotifySearch } from '@/hooks/useSongs'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { formatDurationMs } from '@/lib/utils'
import type { SpotifyTrack } from '@/types'

function AddSongModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [form, setForm] = useState({ title: '', artist: '', album: '' })
  const { data: spotifyResults, isLoading: searching } = useSpotifySearch(query)
  const createSong = useCreateSong()

  const handleSpotifySelect = (track: SpotifyTrack) => {
    createSong.mutate(
      {
        title: track.name, artist: track.artist, album: track.album,
        album_art_url: track.album_art_url ?? undefined,
        duration_ms: track.duration_ms,
        spotify_track_id: track.id,
      },
      { onSuccess: onClose }
    )
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createSong.mutate(form, { onSuccess: onClose })
  }

  const fieldStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
  }

  return (
    <Modal open={open} onClose={onClose} title={manualMode ? 'Add manually' : 'Add song'}>
      {!manualMode ? (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              placeholder="Search Spotify…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full h-12 pl-10 pr-4 rounded-xl text-[15px] placeholder:text-[--text-tertiary] focus:outline-none transition-colors focus:border-[--accent]"
              style={fieldStyle}
            />
          </div>

          {searching && (
            <div className="flex justify-center py-6"><Spinner /></div>
          )}

          {spotifyResults && spotifyResults.length > 0 && (
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto -mx-1 px-1">
              {spotifyResults.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleSpotifySelect(track)}
                  disabled={createSong.isPending}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors duration-100 active:scale-[0.99]"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {track.album_art_url ? (
                    <img src={track.album_art_url} alt={track.album} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-overlay)' }}>
                      <Music2 size={16} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                      {track.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {track.artist} · {track.album}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {formatDurationMs(track.duration_ms)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {spotifyResults && spotifyResults.length === 0 && query.length > 1 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
              No results for "{query}"
            </p>
          )}

          <button
            className="text-sm font-medium text-left transition-colors"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            onClick={() => setManualMode(true)}
          >
            Add manually instead →
          </button>
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
          {(['title', 'artist', 'album'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <label
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
              >
                {field === 'album' ? 'Album (optional)' : field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                required={field !== 'album'}
                placeholder={field === 'title' ? 'e.g. Blackbird' : field === 'artist' ? 'e.g. The Beatles' : 'e.g. The White Album'}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none transition-colors"
                style={fieldStyle}
              />
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="ghost" onClick={() => setManualMode(false)} className="flex-1">
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={createSong.isPending}>
              {createSong.isPending ? <Spinner className="w-4 h-4" /> : 'Add Song'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function SongsPage() {
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const navigate = useNavigate()
  const { data: songs, isLoading } = useSongs()

  const filtered = (songs ?? []).filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-5 pt-14 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-3xl font-black"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Songs
        </h1>
        <Button size="icon" onClick={() => setAddOpen(true)} aria-label="Add song">
          <Plus size={18} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          placeholder="Search songs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-xl text-[15px] focus:outline-none transition-colors"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-base)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptySongs hasSearch={search.length > 0} onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((song, i) => (
            <button
              key={song.id}
              onClick={() => navigate(`/songs/${song.id}`)}
              className="w-full text-left animate-fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="flex items-center gap-4 p-3 rounded-2xl transition-all duration-150 active:scale-[0.99]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                {song.album_art_url ? (
                  <img src={song.album_art_url} alt={song.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <Music2 size={22} style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-[15px] truncate"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    {song.title}
                  </p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {song.artist}
                  </p>
                  {song.album && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {song.album}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <AddSongModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

function EmptySongs({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
      >
        <Music2 size={24} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
      </div>
      <p
        className="font-bold text-base mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {hasSearch ? 'No songs match' : 'No songs yet'}
      </p>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', margin: '4px auto 20px', maxWidth: '24ch' }}>
        {hasSearch ? 'Try a different search.' : 'Add songs you\'re learning or want to learn.'}
      </p>
      {!hasSearch && (
        <button
          onClick={onAdd}
          className="h-10 px-5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
          style={{ fontFamily: 'var(--font-display)', background: 'var(--accent)', color: 'var(--bg-base)' }}
        >
          Add a song
        </button>
      )}
    </div>
  )
}
