import { Link } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'

export function HelpPage() {
  return (
    <div
      className="min-h-dvh max-w-lg mx-auto px-5 flex flex-col"
      style={{
        background: 'var(--bg-base)',
        paddingTop: 'max(var(--space-8), env(safe-area-inset-top))',
        paddingBottom: 'max(var(--space-8), env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
      >
        <HelpCircle size={28} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
      </div>

      <h1
        className="text-3xl font-black leading-tight mb-3"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Help
      </h1>

      <p className="text-base mb-8" style={{ color: 'var(--text-secondary)', maxWidth: '40ch' }}>
        We're building a dedicated guide for Guitar Tracker — tips on songs, exercises, recording,
        and getting the most from practice sessions.
      </p>

      <Link
        to="/"
        className="inline-flex items-center justify-center h-12 px-5 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] w-fit"
        style={{
          fontFamily: 'var(--font-display)',
          background: 'var(--accent)',
          color: 'var(--bg-base)',
          boxShadow: '0 4px 24px var(--accent-dim)',
        }}
      >
        Back to home
      </Link>
    </div>
  )
}
