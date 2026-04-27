import { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, RotateCcw, Repeat2, Gauge } from 'lucide-react'

interface SongPlayerProps {
  audioUrl: string
  title: string
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseTime(value: string): number | null {
  const parts = value.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseFloat(parts[1])
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const raw = parseFloat(value)
  return isNaN(raw) ? null : raw
}

export function SongPlayer({ audioUrl, title }: SongPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1.0)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(0)
  const [loopStartInput, setLoopStartInput] = useState('0:00')
  const [loopEndInput, setLoopEndInput] = useState('0:00')

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

    if (loopEnabled && audio.currentTime >= loopEnd && loopEnd > loopStart) {
      audio.currentTime = loopStart
    }
  }, [loopEnabled, loopStart, loopEnd])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration)
    setLoopEnd(audio.duration)
    setLoopEndInput(formatTime(audio.duration))
  }, [])

  const handleEnded = useCallback(() => {
    if (loopEnabled) {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = loopStart
        audio.play()
      }
    } else {
      setIsPlaying(false)
    }
  }, [loopEnabled, loopStart])

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const t = parseFloat(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const restart = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = loopEnabled ? loopStart : 0
    if (!isPlaying) {
      audio.play()
      setIsPlaying(true)
    }
  }

  const applyLoopStart = () => {
    const t = parseTime(loopStartInput)
    if (t !== null && t >= 0 && t < loopEnd) {
      setLoopStart(t)
      setLoopStartInput(formatTime(t))
    } else {
      setLoopStartInput(formatTime(loopStart))
    }
  }

  const applyLoopEnd = () => {
    const t = parseTime(loopEndInput)
    if (t !== null && t > loopStart && t <= duration) {
      setLoopEnd(t)
      setLoopEndInput(formatTime(t))
    } else {
      setLoopEndInput(formatTime(loopEnd))
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

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
    width: '72px',
    textAlign: 'center',
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

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
        >
          <Gauge size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <p
          className="text-xs font-bold uppercase tracking-[0.08em] flex-1 truncate"
          style={labelStyle}
        >
          Player — {title}
        </p>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-4">
        {/* Seek bar */}
        <div className="flex flex-col gap-1.5">
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-none"
              style={{ width: `${progress}%`, background: 'var(--accent)' }}
            />
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              {formatTime(currentTime)}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={restart}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            title="Restart"
          >
            <RotateCcw size={16} />
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
            onClick={() => setLoopEnabled(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: loopEnabled ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              color: loopEnabled ? 'var(--accent)' : 'var(--text-secondary)',
              border: loopEnabled ? '1px solid var(--accent-border)' : '1px solid transparent',
            }}
            title={loopEnabled ? 'Disable loop' : 'Enable loop'}
          >
            <Repeat2 size={16} />
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
                width: `${((speed - 0.4) / 0.6) * 100}%`,
                background: 'var(--accent)',
              }}
            />
            <input
              type="range"
              min={0.4}
              max={1.0}
              step={0.05}
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px]" style={labelStyle}>0.4×</span>
            <div className="flex gap-1.5">
              {[0.5, 0.6, 0.75, 1.0].map(v => (
                <button
                  key={v}
                  onClick={() => setSpeed(v)}
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
            <span className="text-[10px]" style={labelStyle}>1.0×</span>
          </div>
        </div>

        {/* Loop section */}
        {loopEnabled && (
          <div
            className="rounded-xl p-3 flex flex-col gap-3"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ ...labelStyle, color: 'var(--accent)' }}>
              Loop Section
            </span>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 flex-1">
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
              <div
                className="flex-shrink-0 text-[11px] font-bold mt-4"
                style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}
              >
                →
              </div>
              <div className="flex flex-col gap-1 flex-1">
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
              <div className="flex flex-col gap-1 flex-shrink-0 mt-4">
                <button
                  onClick={() => {
                    const audio = audioRef.current
                    if (!audio) return
                    const t = audio.currentTime
                    setLoopStart(t)
                    setLoopStartInput(formatTime(t))
                  }}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}
                  title="Set start to current time"
                >
                  Set ↑
                </button>
              </div>
            </div>

            {/* Visual loop range on seek bar */}
            {duration > 0 && (
              <div className="relative h-1.5 rounded-full" style={{ background: 'var(--bg-overlay)' }}>
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${(loopStart / duration) * 100}%`,
                    width: `${((loopEnd - loopStart) / duration) * 100}%`,
                    background: 'var(--accent)',
                    opacity: 0.5,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 rounded-full"
                  style={{
                    left: `${(currentTime / duration) * 100}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              Loops {formatTime(loopStart)} → {formatTime(loopEnd)} · tap "Set ↑" at current position to mark start
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
