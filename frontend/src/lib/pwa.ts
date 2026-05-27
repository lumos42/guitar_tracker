const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(navigator.standalone)
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}

export function isInstallDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const dismissedAt = Number(raw)
  if (Number.isNaN(dismissedAt)) return false
  return Date.now() - dismissedAt < DISMISS_TTL_MS
}

export function dismissInstallPrompt(): void {
  localStorage.setItem(DISMISS_KEY, String(Date.now()))
}

export function clearInstallDismissal(): void {
  localStorage.removeItem(DISMISS_KEY)
}
