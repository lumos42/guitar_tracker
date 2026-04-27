import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { FloatingMetronome } from '@/components/FloatingMetronome'

export function AppShell() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-base)' }}>
      <main className="max-w-lg mx-auto pb-28">
        <Outlet />
      </main>
      <BottomNav />
      <FloatingMetronome />
    </div>
  )
}
