import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { FloatingMetronome } from '@/components/FloatingMetronome'
import { InstallBanner } from '@/components/pwa/InstallBanner'

export function AppShell() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-lg mx-auto">
        <InstallBanner />
      </div>
      <main className="max-w-lg mx-auto pb-28">
        <Outlet />
      </main>
      <BottomNav />
      <FloatingMetronome />
    </div>
  )
}
