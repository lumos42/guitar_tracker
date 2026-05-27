import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWaveformPeaks } from '@/hooks/useWaveformPeaks'
import { bucketTime } from '@/lib/waveformPeaks'

const VIEWPORT_SECONDS = 40
const RULER_HEIGHT = 18
const WAVEFORM_HEIGHT = 56
const MOMENTUM_FACTOR = 0.00035
const SEEK_THROTTLE_MS = 30

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampTime(
  time: number,
  duration: number,
  loopStartMs?: number,
  loopEndMs?: number,
): number {
  let min = 0
  let max = duration > 0 ? duration : 0
  if (
    loopStartMs !== undefined &&
    loopEndMs !== undefined &&
    loopEndMs > loopStartMs
  ) {
    min = loopStartMs / 1000
    max = loopEndMs / 1000
  }
  return Math.max(min, Math.min(max, time))
}

function readCssColor(variable: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()
  return value || fallback
}

interface WaveformScrubberProps {
  audioUrl: string
  currentTime: number
  duration: number
  isPlaying: boolean
  onSeek: (time: number) => void
  /** Read live playback time without waiting for React state (smoother scroll). */
  getCurrentTime?: () => number
  loopStartMs?: number
  loopEndMs?: number
}

export function WaveformScrubber({
  audioUrl,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  getCurrentTime,
  loopStartMs,
  loopEndMs,
}: WaveformScrubberProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { peaks, isLoading } = useWaveformPeaks(audioUrl, { enabled: isExpanded })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const displayTimeRef = useRef(currentTime)
  const dragRef = useRef<{
    startX: number
    startTime: number
    lastX: number
    lastT: number
  } | null>(null)
  const isDraggingRef = useRef(false)
  const lastSeekAtRef = useRef(0)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const clamp = useCallback(
    (time: number) => clampTime(time, duration, loopStartMs, loopEndMs),
    [duration, loopStartMs, loopEndMs],
  )

  const applySeek = useCallback(
    (time: number, throttle = false) => {
      const clamped = clamp(time)
      displayTimeRef.current = clamped
      if (throttle) {
        const now = performance.now()
        if (now - lastSeekAtRef.current < SEEK_THROTTLE_MS) return
        lastSeekAtRef.current = now
      }
      onSeek(clamped)
    },
    [clamp, onSeek],
  )

  const drawFrame = useCallback(
    (time: number) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      if (width <= 0) return

      const height = RULER_HEIGHT + WAVEFORM_HEIGHT
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const pixelsPerSecond = width / VIEWPORT_SECONDS
      const centerX = width / 2
      const trackDuration = peaks?.duration ?? duration

      const waveformColor = readCssColor('--text-tertiary', '#888')
      const accentColor = readCssColor('--accent', '#c9a227')
      const rulerColor = readCssColor('--text-tertiary', '#666')
      const loopColor = readCssColor('--accent', '#c9a227')

      // Ruler
      ctx.strokeStyle = rulerColor
      ctx.fillStyle = rulerColor
      ctx.font = '10px var(--font-display), system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const windowStart = time - VIEWPORT_SECONDS / 2
      const windowEnd = time + VIEWPORT_SECONDS / 2
      const firstTick = Math.floor(windowStart / 2) * 2
      for (let tick = firstTick; tick <= windowEnd; tick += 2) {
        const x = centerX + (tick - time) * pixelsPerSecond
        if (x < -20 || x > width + 20) continue
        const isMajor = tick % 10 === 0
        ctx.globalAlpha = isMajor ? 1 : 0.45
        ctx.beginPath()
        ctx.moveTo(x, RULER_HEIGHT - (isMajor ? 10 : 5))
        ctx.lineTo(x, RULER_HEIGHT)
        ctx.stroke()
        if (isMajor && tick >= 0) {
          ctx.globalAlpha = 0.85
          ctx.fillText(formatTime(tick), x, 2)
        }
      }
      ctx.globalAlpha = 1

      const waveTop = RULER_HEIGHT
      const waveMid = waveTop + WAVEFORM_HEIGHT / 2
      const waveBottom = waveTop + WAVEFORM_HEIGHT

      // Loop region tint
      if (
        loopStartMs !== undefined &&
        loopEndMs !== undefined &&
        loopEndMs > loopStartMs &&
        trackDuration > 0
      ) {
        const loopStart = loopStartMs / 1000
        const loopEnd = loopEndMs / 1000
        const x1 = centerX + (loopStart - time) * pixelsPerSecond
        const x2 = centerX + (loopEnd - time) * pixelsPerSecond
        ctx.fillStyle = loopColor
        ctx.globalAlpha = 0.12
        ctx.fillRect(
          Math.max(0, x1),
          waveTop,
          Math.min(width, x2) - Math.max(0, x1),
          WAVEFORM_HEIGHT,
        )
        ctx.globalAlpha = 1
      }

      // Waveform
      if (peaks && trackDuration > 0) {
        ctx.fillStyle = waveformColor
        ctx.beginPath()
        let started = false

        const startBucket = Math.max(
          0,
          Math.floor(((windowStart / trackDuration) * (peaks.bucketCount - 1))),
        )
        const endBucket = Math.min(
          peaks.bucketCount - 1,
          Math.ceil(((windowEnd / trackDuration) * (peaks.bucketCount - 1))),
        )

        for (let i = startBucket; i <= endBucket; i++) {
          const t = bucketTime(peaks, i)
          const x = centerX + (t - time) * pixelsPerSecond
          const amp = Math.max(peaks.mins[i], peaks.maxs[i])
          const h = amp * (WAVEFORM_HEIGHT / 2 - 2)
          const yTop = waveMid - h
          if (!started) {
            ctx.moveTo(x, yTop)
            started = true
          } else {
            ctx.lineTo(x, yTop)
          }
        }
        for (let i = endBucket; i >= startBucket; i--) {
          const t = bucketTime(peaks, i)
          const x = centerX + (t - time) * pixelsPerSecond
          const amp = Math.max(peaks.mins[i], peaks.maxs[i])
          const h = amp * (WAVEFORM_HEIGHT / 2 - 2)
          ctx.lineTo(x, waveMid + h)
        }
        ctx.closePath()
        ctx.fill()
      } else if (isLoading) {
        // Placeholder bars while decoding
        ctx.fillStyle = waveformColor
        ctx.globalAlpha = 0.35
        const barCount = Math.floor(width / 6)
        for (let i = 0; i < barCount; i++) {
          const x = i * 6 + 2
          const h = 8 + ((i * 7) % 20)
          ctx.fillRect(x, waveMid - h / 2, 3, h)
        }
        ctx.globalAlpha = 1
      }

      // Center playhead
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(centerX, waveTop)
      ctx.lineTo(centerX, waveBottom)
      ctx.stroke()
    },
    [duration, peaks, isLoading, loopStartMs, loopEndMs],
  )

  // Keep display time in sync when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      displayTimeRef.current = currentTime
    }
  }, [currentTime])

  // rAF render loop when expanded and playing
  useEffect(() => {
    if (!isExpanded) return

    const tick = () => {
      if (!isDraggingRef.current) {
        const live = getCurrentTime?.()
        displayTimeRef.current =
          live !== undefined && Number.isFinite(live) ? live : currentTime
      }
      drawFrame(displayTimeRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }

    drawFrame(
      getCurrentTime?.() ?? displayTimeRef.current,
    )

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isExpanded, isPlaying, currentTime, drawFrame, getCurrentTime])

  // Redraw when paused but time changes (e.g. transport seek)
  useEffect(() => {
    if (!isExpanded || isPlaying || isDraggingRef.current) return
    displayTimeRef.current = currentTime
    drawFrame(currentTime)
  }, [isExpanded, isPlaying, currentTime, drawFrame])

  // Redraw on resize
  useEffect(() => {
    if (!isExpanded) return
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => {
      drawFrame(displayTimeRef.current)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [isExpanded, drawFrame])

  const handleCollapsedSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    applySeek(parseFloat(e.target.value))
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!isExpanded) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    const now = performance.now()
    dragRef.current = {
      startX: e.clientX,
      startTime: displayTimeRef.current,
      lastX: e.clientX,
      lastT: now,
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isExpanded || !dragRef.current || !isDraggingRef.current) return
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const pixelsPerSecond = width / VIEWPORT_SECONDS
    const deltaX = e.clientX - dragRef.current.startX
    const deltaTime = -deltaX / pixelsPerSecond
    const newTime = dragRef.current.startTime + deltaTime

    dragRef.current.lastX = e.clientX
    dragRef.current.lastT = performance.now()

    displayTimeRef.current = clamp(newTime)
    drawFrame(displayTimeRef.current)
    applySeek(newTime, true)
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    isDraggingRef.current = false

    if (!prefersReducedMotion) {
      const now = performance.now()
      const dt = Math.max(1, now - dragRef.current.lastT)
      const velocityX = (e.clientX - dragRef.current.lastX) / dt
      const momentumSeconds = -velocityX * MOMENTUM_FACTOR * 1000
      if (Math.abs(momentumSeconds) > 0.05) {
        const finalTime = clamp(displayTimeRef.current + momentumSeconds)
        displayTimeRef.current = finalTime
        applySeek(finalTime)
        drawFrame(finalTime)
      }
    }

    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isExpanded) return
    let delta = 0
    if (e.key === 'ArrowLeft') delta = -2
    else if (e.key === 'ArrowRight') delta = 2
    else if (e.key === 'Home') {
      applySeek(loopStartMs !== undefined ? loopStartMs / 1000 : 0)
      e.preventDefault()
      return
    } else if (e.key === 'End') {
      applySeek(
        loopEndMs !== undefined && loopEndMs > 0
          ? loopEndMs / 1000
          : duration,
      )
      e.preventDefault()
      return
    } else return

    e.preventDefault()
    applySeek(displayTimeRef.current + delta)
    drawFrame(displayTimeRef.current)
  }

  const timeStyle = {
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-display)',
  } as const

  if (!isExpanded) {
    return (
      <div className="flex flex-col gap-1.5 w-full select-none touch-none">
        <div
          className="relative h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-overlay)' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleCollapsedSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
            aria-label="Seek"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums" style={timeStyle}>
            {formatTime(currentTime)}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-md transition-all active:scale-95"
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-display)',
              background: 'var(--bg-overlay)',
            }}
            aria-expanded={false}
            aria-label="Expand waveform scrubber"
          >
            <ChevronDown size={12} />
            Waveform
          </button>
          <span className="text-[11px] tabular-nums" style={timeStyle}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.06em]"
          style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}
        >
          {isLoading ? 'Loading waveform…' : 'Waveform'}
        </span>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-md transition-all active:scale-95"
          style={{
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-display)',
            background: 'var(--bg-overlay)',
          }}
          aria-expanded={true}
          aria-label="Collapse waveform"
        >
          <ChevronUp size={12} />
          Collapse
        </button>
      </div>

      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime}
        aria-label="Waveform scrubber"
        aria-expanded={true}
        className="relative rounded-xl overflow-hidden touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{
          background: 'var(--bg-overlay)',
          height: RULER_HEIGHT + WAVEFORM_HEIGHT,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      <div className="flex justify-between">
        <span className="text-[11px] tabular-nums" style={timeStyle}>
          {formatTime(currentTime)}
        </span>
        <span className="text-[11px] tabular-nums" style={timeStyle}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
