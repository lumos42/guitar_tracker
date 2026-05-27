import { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import { WaveformScrubber } from '@/components/WaveformScrubber'

interface SongPlayerProps {
  audioUrl: string
  title: string
  speed: number
  onSpeedChange: (speed: number) => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTimeFromMs(ms: number): string {
  return formatTime(Math.floor(ms / 1000))
}

function parseTimeToMs(value: string): number | null {
  const parts = value.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s)) return m * 60000 + s * 1000
  }
  const raw = parseFloat(value)
  if (isNaN(raw)) return null
  return Math.floor(raw) * 1000
}

function audioTimeToMs(t: number): number {
  return Math.round(t * 1000)
}

function msToAudioTime(ms: number): number {
  return ms / 1000
}

export function SongPlayer({ audioUrl, speed, onSpeedChange }: SongPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStartMs, setLoopStartMs] = useState(0)
  const [loopEndMs, setLoopEndMs] = useState(0)
  const [loopStartInput, setLoopStartInput] = useState('0:00')
  const [loopEndInput, setLoopEndInput] = useState('0:00')
  const [loopSetPhase, setLoopSetPhase] = useState<'start' | 'end'>('start')

  const durationMs = audioTimeToMs(duration)

  // Apply speed + pitch preservation whenever speed changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
    // Preserve pitch across all browsers
    ;(audio as HTMLAudioElement & {
      preservesPitch?: boolean
      mozPreservesPitch?: boolean
      webkitPreservesPitch?: boolean
    }).preservesPitch = true
    ;(audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true
    ;(audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true
  }, [speed])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)

    if (loopEnabled && loopEndMs > loopStartMs && audioTimeToMs(audio.currentTime) >= loopEndMs) {
      audio.currentTime = msToAudioTime(loopStartMs)
    }
  }, [loopEnabled, loopStartMs, loopEndMs])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const endMs = audioTimeToMs(audio.duration)
    setDuration(audio.duration)
    setLoopEndMs(endMs)
    setLoopEndInput(formatTimeFromMs(endMs))
  }, [])

  const handleEnded = useCallback(() => {
    if (loopEnabled) {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = msToAudioTime(loopStartMs)
        audio.play()
      }
    } else {
      setIsPlaying(false)
    }
  }, [loopEnabled, loopStartMs])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const restart = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = loopEnabled ? msToAudioTime(loopStartMs) : 0
    if (!isPlaying) {
      audio.play()
      setIsPlaying(true)
    }
  }

  const resetLoopMarkers = () => {
    const endMs = durationMs > 0 ? durationMs : loopEndMs
    setLoopStartMs(0)
    setLoopEndMs(endMs)
    setLoopStartInput(formatTimeFromMs(0))
    setLoopEndInput(formatTimeFromMs(endMs))
    setLoopSetPhase('start')
  }

  const applyLoopStart = () => {
    const ms = parseTimeToMs(loopStartInput)
    if (ms !== null && ms >= 0 && ms < loopEndMs) {
      setLoopStartMs(ms)
      setLoopStartInput(formatTimeFromMs(ms))
    } else {
      setLoopStartInput(formatTimeFromMs(loopStartMs))
    }
  }

  const applyLoopEnd = () => {
    const ms = parseTimeToMs(loopEndInput)
    if (ms !== null && ms > loopStartMs && (durationMs === 0 || ms <= durationMs)) {
      setLoopEndMs(ms)
      setLoopEndInput(formatTimeFromMs(ms))
    } else {
      setLoopEndInput(formatTimeFromMs(loopEndMs))
    }
  }

  const setLoopFromCurrentTime = () => {
    const audio = audioRef.current
    if (!audio) return
    const ms = audioTimeToMs(audio.currentTime)
    if (loopSetPhase === 'start') {
      setLoopStartMs(ms)
      setLoopStartInput(formatTimeFromMs(ms))
      setLoopSetPhase('end')
    } else {
      if (ms > loopStartMs) {
        setLoopEndMs(ms)
        setLoopEndInput(formatTimeFromMs(ms))
      }
      setLoopSetPhase('start')
    }
  }

  const loopRangeLeft = durationMs > 0 ? (loopStartMs / durationMs) * 100 : 0
  const loopRangeWidth = durationMs > 0 ? ((loopEndMs - loopStartMs) / durationMs) * 100 : 0
  const loopPlayheadLeft = duration > 0 ? (currentTime / duration) * 100 : 0

  const surfaceStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
  }

  const labelStyle = {
    fontFamily: 'var(--font-display)',
    color: 'var(--text-tertiary)',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    fontSize: '13px',
    borderRadius: '10px',
    padding: '6px 10px',
    width: '100%',
    textAlign: 'center',
  }

  const ghostButtonStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    background: 'var(--bg-overlay)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)',
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={surfaceStyle}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="px-4 pb-4 flex flex-col gap-4">
        <WaveformScrubber
          audioUrl={audioUrl}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          getCurrentTime={() => audioRef.current?.currentTime ?? currentTime}
          loopStartMs={loopEnabled ? loopStartMs : undefined}
          loopEndMs={loopEnabled ? loopEndMs : undefined}
          onSeek={(t) => {
            const audio = audioRef.current
            if (!audio) return
            audio.currentTime = t
            setCurrentTime(t)
          }}
        />

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={restart}
            className="rounded-xl px-3 h-9 flex items-center justify-center transition-all active:scale-95 text-[12px] font-bold uppercase tracking-[0.06em]"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}
            title="Restart from loop start or beginning"
          >
            Restart
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg-base)',
              boxShadow: '0 4px 24px var(--accent-dim)',
            }}
          >
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>

          <button
            onClick={() => { setLoopEnabled(v => !v); setLoopSetPhase('start') }}
            className="rounded-xl px-3 h-9 flex items-center justify-center transition-all active:scale-95 text-[12px] font-bold uppercase tracking-[0.06em]"
            style={{
              fontFamily: 'var(--font-display)',
              background: loopEnabled ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              color: loopEnabled ? 'var(--accent)' : 'var(--text-secondary)',
              border: loopEnabled ? '1px solid var(--accent-border)' : '1px solid transparent',
            }}
            title={loopEnabled ? 'Disable loop' : 'Enable loop'}
          >
            Loop
          </button>
        </div>

        {/* Speed control */}
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={labelStyle}>
              Speed
            </span>
            <span
              className="text-sm font-black tabular-nums"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
            >
              {speed.toFixed(2)}×
            </span>
          </div>
          <div className="relative h-1.5 rounded-full" style={{ background: 'var(--bg-overlay)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${((speed - 0.4) / 0.85) * 100}%`,
                background: 'var(--accent)',
              }}
            />
            <input
              type="range"
              min={0.4}
              max={1.25}
              step={0.01}
              value={speed}
              onChange={e => onSpeedChange(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px]" style={labelStyle}>0.4×</span>
            <div className="flex gap-1.5">
              {[0.5, 0.6, 0.75, 1.0, 1.25].map(v => (
                <button
                  key={v}
                  onClick={() => onSpeedChange(v)}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: Math.abs(speed - v) < 0.01 ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                    color: Math.abs(speed - v) < 0.01 ? 'var(--accent)' : 'var(--text-tertiary)',
                    border: Math.abs(speed - v) < 0.01 ? '1px solid var(--accent-border)' : '1px solid transparent',
                  }}
                >
                  {v}×
                </button>
              ))}
            </div>
            <span className="text-[10px]" style={labelStyle}>1.25×</span>
          </div>
        </div>

        {/* Loop section */}
        {loopEnabled && (
          <div
            className="rounded-xl px-3 py-2 flex flex-col gap-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ ...labelStyle, color: 'var(--accent)' }}>
                Loop Section
              </span>
              <button
                onClick={resetLoopMarkers}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md transition-all active:scale-95"
                style={ghostButtonStyle}
                title="Reset loop markers to full track"
              >
                Reset loop
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={labelStyle}>Start</span>
                <input
                  type="text"
                  value={loopStartInput}
                  onChange={e => setLoopStartInput(e.target.value)}
                  onBlur={applyLoopStart}
                  onKeyDown={e => e.key === 'Enter' && applyLoopStart()}
                  placeholder="0:00"
                  style={inputStyle}
                />
              </div>
              <span
                className="text-[11px] font-bold pb-2"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}
              >
                →
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em]" style={labelStyle}>End</span>
                <input
                  type="text"
                  value={loopEndInput}
                  onChange={e => setLoopEndInput(e.target.value)}
                  onBlur={applyLoopEnd}
                  onKeyDown={e => e.key === 'Enter' && applyLoopEnd()}
                  placeholder="0:00"
                  style={inputStyle}
                />
              </div>
              <button
                onClick={setLoopFromCurrentTime}
                className="text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                }}
                title={loopSetPhase === 'start' ? 'Set start to current time' : 'Set end to current time'}
              >
                {loopSetPhase === 'start' ? 'Set ↑' : 'Set End'}
              </button>
            </div>

            {durationMs > 0 && (
              <div className="relative h-1.5 rounded-full" style={{ background: 'var(--bg-overlay)' }}>
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${loopRangeLeft}%`,
                    width: `${loopRangeWidth}%`,
                    background: 'var(--accent)',
                    opacity: 0.5,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 rounded-full"
                  style={{
                    left: `${loopPlayheadLeft}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}

            {(loopStartMs === loopEndMs || loopStartMs >= loopEndMs) ? (
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
                {loopSetPhase === 'start' ? 'Set ↑ marks start at current position' : 'Set End marks end at current position'}
              </p>
            ) : (
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
                {formatTimeFromMs(loopStartMs)} → {formatTimeFromMs(loopEndMs)}
                {' · '}
                {loopSetPhase === 'start' ? 'Set ↑ marks start' : 'Set End marks end'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
