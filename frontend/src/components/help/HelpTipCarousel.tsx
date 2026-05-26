import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HELP_CARDS } from './helpCards'
import { HelpTipCard } from './HelpTipCard'

export interface HelpTipCarouselHandle {
  scrollToIndex: (index: number) => void
}

interface HelpTipCarouselProps {
  onIndexChange?: (index: number) => void
}

export const HelpTipCarousel = forwardRef<HelpTipCarouselHandle, HelpTipCarouselProps>(
  function HelpTipCarousel({ onIndexChange }, ref) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [showSwipeHint, setShowSwipeHint] = useState(true)
    const cardCount = HELP_CARDS.length

    const scrollToIndex = useCallback((index: number) => {
      const track = trackRef.current
      if (!track) return
      const clamped = Math.max(0, Math.min(index, cardCount - 1))
      const slide = track.children[clamped] as HTMLElement | undefined
      if (!slide) return
      track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
      setActiveIndex(clamped)
    }, [cardCount])

    useImperativeHandle(ref, () => ({ scrollToIndex }), [scrollToIndex])

    useEffect(() => {
      onIndexChange?.(activeIndex)
    }, [activeIndex, onIndexChange])

    useEffect(() => {
      const track = trackRef.current
      if (!track) return

      const handleScroll = () => {
        const slides = Array.from(track.children) as HTMLElement[]
        if (!slides.length) return
        const scrollLeft = track.scrollLeft
        let nearest = 0
        let minDist = Infinity
        slides.forEach((slide, i) => {
          const dist = Math.abs(slide.offsetLeft - scrollLeft)
          if (dist < minDist) {
            minDist = dist
            nearest = i
          }
        })
        setActiveIndex(nearest)
        if (nearest > 0) setShowSwipeHint(false)
      }

      track.addEventListener('scroll', handleScroll, { passive: true })
      return () => track.removeEventListener('scroll', handleScroll)
    }, [])

    return (
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, oklch(0.80 0.175 72 / 0.12), transparent 55%)',
            }}
          />

          <div
            ref={trackRef}
            className="help-carousel-track flex flex-1 min-h-0 overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            role="region"
            aria-roledescription="carousel"
            aria-label="Help tips"
          >
            {HELP_CARDS.map((card, i) => (
              <div
                key={card.id}
                className="help-carousel-slide snap-center snap-always"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${cardCount}`}
              >
                <HelpTipCard card={card} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 flex-shrink-0 px-2">
          {showSwipeHint && activeIndex < 2 && (
            <p className="text-center text-xs animate-fade-in" style={{ color: 'var(--text-tertiary)' }}>
              Swipe for more
            </p>
          )}

          <div className="flex items-center justify-center gap-4 w-full max-w-[17.5rem] mx-auto">
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Previous tip"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>

            <div className="flex items-center justify-center gap-1.5 flex-1" role="tablist" aria-label="Tip pages">
              {HELP_CARDS.map((card, i) => (
                <button
                  key={card.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Go to tip ${i + 1}: ${card.headline}`}
                  onClick={() => scrollToIndex(i)}
                  className="h-1.5 rounded-full transition-all duration-200"
                  style={{
                    width: i === activeIndex ? 20 : 6,
                    background: i === activeIndex ? 'var(--accent)' : 'var(--border-base)',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex === cardCount - 1}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-25"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Next tip"
            >
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    )
  },
)

export { HELP_CARDS }
