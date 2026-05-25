import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { HomePage } from '@/pages/HomePage'
import { SongsPage } from '@/pages/SongsPage'
import { SongDetailPage } from '@/pages/SongDetailPage'
import { SessionDetailPage } from '@/pages/SessionDetailPage'
import { ExercisesPage } from '@/pages/ExercisesPage'
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage'
import { BookmarksPage } from '@/pages/BookmarksPage'
import { TunerPage } from '@/pages/TunerPage'
import { HelpPage } from '@/pages/HelpPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/help"
            element={
              <RequireAuth>
                <HelpPage />
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/songs/:id" element={<SongDetailPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/tuner" element={<TunerPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
