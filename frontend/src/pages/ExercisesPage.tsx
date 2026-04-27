import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, TrendingUp } from 'lucide-react'
import { useExercises, useCreateExercise } from '@/hooks/useExercises'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'

function AddExerciseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', media_type: 'weblink', media_url: '' })
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const createExercise = useCreateExercise()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('media_type', form.media_type)
    if (form.description) fd.append('description', form.description)
    if (form.media_type === 'weblink' && form.media_url) fd.append('media_url', form.media_url)
    if ((form.media_type === 'image' || form.media_type === 'video') && mediaFile) fd.append('file', mediaFile)
    createExercise.mutate(fd, {
      onSuccess: () => {
        setForm({ name: '', description: '', media_type: 'weblink', media_url: '' })
        setMediaFile(null)
        onClose()
      },
    })
  }

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
  }

  const labelStyle = {
    fontFamily: 'var(--font-display)',
    color: 'var(--text-tertiary)',
  }

  return (
    <Modal open={open} onClose={onClose} title="New exercise">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>Name</label>
          <input
            required
            placeholder="e.g. Spider Exercise"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>Description (optional)</label>
          <textarea
            rows={2}
            placeholder="Describe the exercise…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-[15px] focus:outline-none resize-none"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>Media type</label>
          <select
            value={form.media_type}
            onChange={(e) => {
              const nextType = e.target.value as 'weblink' | 'image' | 'video'
              setForm((f) => ({ ...f, media_type: nextType, media_url: nextType === 'weblink' ? f.media_url : '' }))
              setMediaFile(null)
            }}
            className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none"
            style={inputStyle}
          >
            <option value="weblink">Link</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        {form.media_type === 'weblink' ? (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>Reference link (optional)</label>
            <input
              type="url"
              placeholder="https://youtube.com/…"
              value={form.media_url}
              onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
              className="w-full h-12 px-4 rounded-xl text-[15px] focus:outline-none"
              style={inputStyle}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>
              {form.media_type === 'image' ? 'Exercise image' : 'Exercise video'}
            </label>
            <input
              type="file"
              accept={form.media_type === 'image' ? 'image/*' : 'video/*'}
              onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              className="w-full h-12 px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
        )}
        {form.media_type !== 'weblink' && !mediaFile && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            You can add this later from the exercise detail page.
          </p>
        )}
        {form.media_type === 'weblink' && form.media_url && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Link will be shown on the exercise detail page.
          </p>
        )}
        <Button type="submit" size="lg" className="w-full mt-2" disabled={createExercise.isPending}>
          {createExercise.isPending ? <Spinner className="w-4 h-4" /> : 'Add Exercise'}
        </Button>
      </form>
    </Modal>
  )
}

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises()
  const [addOpen, setAddOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="px-5 pt-14 animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-3xl font-black"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Exercises
        </h1>
        <Button size="icon" onClick={() => setAddOpen(true)} aria-label="Add exercise">
          <Plus size={18} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !exercises?.length ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
          >
            <Dumbbell size={24} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
          </div>
          <p className="font-bold text-base mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            No exercises yet
          </p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', maxWidth: '24ch', margin: '4px auto 20px' }}>
            Add exercises and track your BPM over time.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="h-10 px-5 rounded-xl text-sm font-semibold active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)', background: 'var(--accent)', color: 'var(--bg-base)' }}
          >
            Add exercise
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exercises.map((exercise, i) => (
            <button
              key={exercise.id}
              onClick={() => navigate(`/exercises/${exercise.id}`)}
              className="w-full text-left animate-fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-150 active:scale-[0.99]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
                >
                  <Dumbbell size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-[15px] truncate"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                  >
                    {exercise.name}
                  </p>
                  {exercise.description && (
                    <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {exercise.description}
                    </p>
                  )}
                </div>
                {exercise.last_bpm ? (
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
                      <span
                        className="text-lg font-black tabular-nums leading-none"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
                      >
                        {exercise.last_bpm}
                      </span>
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      bpm
                    </span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Tap to log
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <AddExerciseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
