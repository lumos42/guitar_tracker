import { HelpCardVisual } from './HelpCardVisuals'
import type { HelpCardContent } from './helpCards'

interface HelpTipCardProps {
  card: HelpCardContent
}

export function HelpTipCard({ card }: HelpTipCardProps) {
  return (
    <article
      className="help-tip-card flex flex-col"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 28,
      }}
      aria-labelledby={`help-card-title-${card.id}`}
    >
      <div className="help-tip-card__visual flex flex-1 flex-col justify-center items-center min-h-0 px-5 pt-6 pb-4">
        <HelpCardVisual id={card.id} />
      </div>

      <div className="flex flex-col flex-shrink-0 px-5 pb-6 pt-2 gap-2.5">
        <p
          className="text-[11px] uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
        >
          {card.eyebrow}
        </p>

        <h2
          id={`help-card-title-${card.id}`}
          className="text-xl font-black leading-snug"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {card.headline}
        </h2>

        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {card.body}
        </p>

        {card.email && (
          <a
            href={`mailto:${card.email}`}
            className="text-sm font-semibold mt-1 w-fit transition-opacity hover:opacity-80 break-all"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
          >
            {card.email}
          </a>
        )}

        {card.gestures && card.gestures.length > 0 && (
          <ul
            className="flex flex-col gap-2.5 mt-2 pt-3 list-none m-0 p-0"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {card.gestures.map((g) => (
              <li key={g.label} className="flex flex-col gap-0.5 text-sm">
                <span
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
                >
                  {g.label}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>{g.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
