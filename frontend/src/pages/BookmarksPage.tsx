import { useState } from 'react'
import { Plus, Play, Link, ImageIcon, Trash2, ExternalLink, BookMarked } from 'lucide-react'
import { useBookmarks, useCreateBookmark, useDeleteBookmark } from '@/hooks/useBookmarks'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { BookmarkType } from '@/types'

const typeConfig: Record<BookmarkType, { icon: React.ElementType; accent: string; label: string }> = {
  youtube: { icon: Play,       accent: 'oklch(0.62 0.20 25)',  label: 'YouTube' },
  weblink: { icon: Link,       accent: 'oklch(0.62 0.18 245)', label: 'Link' },
  photo:   { icon: ImageIcon,  accent: 'oklch(0.68 0.18 310)', label: 'Photo' },
}

function AddBookmarkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<BookmarkType>('youtube')
  const [form, setForm] = useState({ title: '', url: '', notes: '' })
  const create = useCreateBookmark()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      { type, ...form, url: form.url || undefined, notes: form.notes || undefined } as Parameters<typeof create.mutate>[0],
      { onSuccess: onClose }
    )
  }

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
  }

  return (
    <Modal open={open} onClose={onClose} title="Add bookmark">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Type picker */}
        <div className="flex gap-2">
          {(Object.entries(typeConfig) as [BookmarkType, typeof typeConfig[BookmarkType]][]).map(([t, { icon: Icon, label, accent }]) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all duration-150 active:scale-[0.96]"
              style={{
                fontFamily: 'var(--font-display)',
                background: type === t ? `${accent}22` : 'var(--bg-surface)',
                border: `1px solid ${type === t ? accent : 'var(--border-base)'}`,
                color: type === t ? accent : 'var(--text-tertiary)',
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>Title</label>
          <input
            required
            placeholder="e.g. How to play the solo"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none"
            style={inputStyle}
          />
        </div>

        {type !== 'photo' && (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>URL</label>
            <input
              type="url"
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none"
              style={inputStyle}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}>Notes (optional)</label>
          <textarea
            rows={2}
            placeholder="Any notes…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-[15px] focus:outline-none resize-none"
            style={inputStyle}
          />
        </div>

        <Button type="submit" size="lg" className="w-full mt-2" disabled={create.isPending}>
          {create.isPending ? <Spinner className="w-4 h-4" /> : 'Add Bookmark'}
        </Button>
      </form>
    </Modal>
  )
}

export function BookmarksPage() {
  const { data: bookmarks, isLoading } = useBookmarks()
  const deleteBookmark = useDeleteBookmark()
  const [addOpen, setAddOpen] = useState(false)
  const [filter, setFilter] = useState<BookmarkType | 'all'>('all')

  const filtered = (bookmarks ?? []).filter((b) => filter === 'all' || b.type === filter)

  const filters: Array<{ key: BookmarkType | 'all'; label: string }> = [
    { key: 'all',     label: 'All' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'weblink', label: 'Links' },
    { key: 'photo',   label: 'Photos' },
  ]

  return (
    <div className="px-5 pt-14 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-3xl font-black"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Learn
        </h1>
        <Button size="icon" onClick={() => setAddOpen(true)} aria-label="Add bookmark">
          <Plus size={18} />
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-0.5">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="flex-shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.96]"
            style={{
              fontFamily: 'var(--font-display)',
              background: filter === key ? 'var(--accent)' : 'var(--bg-surface)',
              color: filter === key ? 'var(--bg-base)' : 'var(--text-secondary)',
              border: `1px solid ${filter === key ? 'transparent' : 'var(--border-subtle)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
          >
            <BookMarked size={24} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
          </div>
          <p className="font-bold text-base mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {filter === 'all' ? 'No bookmarks yet' : `No ${typeConfig[filter]?.label ?? ''} bookmarks`}
          </p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', maxWidth: '24ch', margin: '4px auto 20px' }}>
            Save YouTube videos, links, and chord photos.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="h-10 px-5 rounded-xl text-sm font-semibold active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)', background: 'var(--accent)', color: 'var(--bg-base)' }}
          >
            Add bookmark
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((bookmark, i) => {
            const { icon: Icon, accent } = typeConfig[bookmark.type]
            return (
              <div
                key={bookmark.id}
                className="flex items-start gap-4 p-4 rounded-2xl animate-fade-up"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: `${accent}1a`, border: `1px solid ${accent}44` }}
                >
                  <Icon size={15} style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-[15px] leading-tight"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    {bookmark.title}
                  </p>
                  {bookmark.url && (
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-1 text-xs transition-colors"
                      style={{ color: accent }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={10} />
                      <span className="truncate max-w-[20ch]">
                        {bookmark.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </span>
                    </a>
                  )}
                  {bookmark.notes && (
                    <p className="text-sm mt-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {bookmark.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteBookmark.mutate(bookmark.id)}
                  className="flex-shrink-0 p-1 transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <AddBookmarkModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
