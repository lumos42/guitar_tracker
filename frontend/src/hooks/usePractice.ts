import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PracticeSession, PagedResponse } from '@/types'

export const practiceKeys = {
  all: ['practice'] as const,
  list: (songId?: number) => [...practiceKeys.all, 'list', songId] as const,
  detail: (id: number) => [...practiceKeys.all, id] as const,
}

export function usePracticeSessions(songId?: number) {
  return useQuery({
    queryKey: practiceKeys.list(songId),
    queryFn: () =>
      api.get<PagedResponse<PracticeSession>>('/practice-sessions', { params: songId ? { song_id: songId } : undefined }).then(r => r.data.items),
  })
}

export function usePracticeSession(id: number) {
  return useQuery({
    queryKey: practiceKeys.detail(id),
    queryFn: () => api.get<PracticeSession>(`/practice-sessions/${id}`).then(r => r.data),
  })
}

export function useCreatePracticeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { song_id: number; practiced_at: string; duration_seconds?: number; notes?: string }) =>
      api.post<PracticeSession>('/practice-sessions', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.all }),
  })
}

export function useDeletePracticeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/practice-sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: practiceKeys.all }),
  })
}
