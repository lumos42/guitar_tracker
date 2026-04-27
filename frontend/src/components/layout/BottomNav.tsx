import { NavLink } from 'react-router-dom'
import { Music2, Dumbbell, BookMarked, Home, Gauge } from 'lucide-react'

const links = [
  { to: '/',           label: 'Home',     icon: Home },
  { to: '/songs',      label: 'Songs',    icon: Music2 },
  { to: '/exercises',  label: 'Practice', icon: Dumbbell },
  { to: '/tuner',      label: 'Tuner',    icon: Gauge },
  { to: '/bookmarks',  label: 'Learn',    icon: BookMarked },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: 'oklch(0.09 0.006 50 / 0.92)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-1 pt-2 pb-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex-1"
          >
            {({ isActive }) => (
              <div className="flex flex-col items-center gap-1.5 py-1 transition-all duration-150">
                <div className="relative">
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.2 : 1.7}
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}
                    className="transition-all duration-150"
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold tracking-wide transition-colors duration-150"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                >
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
