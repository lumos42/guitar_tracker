import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useMetronomeStore } from '@/store/metronomeStore'
import { useLogBpm } from '@/hooks/useExercises'
import { useTapTempo } from '@/hooks/useTapTempo'
import { MetronomeDial } from '@/components/MetronomeDial'
import { BPM_MIN, BPM_MAX } from '@/lib/metronomeDial'

function MetronomeIcon({ size = 20, strokeWidth = 1.8, className = '' }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2 L20 22 H4 Z" />
      <line x1="12" y1="7" x2="16.5" y2="18" />
      <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

const TIME_SIGS = [2, 3, 4, 6] as const
const LOOK_AHEAD = 0.1
const SCHEDULE_INTERVAL = 25

export function FloatingMetronome() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const bpm = useMetronomeStore((s) => s.bpm)
  const beatsPerBar = useMetronomeStore((s) => s.beatsPerBar)
  const activeExerciseId = useMetronomeStore((s) => s.activeExerciseId)
  const setBpm = useMetronomeStore((s) => s.setBpm)
  const setBeatsPerBar = useMetronomeStore((s) => s.setBeatsPerBar)
  const logBpm = useLogBpm()

  const { onTap, tapCount, isTapping } = useTapTempo(setBpm, BPM_MIN, BPM_MAX)

  const isPlayingRef = useRef(false)
  const bpmRef = useRef(120)
  const beatsPerBarRef = useRef(4)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextBeatTimeRef = useRef(0)
  const currentBeatRef = useRef(0)
  const schedulerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { beatsPerBarRef.current = beatsPerBar }, [beatsPerBar])

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function scheduleClick(time: number, beat: number) {
    const ctx = audioCtxRef.current!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = beat === 0 ? 1050 : 820
    const vol = beat === 0 ? 0.65 : 0.4
    gain.gain.setValueAtTime(vol, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055)
    osc.start(time)
    osc.stop(time + 0.06)
  }

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || !isPlayingRef.current) return
    while (nextBeatTimeRef.current < ctx.currentTime + LOOK_AHEAD) {
      const beat = currentBeatRef.current
      scheduleClick(nextBeatTimeRef.current, beat)
      const schedTime = nextBeatTimeRef.current
      const delay = Math.max(0, (schedTime - ctx.currentTime) * 1000)
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentBeat(beat)
      }, delay)
      currentBeatRef.current = (beat + 1) % beatsPerBarRef.current
      nextBeatTimeRef.current += 60 / bpmRef.current
    }
    schedulerTimerRef.current = setTimeout(scheduler, SCHEDULE_INTERVAL)
  }, [])

  function startMetronome() {
    const ctx = getAudioCtx()
    nextBeatTimeRef.current = ctx.currentTime + 0.05
    currentBeatRef.current = 0
    isPlayingRef.current = true
    setIsPlaying(true)
    if (activeExerciseId) {
      logBpm.mutate({ id: activeExerciseId, bpm: bpmRef.current })
    }
    scheduler()
  }

  function stopMetronome() {
    isPlayingRef.current = false
    setIsPlaying(false)
    setCurrentBeat(-1)
    if (schedulerTimerRef.current) {
      clearTimeout(schedulerTimerRef.current)
      schedulerTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopMetronome()
      audioCtxRef.current?.close()
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    didLongPressRef.current = false
    pressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      setExpanded((prev) => !prev)
    }, 450)
  }

  function handlePointerUp() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (!didLongPressRef.current) {
      if (isPlayingRef.current) stopMetronome()
      else startMetronome()
    }
    didLongPressRef.current = false
  }

  function handlePointerCancel() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    didLongPressRef.current = false
  }

  const tapHint = tapCount < 2 ? 'Tap again' : null

  return (
    <div
      className="fixed z-40 flex flex-col items-end"
      style={{ bottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 72px)', right: '16px' }}
    >
      {expanded && (
        <div
          className="mb-3 rounded-2xl animate-scale-in flex flex-col items-center"
          style={{
            background: 'oklch(0.14 0.008 50)',
            border: '1px solid var(--border-base)',
            boxShadow: '0 8px 40px oklch(0 0 0 / 0.55)',
            width: '272px',
            padding: 'var(--space-4)',
          }}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
            >
              Metronome
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label="Close metronome"
            >
              <X size={14} />
            </button>
          </div>

          {/* Beat dots */}
          <div className="flex gap-2 justify-center mb-3">
            {Array.from({ length: beatsPerBar }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full transition-all duration-75"
                style={{
                  background: isPlaying && currentBeat === i
                    ? i === 0 ? 'var(--accent)' : 'oklch(0.65 0.12 72)'
                    : 'var(--border-base)',
                  transform: isPlaying && currentBeat === i ? 'scale(1.35)' : 'scale(1)',
                  boxShadow: isPlaying && currentBeat === i && i === 0 ? '0 0 10px var(--accent-dim)' : 'none',
                }}
              />
            ))}
          </div>

          {/* BPM readout */}
          <div className="text-center mb-2">
            <p
              className="text-3xl font-black tabular-nums leading-none"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {bpm}
            </p>
            <p
              className="text-[10px] uppercase tracking-widest mt-0.5"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
            >
              bpm
            </p>
          </div>

          <MetronomeDial bpm={bpm} onBpmChange={setBpm} />

          <button
            type="button"
            onClick={onTap}
            className="w-full h-10 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] mt-3 active:scale-[0.97] transition-transform"
            style={{
              fontFamily: 'var(--font-display)',
              background: isTapping ? 'var(--accent-dim)' : 'var(--bg-overlay)',
              color: isTapping ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${isTapping ? 'var(--accent-border)' : 'var(--border-base)'}`,
            }}
            aria-label={tapHint ? 'Tap tempo — tap again to set' : 'Tap tempo'}
          >
            {tapHint ?? 'Tap'}
          </button>

          {/* Time signature */}
          <div className="flex gap-1.5 w-full mt-3">
            {TIME_SIGS.map((sig) => (
              <button
                key={sig}
                onClick={() => {
                  setBeatsPerBar(sig)
                  beatsPerBarRef.current = sig
                  if (isPlayingRef.current) {
                    stopMetronome()
                    setTimeout(startMetronome, 60)
                  }
                }}
                className="flex-1 h-8 rounded-xl text-[11px] font-bold transition-all active:scale-[0.93]"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: beatsPerBar === sig ? 'var(--accent)' : 'var(--bg-overlay)',
                  color: beatsPerBar === sig ? 'var(--bg-base)' : 'var(--text-secondary)',
                  border: `1px solid ${beatsPerBar === sig ? 'var(--accent)' : 'var(--border-base)'}`,
                }}
              >
                {sig}/4
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative flex items-center justify-center rounded-full select-none touch-none"
        aria-label={isPlaying ? 'Stop metronome' : 'Start metronome (long press for options)'}
        style={{
          width: '52px',
          height: '52px',
          background: isPlaying ? 'var(--accent)' : 'oklch(0.15 0.008 50)',
          border: `2px solid ${isPlaying ? 'var(--accent-hover)' : 'var(--border-base)'}`,
          boxShadow: isPlaying
            ? '0 0 22px var(--accent-dim), 0 4px 18px oklch(0 0 0 / 0.5)'
            : '0 4px 18px oklch(0 0 0 / 0.45)',
          color: isPlaying ? 'var(--bg-base)' : 'var(--text-secondary)',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
        }}
      >
        {isPlaying && (
          <span
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ animation: 'pulse-ring 0.8s ease-out infinite', background: 'var(--accent)' }}
          />
        )}
        <MetronomeIcon size={22} strokeWidth={isPlaying ? 2.2 : 1.8} className="relative z-10" />
      </button>
    </div>
  )
}
