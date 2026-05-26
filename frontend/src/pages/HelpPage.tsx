import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HelpTipCarousel, HELP_CARDS } from '@/components/help/HelpTipCarousel'
import type { HelpTipCarouselHandle } from '@/components/help/HelpTipCarousel'

export function HelpPage() {
  const navigate = useNavigate()
  const carouselRef = useRef<HelpTipCarouselHandle>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const isLast = activeIndex === HELP_CARDS.length - 1

  const finish = useCallback(() => {
    if (window.opener) {
      window.close()
      return
    }
    navigate('/')
  }, [navigate])

  const skipToEnd = useCallback(() => {
    carouselRef.current?.scrollToIndex(HELP_CARDS.length - 1)
  }, [])

  return (
    <div
      className="min-h-dvh max-w-lg mx-auto flex flex-col"
      style={{
        background: 'var(--bg-base)',
        paddingTop: 'max(var(--space-4), env(safe-area-inset-top))',
        paddingBottom: 'max(var(--space-6), env(safe-area-inset-bottom))',
      }}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-4 flex-shrink-0">
        <Link
          to="/"
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 active:scale-[0.97]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          aria-label="Back to home"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </Link>

        <h1
          className="text-sm font-bold uppercase tracking-[0.12em] flex-1 text-center"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
        >
          Quick tips
        </h1>

        {!isLast ? (
          <button
            type="button"
            onClick={skipToEnd}
            className="text-sm font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
          >
            Skip
          </button>
        ) : (
          <span className="w-[52px]" aria-hidden />
        )}
      </header>

      <main className="flex flex-col flex-1 min-h-0 px-2 pb-2">
        <HelpTipCarousel ref={carouselRef} onIndexChange={setActiveIndex} />
      </main>

      <footer className="px-5 pt-4 flex-shrink-0">
        {isLast ? (
          <Button variant="primary" size="lg" className="w-full" onClick={finish}>
            Got it — start playing
          </Button>
        ) : (
          <p className="text-center text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {activeIndex + 1} / {HELP_CARDS.length}
          </p>
        )}
      </footer>
    </div>
  )
}
