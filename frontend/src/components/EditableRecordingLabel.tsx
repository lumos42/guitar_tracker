import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Pencil } from 'lucide-react'
import { formatRecordingDefaultLabel, getRecordingDisplayLabel } from '@/lib/utils'
import type { Recording } from '@/types'

const MAX_LABEL_LENGTH = 255

export function EditableRecordingLabel({
  recording,
  onSave,
  isSaving,
}: {
  recording: Recording
  onSave: (label: string | null) => void
  isSaving: boolean
}) {
  const displayLabel = getRecordingDisplayLabel(recording)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(displayLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) setDraft(displayLabel)
  }, [displayLabel, isEditing])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const startEditing = () => {
    if (isSaving) return
    setDraft(displayLabel)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraft(displayLabel)
    setIsEditing(false)
  }

  const commitEdit = () => {
    const trimmed = draft.trim().slice(0, MAX_LABEL_LENGTH)
    const currentLabel = recording.label?.trim() || null
    const defaultLabel = formatRecordingDefaultLabel(recording.recorded_at)

    if (!trimmed) {
      if (!currentLabel) {
        setIsEditing(false)
        return
      }
      onSave(null)
      setIsEditing(false)
      return
    }

    if (!currentLabel && trimmed === defaultLabel) {
      setIsEditing(false)
      return
    }

    if (trimmed === currentLabel) {
      setIsEditing(false)
      return
    }

    onSave(trimmed)
    setIsEditing(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitEdit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={MAX_LABEL_LENGTH}
        disabled={isSaving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        className="w-full text-xs font-medium mb-2 px-2 py-1 rounded-lg focus:outline-none"
        style={{
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-display)',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-base)',
        }}
        aria-label="Rename take"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={isSaving}
      className="group flex items-center gap-1.5 w-full text-left mb-2 disabled:opacity-60"
      aria-label={`Rename take: ${displayLabel}`}
    >
      <span
        className="text-xs font-medium truncate"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}
      >
        {displayLabel}
      </span>
      <Pencil
        size={12}
        className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        style={{ color: 'var(--text-tertiary)' }}
        aria-hidden
      />
    </button>
  )
}
