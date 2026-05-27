let sharedStream: MediaStream | null = null
let holdCount = 0
let lifecycleBound = false

export async function acquireMicStream(): Promise<MediaStream> {
  if (sharedStream?.active) {
    holdCount += 1
    return sharedStream
  }

  holdCount += 1
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    return sharedStream
  } catch (error) {
    holdCount = Math.max(0, holdCount - 1)
    throw error
  }
}

export function releaseMicStream(): void {
  holdCount = Math.max(0, holdCount - 1)
  if (holdCount === 0) {
    sharedStream?.getTracks().forEach((track) => track.stop())
    sharedStream = null
  }
}

export function stopSharedMicStream(): void {
  holdCount = 0
  sharedStream?.getTracks().forEach((track) => track.stop())
  sharedStream = null
}

export function initMicStreamLifecycle(): void {
  if (lifecycleBound || typeof window === 'undefined') return
  lifecycleBound = true

  window.addEventListener('pagehide', stopSharedMicStream)
  window.addEventListener('beforeunload', stopSharedMicStream)
}
