import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import type { User } from '@/types'

export function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setAccessToken, setUser } = useAuthStore()

  useEffect(() => {
    const token = params.get('access_token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    setAccessToken(token)
    api.get<User>('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        setUser(r.data)
        navigate('/', { replace: true })
      })
      .catch(() => navigate('/login', { replace: true }))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="w-8 h-8" />
        <p className="text-white/40 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
