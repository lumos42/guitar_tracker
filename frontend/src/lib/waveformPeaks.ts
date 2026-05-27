/** Number of min/max peak buckets across the full track. */
export const PEAK_BUCKET_COUNT = 1200

export interface WaveformPeaks {
  /** Min amplitude per bucket, normalized 0–1. */
  mins: Float32Array
  /** Max amplitude per bucket, normalized 0–1. */
  maxs: Float32Array
  duration: number
  bucketCount: number
}

const peakCache = new Map<string, WaveformPeaks>()

export function getCachedPeaks(audioUrl: string): WaveformPeaks | undefined {
  return peakCache.get(audioUrl)
}

export function setCachedPeaks(audioUrl: string, peaks: WaveformPeaks): void {
  peakCache.set(audioUrl, peaks)
}

export function clearPeakCacheForUrl(audioUrl: string): void {
  peakCache.delete(audioUrl)
}

/**
 * Downsample mono channel data into min/max buckets for waveform rendering.
 */
export function extractPeaksFromChannelData(
  channelData: Float32Array,
  sampleRate: number,
  duration: number,
  bucketCount = PEAK_BUCKET_COUNT,
): WaveformPeaks {
  const mins = new Float32Array(bucketCount)
  const maxs = new Float32Array(bucketCount)
  const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount))

  for (let i = 0; i < bucketCount; i++) {
    const start = i * samplesPerBucket
    const end = Math.min(channelData.length, start + samplesPerBucket)
    let min = 0
    let max = 0
    for (let j = start; j < end; j++) {
      const v = channelData[j]
      if (v < min) min = v
      if (v > max) max = v
    }
    mins[i] = Math.abs(min)
    maxs[i] = Math.abs(max)
  }

  // Normalize to 0–1
  let peak = 0
  for (let i = 0; i < bucketCount; i++) {
    peak = Math.max(peak, mins[i], maxs[i])
  }
  if (peak > 0) {
    for (let i = 0; i < bucketCount; i++) {
      mins[i] /= peak
      maxs[i] /= peak
    }
  }

  return {
    mins,
    maxs,
    duration: duration > 0 ? duration : channelData.length / sampleRate,
    bucketCount,
  }
}

export async function decodeAudioPeaks(audioUrl: string): Promise<WaveformPeaks> {
  const cached = peakCache.get(audioUrl)
  if (cached) return cached

  const response = await fetch(audioUrl)
  const arrayBuffer = await response.arrayBuffer()

  const audioContext = new AudioContext()
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const channelData = audioBuffer.getChannelData(0)
    const peaks = extractPeaksFromChannelData(
      channelData,
      audioBuffer.sampleRate,
      audioBuffer.duration,
    )
    peakCache.set(audioUrl, peaks)
    return peaks
  } finally {
    await audioContext.close()
  }
}

/** Time (seconds) at the center of bucket index i. */
export function bucketTime(peaks: WaveformPeaks, index: number): number {
  if (peaks.bucketCount <= 1) return 0
  return (index / (peaks.bucketCount - 1)) * peaks.duration
}

/** Bucket index for a given time in seconds. */
export function timeToBucketIndex(peaks: WaveformPeaks, time: number): number {
  if (peaks.duration <= 0) return 0
  const t = Math.max(0, Math.min(peaks.duration, time))
  return Math.floor((t / peaks.duration) * (peaks.bucketCount - 1))
}
