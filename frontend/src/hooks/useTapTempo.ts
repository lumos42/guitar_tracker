import { useCallback, useEffect, useRef, useState } from 'react'

const TAP_RESET_MS = 2000
const MAX_INTERVALS = 4

export function useTapTempo(
  onBpm: (bpm: number) => void,
  min = 40,
  max = 250,
) {
  const tapsRef = useRef<number[]>([])
  const [tapCount, setTapCount] = useState(0)
  const [isTapping, setIsTapping] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  const onTap = useCallback(() => {
    const now = performance.now()
    const last = tapsRef.current[tapsRef.current.length - 1]

    if (last !== undefined && now - last > TAP_RESET_MS) {
      tapsRef.current = []
    }

    tapsRef.current = [...tapsRef.current, now]
    const taps = tapsRef.current
    setTapCount(taps.length)
    setIsTapping(true)

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      setIsTapping(false)
      setTapCount(0)
      tapsRef.current = []
    }, TAP_RESET_MS)

    if (taps.length >= 2) {
      const start = Math.max(0, taps.length - MAX_INTERVALS - 1)
      const intervals: number[] = []
      for (let i = start + 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }
      const avg = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length
      const bpm = Math.round(60000 / avg)
      onBpm(Math.max(min, Math.min(max, bpm)))
    }
  }, [onBpm, min, max])

  return { onTap, tapCount, isTapping }
}
