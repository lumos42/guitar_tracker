import { useState, useRef, useEffect, useCallback } from 'react'
import { Guitar } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const GUITAR_STRINGS = [
  { label: 'E', midi: 40, display: 'E2' },
  { label: 'A', midi: 45, display: 'A2' },
  { label: 'D', midi: 50, display: 'D3' },
  { label: 'G', midi: 55, display: 'G3' },
  { label: 'B', midi: 59, display: 'B3' },
  { label: 'e', midi: 64, display: 'E4' },
]

// Arc geometry constants (viewBox 300 x 160, center at 150,160)
const CX = 150
const CY = 160
const R_ARC = 120
const R_NEEDLE = 105
const ARC_HALF_DEG = 70  // ±70° from straight-up = 140° total span

// Pitch stability tuning
const PITCH_GATE_RMS = 0.0035   // attempt pitch detection (soft plucks)
const DISPLAY_GATE_RMS = 0.0035 // show / update note UI
const SILENCE_CLEAR_RMS = 0.0025 // clear display only when very quiet
const STABLE_TICKS = 4          // ~330 ms to lock at 60 fps / 5-frame UI ticks
const HYSTERESIS_CENTS = 32
const UI_FRAME_INTERVAL = 5
const EMA_NORMAL = 0.15
const EMA_ATTACK = 0.10
const ATTACK_DURATION_MS = 120

// ── Helpers ───────────────────────────────────────────────────

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg)
  const e = polarToXY(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

interface PitchResult {
  freq: number
  rms: number
}

function analyzePitch(buf: Float32Array, sampleRate: number): PitchResult {
  const SIZE = buf.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < PITCH_GATE_RMS) return { freq: -1, rms }

  let r1 = 0, r2 = SIZE - 1
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < 0.2) { r1 = i; break }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < 0.2) { r2 = SIZE - i; break }
  }

  const trimmed = buf.slice(r1, r2)
  const n = trimmed.length
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) c[i] += trimmed[j] * trimmed[j + i]
  }

  let d = 0
  while (d < n - 1 && c[d] > c[d + 1]) d++
  let maxVal = -1, maxPos = -1
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i }
  }
  if (maxPos <= 0) return { freq: -1, rms }

  let T0 = maxPos
  const x1 = c[T0 - 1] ?? c[T0]
  const x2 = c[T0]
  const x3 = c[T0 + 1] ?? c[T0]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a) T0 = T0 - b / (2 * a)

  return { freq: sampleRate / T0, rms }
}

function noteNumFloatFromFreq(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

/** If pitch looks like the 2nd harmonic of a guitar string, fold down one octave. */
function correctOctaveHarmonic(freq: number): number {
  for (const s of GUITAR_STRINGS) {
    const fundamental = midiToFreq(s.midi)
    const ratio = freq / fundamental
    if (ratio > 1.85 && ratio < 2.15) return freq / 2
  }
  return freq
}

function isNewPluck(rms: number, lastRms: number): boolean {
  const fromSilence = lastRms < 0.006 && rms >= DISPLAY_GATE_RMS * 1.15
  const jump = lastRms >= PITCH_GATE_RMS && rms >= lastRms * 1.6
  return fromSilence || jump
}

function hysteresisAllowsSwitch(
  lockedMidi: number,
  candidateMidi: number,
  noteNumFloat: number,
): boolean {
  if (candidateMidi === lockedMidi) return true
  const distFromLocked = Math.abs((noteNumFloat - lockedMidi) * 100)
  return distFromLocked >= HYSTERESIS_CENTS
}

interface DetectedNote {
  freq: number
  midi: number
  noteName: string
  octave: number
  cents: number
}

function detectNote(freq: number, referenceMidi?: number): DetectedNote | null {
  if (freq < 60 || freq > 1400) return null
  const noteNumFloat = noteNumFloatFromFreq(freq)
  const midi = referenceMidi ?? Math.round(noteNumFloat)
  const cents = (noteNumFloat - midi) * 100
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return { freq, midi, noteName, octave, cents }
}

function closestStringIndex(midi: number): number {
  let bestIdx = 0
  let bestDist = Infinity
  GUITAR_STRINGS.forEach((s, i) => {
    const dist = Math.abs(s.midi - midi)
    if (dist < bestDist) { bestDist = dist; bestIdx = i }
  })
  return bestDist <= 4 ? bestIdx : -1
}

function tuningColor(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 5) return 'oklch(0.72 0.17 145)'   // green – in tune
  if (abs <= 20) return 'oklch(0.78 0.16 60)'    // amber – close
  return 'var(--danger)'                           // red – off
}

function tuningLabel(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 5) return 'In Tune'
  if (cents < 0) return 'Flat'
  return 'Sharp'
}

// ── Gauge component ───────────────────────────────────────────

function TunerGauge({ cents, color }: { cents: number; color: string }) {
  const startDeg = 270 - ARC_HALF_DEG
  const endDeg = 270 + ARC_HALF_DEG
  const needleAngle = 270 + (cents / 50) * ARC_HALF_DEG

  const tickAngles = [-70, -35, 0, 35, 70].map((t) => 270 + t)
  const accentStart = 270
  const accentEnd = 270 + (cents / 50) * ARC_HALF_DEG

  const needleTip = polarToXY(CX, CY, R_NEEDLE, needleAngle)

  return (
    <svg viewBox="0 0 300 160" className="w-full" style={{ maxWidth: '320px' }}>
      {/* Background arc */}
      <path
        d={arcPath(CX, CY, R_ARC, startDeg, endDeg)}
        fill="none"
        stroke="var(--border-base)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Colored deviation arc */}
      {Math.abs(cents) > 1 && (
        <path
          d={arcPath(CX, CY, R_ARC,
            Math.min(accentStart, accentEnd),
            Math.max(accentStart, accentEnd)
          )}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          style={{ transition: 'stroke 0.2s' }}
        />
      )}

      {/* Tick marks */}
      {tickAngles.map((angleDeg, i) => {
        const inner = polarToXY(CX, CY, R_ARC - 10, angleDeg)
        const outer = polarToXY(CX, CY, R_ARC + 10, angleDeg)
        const isCenter = i === 2
        return (
          <line
            key={i}
            x1={inner.x} y1={inner.y}
            x2={outer.x} y2={outer.y}
            stroke={isCenter ? 'var(--border-strong)' : 'var(--border-subtle)'}
            strokeWidth={isCenter ? 2 : 1}
            strokeLinecap="round"
          />
        )
      })}

      {/* Needle */}
      <line
        x1={CX} y1={CY}
        x2={needleTip.x} y2={needleTip.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: 'x2 0.2s ease-out, y2 0.2s ease-out, stroke 0.3s' }}
      />

      {/* Pivot dot */}
      <circle cx={CX} cy={CY} r="5" fill={color} style={{ transition: 'fill 0.2s' }} />
      <circle cx={CX} cy={CY} r="2.5" fill="var(--bg-base)" />
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function TunerPage() {
  const [listening, setListening] = useState(false)
  const [permError, setPermError] = useState(false)
  const [note, setNote] = useState<DetectedNote | null>(null)
  const [targetIdx, setTargetIdx] = useState<number | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const bufRef = useRef(new Float32Array(2048))
  const smoothedFreqRef = useRef<number>(-1)
  const frameCountRef = useRef(0)
  const lockedNoteRef = useRef<DetectedNote | null>(null)
  const stableCountRef = useRef(0)
  const candidateMidiRef = useRef(-1)
  const lastRmsRef = useRef(0)
  const attackUntilRef = useRef(0)

  const analyze = useCallback(() => {
    const analyser = analyserRef.current
    const ctx = audioCtxRef.current
    if (!analyser || !ctx) return

    analyser.getFloatTimeDomainData(bufRef.current)
    const { freq: rawFreq, rms } = analyzePitch(bufRef.current, ctx.sampleRate)

    if (isNewPluck(rms, lastRmsRef.current)) {
      stableCountRef.current = 0
      candidateMidiRef.current = -1
      attackUntilRef.current = performance.now() + ATTACK_DURATION_MS
      if (rawFreq > 0) {
        smoothedFreqRef.current = correctOctaveHarmonic(rawFreq)
      }
    }
    lastRmsRef.current = rms

    if (rawFreq > 0) {
      const corrected = correctOctaveHarmonic(rawFreq)
      const alpha = performance.now() < attackUntilRef.current ? EMA_ATTACK : EMA_NORMAL
      smoothedFreqRef.current =
        smoothedFreqRef.current < 0
          ? corrected
          : alpha * corrected + (1 - alpha) * smoothedFreqRef.current
    }

    frameCountRef.current++
    const uiTick = frameCountRef.current % UI_FRAME_INTERVAL === 0

    if (uiTick && rms < SILENCE_CLEAR_RMS) {
      smoothedFreqRef.current = -1
      stableCountRef.current = 0
      candidateMidiRef.current = -1
      if (lockedNoteRef.current !== null) {
        lockedNoteRef.current = null
        setNote(null)
      }
    } else if (uiTick && smoothedFreqRef.current > 0 && rms >= DISPLAY_GATE_RMS) {
      const noteNumFloat = noteNumFloatFromFreq(smoothedFreqRef.current)
      const candidateMidi = Math.round(noteNumFloat)

      if (candidateMidi === candidateMidiRef.current) {
        stableCountRef.current++
      } else {
        candidateMidiRef.current = candidateMidi
        stableCountRef.current = 1
      }

      const locked = lockedNoteRef.current
      let nextLocked = locked

      if (!locked) {
        if (stableCountRef.current >= STABLE_TICKS) {
          nextLocked = detectNote(smoothedFreqRef.current, candidateMidi)
        }
      } else if (
        candidateMidi !== locked.midi &&
        stableCountRef.current >= STABLE_TICKS &&
        hysteresisAllowsSwitch(locked.midi, candidateMidi, noteNumFloat)
      ) {
        nextLocked = detectNote(smoothedFreqRef.current, candidateMidi)
      }

      if (nextLocked) {
        lockedNoteRef.current = nextLocked
        const display = detectNote(smoothedFreqRef.current, nextLocked.midi)
        if (display) setNote(display)
      } else if (locked) {
        const display = detectNote(smoothedFreqRef.current, locked.midi)
        if (display) setNote(display)
      }
    }

    rafRef.current = requestAnimationFrame(analyze)
  }, [])

  async function startListening() {
    setPermError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)
      setListening(true)
      rafRef.current = requestAnimationFrame(analyze)
    } catch {
      setPermError(true)
    }
  }

  function stopListening() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    smoothedFreqRef.current = -1
    frameCountRef.current = 0
    lockedNoteRef.current = null
    stableCountRef.current = 0
    candidateMidiRef.current = -1
    lastRmsRef.current = 0
    attackUntilRef.current = 0
    setListening(false)
    setNote(null)
  }

  useEffect(() => {
    startListening()
    return () => stopListening()
  }, [])

  const displayNote = note
  const centsOff = displayNote?.cents ?? 0
  const clampedCents = Math.max(-50, Math.min(50, centsOff))
  const color = displayNote ? tuningColor(centsOff) : 'var(--border-base)'
  const activeStringIdx = displayNote ? closestStringIndex(displayNote.midi) : -1
  const highlightIdx = targetIdx !== null ? targetIdx : activeStringIdx

  // If user has selected a target string, show cents relative to that string
  let displayCents = clampedCents
  let displayLabel = displayNote ? tuningLabel(centsOff) : ''
  if (targetIdx !== null && displayNote) {
    const targetMidi = GUITAR_STRINGS[targetIdx].midi
    const targetFreq = midiToFreq(targetMidi)
    const rawCents = 1200 * Math.log2(displayNote.freq / targetFreq)
    displayCents = Math.max(-50, Math.min(50, rawCents))
    displayLabel = tuningLabel(rawCents)
  }

  return (
    <div className="px-5 pt-14 pb-8 animate-fade-up">
      <h1
        className="text-3xl font-black mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Tuner
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>
        Standard tuning · E A D G B e
      </p>

      {/* String selector */}
      <div
        className="flex gap-2 mb-8 p-3 rounded-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        {GUITAR_STRINGS.map((s, i) => {
          const isHighlighted = highlightIdx === i
          return (
            <button
              key={i}
              onClick={() => setTargetIdx(targetIdx === i ? null : i)}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:scale-[0.94]"
              style={{
                background: isHighlighted ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${isHighlighted ? 'var(--accent-border)' : 'transparent'}`,
              }}
            >
              <span
                className="text-base font-black"
                style={{ fontFamily: 'var(--font-display)', color: isHighlighted ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {s.label}
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: isHighlighted ? 'var(--accent)' : 'var(--text-tertiary)' }}
              >
                {midiToFreq(s.midi).toFixed(0)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Gauge */}
      <div className="flex justify-center mb-4">
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <TunerGauge cents={listening ? displayCents : 0} color={color} />
        </div>
      </div>

      {/* Note display */}
      <div className="flex flex-col items-center gap-1 mb-8">
        {displayNote && listening ? (
          <>
            <div className="flex items-end gap-1">
              <span
                className="text-7xl font-black leading-none"
                style={{ fontFamily: 'var(--font-display)', color }}
              >
                {displayNote.noteName}
              </span>
              <span
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
              >
                {displayNote.octave}
              </span>
            </div>
            <p className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {displayNote.freq.toFixed(1)} Hz
            </p>
            <p
              className="text-base font-bold mt-1"
              style={{ fontFamily: 'var(--font-display)', color }}
            >
              {displayLabel === 'In Tune'
                ? 'In Tune ✓'
                : `${Math.abs(Math.round(displayCents))} cents ${displayCents < 0 ? 'flat' : 'sharp'}`}
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
            >
              <Guitar size={28} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
            </div>
            <p
              className="font-bold text-base"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {permError ? 'Mic access denied' : 'Start tuning'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {permError
                ? 'Allow microphone access to use the tuner'
                : 'Play a string to tune'}
            </p>
          </div>
        )}
      </div>

      {listening && (
        <p className="text-center text-xs mt-2 animate-fade-in" style={{ color: 'var(--text-tertiary)' }}>
          Listening · Play a string clearly
        </p>
      )}
    </div>
  )
}
