export const BPM_MIN = 40
export const BPM_MAX = 250

export function clampBpm(value: number): number {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(value)))
}

export function effectiveSongBpm(baseBpm: number, speed: number): number {
  return clampBpm(baseBpm * speed)
}
