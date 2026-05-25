export const BPM_MIN = 40
export const BPM_MAX = 250
export const DIAL_SWEEP = 270
/** SVG degrees: 0 = 3 o'clock, clockwise; sweep starts bottom-left */
export const DIAL_START = 135

export function clampBpm(value: number, min = BPM_MIN, max = BPM_MAX): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function bpmToDialDeg(bpm: number, min = BPM_MIN, max = BPM_MAX): number {
  const t = (bpm - min) / (max - min)
  return DIAL_START + t * DIAL_SWEEP
}

export function dialDegToBpm(deg: number, min = BPM_MIN, max = BPM_MAX): number {
  const t = (deg - DIAL_START) / DIAL_SWEEP
  return clampBpm(min + t * (max - min), min, max)
}

export function bpmDeltaFromDragDeg(deltaDeg: number, min = BPM_MIN, max = BPM_MAX): number {
  return Math.round((deltaDeg * (max - min)) / DIAL_SWEEP)
}

export function getPointerAngleDeg(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const rad = Math.atan2(clientY - cy, clientX - cx)
  return ((rad * 180) / Math.PI + 360) % 360
}

export function normalizeDeltaDeg(delta: number): number {
  let d = delta % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/** Arc path for SVG (center cx,cy, radius r) */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startDeg))
  const y1 = cy + r * Math.sin(toRad(startDeg))
  const x2 = cx + r * Math.cos(toRad(endDeg))
  const y2 = cy + r * Math.sin(toRad(endDeg))
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}
