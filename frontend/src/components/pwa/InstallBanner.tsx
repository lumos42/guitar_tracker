import { Download, Share, X } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { isAndroid, isIos } from '@/lib/pwa'

export function InstallBanner() {
  const { showBanner, canNativeInstall, promptInstall, dismiss } = usePwaInstall()

  if (!showBanner) return null

  const onIos = isIos()
  const onAndroid = isAndroid()

  return (
    <div className="px-5 pt-3 pb-1">
      <div
        className="relative rounded-2xl p-4"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--accent-border)',
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Dismiss install prompt"
        >
          <X size={16} />
        </button>

        <p
          className="text-[11px] uppercase tracking-widest mb-1 pr-8"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
        >
          Install app
        </p>
        <p className="text-sm font-semibold mb-1 pr-6" style={{ color: 'var(--text-primary)' }}>
          Add Guitar Tracker to your home screen
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          Full-screen experience, no browser bar, and smoother microphone access.
        </p>

        {onIos && (
          <ol className="text-xs space-y-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex items-start gap-2">
              <Share size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <span>
                Tap <strong style={{ color: 'var(--text-primary)' }}>Share</strong> in Safari&apos;s toolbar
              </span>
            </li>
            <li>
              Choose <strong style={{ color: 'var(--text-primary)' }}>Add to Home Screen</strong>
            </li>
            <li>
              Confirm the name is <strong style={{ color: 'var(--text-primary)' }}>Guitar Tracker</strong> and turn{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Open as Web App</strong> on — this removes the browser
              bar and runs it like a native app
            </li>
            <li>Tap <strong style={{ color: 'var(--text-primary)' }}>Add</strong>, then open it from your home screen</li>
          </ol>
        )}

        {(onAndroid || canNativeInstall) && canNativeInstall && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'var(--accent)',
              color: 'oklch(0.12 0.01 50)',
            }}
          >
            <Download size={16} />
            Install now
          </button>
        )}

        {onAndroid && !canNativeInstall && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Open the browser menu and choose <strong style={{ color: 'var(--text-secondary)' }}>Install app</strong> or{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>Add to Home screen</strong>.
          </p>
        )}

        {!onIos && !onAndroid && !canNativeInstall && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Use your browser&apos;s install or &quot;Add to Home screen&quot; option when available.
          </p>
        )}
      </div>
    </div>
  )
}
