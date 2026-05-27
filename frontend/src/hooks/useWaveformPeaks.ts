import { useEffect, useState } from 'react'
import {
  decodeAudioPeaks,
  getCachedPeaks,
  type WaveformPeaks,
} from '@/lib/waveformPeaks'

interface UseWaveformPeaksOptions {
  enabled?: boolean
}

export function useWaveformPeaks(
  audioUrl: string | undefined,
  { enabled = false }: UseWaveformPeaksOptions = {},
) {
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(() =>
    audioUrl ? getCachedPeaks(audioUrl) ?? null : null,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!audioUrl || !enabled) return

    const cached = getCachedPeaks(audioUrl)
    if (cached) {
      setPeaks(cached)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    decodeAudioPeaks(audioUrl)
      .then((result) => {
        if (!cancelled) {
          setPeaks(result)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [audioUrl, enabled])

  return { peaks, isLoading, error }
}
