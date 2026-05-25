export function pickRandom<T extends { id: number }>(
  items: T[],
  excludeId?: number,
): T | null {
  const pool = excludeId != null ? items.filter((item) => item.id !== excludeId) : items
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}
