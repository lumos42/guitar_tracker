import type { ReactNode } from 'react'
import { Mail, Music2 } from 'lucide-react'
import type { HelpCardId } from './helpCards'

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

function StaticTunerGauge() {
  const CX = 150
  const CY = 160
  const R_ARC = 120
  const R_NEEDLE = 105
  const startDeg = 200
  const endDeg = 340
  const needleAngle = 270
  const needleTip = polarToXY(CX, CY, R_NEEDLE, needleAngle)
  const color = 'var(--accent)'

  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-[260px] mx-auto" aria-hidden>
      <path
        d={arcPath(CX, CY, R_ARC, startDeg, endDeg)}
        fill="none"
        stroke="var(--border-base)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={arcPath(CX, CY, R_ARC, 270, needleAngle)}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {[200, 235, 270, 305, 340].map((angleDeg, i) => {
        const inner = polarToXY(CX, CY, R_ARC - 10, angleDeg)
        const outer = polarToXY(CX, CY, R_ARC + 10, angleDeg)
        const isCenter = i === 2
        return (
          <line
            key={angleDeg}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={isCenter ? 'var(--border-strong)' : 'var(--border-subtle)'}
            strokeWidth={isCenter ? 2 : 1}
            strokeLinecap="round"
          />
        )
      })}
      <line
        x1={CX}
        y1={CY}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r="5" fill={color} />
      <circle cx={CX} cy={CY} r="2.5" fill="var(--bg-elevated)" />
    </svg>
  )
}

function MetronomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2 L20 22 H4 Z" />
      <line x1="12" y1="7" x2="16.5" y2="18" />
      <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function WelcomeVisual() {
  const tiles = [
    { rot: -6, z: 1, opacity: 0.45 },
    { rot: 4, z: 2, opacity: 0.65 },
    { rot: -2, z: 3, opacity: 1 },
  ]
  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[12rem]">
      {tiles.map((t, i) => (
        <div
          key={i}
          className="absolute w-[5.5rem] h-[5.5rem] rounded-2xl"
          style={{
            transform: `rotate(${t.rot}deg) translateX(${(i - 1) * 32}px) translateY(${(i - 1) * -4}px)`,
            zIndex: t.z,
            opacity: t.opacity,
            background:
              i === 2
                ? 'linear-gradient(135deg, oklch(0.22 0.04 55), oklch(0.18 0.02 50))'
                : 'var(--bg-overlay)',
            border: `1px solid ${i === 2 ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
            boxShadow: i === 2 ? '0 8px 32px oklch(0 0 0 / 0.35)' : undefined,
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <Music2
              size={i === 2 ? 32 : 24}
              strokeWidth={1.5}
              style={{ color: i === 2 ? 'var(--accent)' : 'var(--text-tertiary)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function MetronomeVisual() {
  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[12rem]">
      <div
        className="absolute inset-x-3 top-2 bottom-2 rounded-2xl opacity-50"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
        }}
      />
      <div className="relative">
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ animation: 'pulse-ring 0.8s ease-out infinite', background: 'var(--accent)' }}
        />
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 60,
            height: 60,
            background: 'var(--accent)',
            border: '2px solid var(--accent-hover)',
            boxShadow: '0 0 22px var(--accent-dim), 0 4px 18px oklch(0 0 0 / 0.5)',
            color: 'var(--bg-base)',
          }}
        >
          <MetronomeIcon />
        </div>
      </div>
    </div>
  )
}

function SongsVisual() {
  return (
    <div className="flex flex-col gap-4 justify-center w-full h-full min-h-[12rem] px-1">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, oklch(0.25 0.05 60), oklch(0.18 0.02 50))',
            border: '1px solid var(--accent-border)',
          }}
        >
          <Music2 size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Wonderwall
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
            Oasis
          </p>
        </div>
      </div>
      <div
        className="rounded-xl px-3 py-2.5 flex flex-col gap-2"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-base)' }}>
          <div className="h-full w-[38%] rounded-full" style={{ background: 'var(--accent)' }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Speed
          </span>
          <span
            className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}
          >
            0.75×
          </span>
          <span
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--danger)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
            Rec
          </span>
        </div>
      </div>
    </div>
  )
}

function ExercisesVisual() {
  const bpms = [72, 80, 88, 96, 104]
  const max = Math.max(...bpms)
  return (
    <div className="flex flex-col justify-center w-full h-full min-h-[12rem] gap-4 px-1">
      <p
        className="text-sm font-semibold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Chromatic runs
      </p>
      <div className="flex items-end gap-1.5 h-[6.5rem]">
        {bpms.map((bpm, i) => (
          <div key={bpm} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(bpm / max) * 100}%`,
                minHeight: 8,
                background: i === bpms.length - 1 ? 'var(--accent)' : 'var(--border-base)',
              }}
            />
            <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              {bpm}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartsVisual() {
  const grid = ['C', 'Am', 'F', 'G']
  return (
    <div className="grid grid-cols-2 gap-2 w-full h-full min-h-[12rem]">
      <div
        className="rounded-xl p-2.5 flex flex-col gap-1.5"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Chord chart
        </p>
        <div className="grid grid-cols-2 gap-1 flex-1">
          {grid.map((ch) => (
            <div
              key={ch}
              className="rounded-md flex items-center justify-center text-xs font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--bg-overlay)',
                color: 'var(--accent)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {ch}
            </div>
          ))}
        </div>
      </div>
      <div
        className="rounded-xl p-2.5 flex flex-col gap-1"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Notes
        </p>
        <div className="flex flex-col gap-1.5 flex-1 justify-center">
          {['Bridge: slow down', 'Verse: clean muting'].map((line) => (
            <p key={line} className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeedbackVisual() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[12rem] gap-3">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
      >
        <Mail size={32} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
      </div>
    </div>
  )
}

const VISUALS: Record<HelpCardId, () => ReactNode> = {
  welcome: WelcomeVisual,
  metronome: MetronomeVisual,
  tuner: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[12rem]">
      <StaticTunerGauge />
    </div>
  ),
  songs: SongsVisual,
  exercises: ExercisesVisual,
  charts: ChartsVisual,
  feedback: FeedbackVisual,
}

export function HelpCardVisual({ id }: { id: HelpCardId }) {
  const Visual = VISUALS[id]
  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <Visual />
    </div>
  )
}
