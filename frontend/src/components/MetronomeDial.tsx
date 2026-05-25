import { useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BPM_MIN,
  BPM_MAX,
  bpmToDialDeg,
  bpmDeltaFromDragDeg,
  clampBpm,
  describeArc,
  getPointerAngleDeg,
  normalizeDeltaDeg,
  DIAL_START,
} from '@/lib/metronomeDial'
import './MetronomeDial.css'

const SIZE = 200
const CX = SIZE / 2
const CY = SIZE / 2
const RING_R = 82
const TICK_COUNT = 9

interface MetronomeDialProps {
  bpm: number
  min?: number
  max?: number
  onBpmChange: (bpm: number) => void
  disabled?: boolean
}

export function MetronomeDial({
  bpm,
  min = BPM_MIN,
  max = BPM_MAX,
  onBpmChange,
  disabled = false,
}: MetronomeDialProps) {
  const ringRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startAngle: number; startBpm: number } | null>(null)
  const lastEmittedRef = useRef(bpm)

  useEffect(() => {
    lastEmittedRef.current = bpm
  }, [bpm])

  const endDeg = bpmToDialDeg(bpm, min, max)
  const trackPath = describeArc(CX, CY, RING_R, DIAL_START, DIAL_START + 270)
  const arcPath = describeArc(CX, CY, RING_R, DIAL_START, endDeg)

  const indicatorRad = ((endDeg - 90) * Math.PI) / 180
  const indicatorX = CX + RING_R * Math.cos(indicatorRad)
  const indicatorY = CY + RING_R * Math.sin(indicatorRad)

  const tickMarks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const deg = DIAL_START + (i / (TICK_COUNT - 1)) * 270
    const rad = ((deg - 90) * Math.PI) / 180
    const x1 = CX + (RING_R - 10) * Math.cos(rad)
    const y1 = CY + (RING_R - 10) * Math.sin(rad)
    const x2 = CX + (RING_R - 2) * Math.cos(rad)
    const y2 = CY + (RING_R - 2) * Math.sin(rad)
    return { x1, y1, x2, y2, key: i }
  })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !ringRef.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = ringRef.current.getBoundingClientRect()
      dragRef.current = {
        startAngle: getPointerAngleDeg(e.clientX, e.clientY, rect),
        startBpm: bpm,
      }
    },
    [disabled, bpm],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !ringRef.current) return
      const rect = ringRef.current.getBoundingClientRect()
      const angle = getPointerAngleDeg(e.clientX, e.clientY, rect)
      const delta = normalizeDeltaDeg(angle - dragRef.current.startAngle)
      const next = clampBpm(
        dragRef.current.startBpm + bpmDeltaFromDragDeg(delta, min, max),
        min,
        max,
      )
      if (next !== lastEmittedRef.current) {
        lastEmittedRef.current = next
        onBpmChange(next)
      }
    },
    [bpm, min, max, onBpmChange],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const step = (delta: number) => {
    if (disabled) return
    onBpmChange(clampBpm(bpm + delta, min, max))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      step(1)
    }
  }

  return (
    <div className="metronome-dial">
      <div
        ref={ringRef}
        className="metronome-dial__ring"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={bpm}
        aria-label="Tempo"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <svg className="metronome-dial__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        {tickMarks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="oklch(0.38 0.010 52)"
            strokeWidth={t.key === 0 || t.key === TICK_COUNT - 1 ? 2 : 1}
            strokeLinecap="round"
          />
        ))}
        <path d={trackPath} className="metronome-dial__track" />
        <path d={arcPath} className="metronome-dial__arc" />
        <circle cx={indicatorX} cy={indicatorY} r={5} className="metronome-dial__indicator" />
      </svg>

      <div className="metronome-dial__hub" aria-hidden>
        <span className="metronome-dial__hub-value">{bpm}</span>
        <span className="metronome-dial__hub-label">bpm</span>
      </div>

      <button
        type="button"
        className="metronome-dial__step metronome-dial__step--left"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => step(-1)}
        disabled={disabled || bpm <= min}
        aria-label="Decrease tempo by 1"
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className="metronome-dial__step metronome-dial__step--right"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => step(1)}
        disabled={disabled || bpm >= max}
        aria-label="Increase tempo by 1"
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
