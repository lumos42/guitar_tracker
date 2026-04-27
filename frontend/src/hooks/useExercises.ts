import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Exercise, ExerciseBpmLog, PagedResponse } from '@/types'

export const exerciseKeys = {
  all: ['exercises'] as const,
  list: () => [...exerciseKeys.all, 'list'] as const,
  detail: (id: number) => [...exerciseKeys.all, id] as const,
  bpmLogs: (id: number) => [...exerciseKeys.all, id, 'bpm'] as const,
}

export function useExercises() {
  return useQuery({
    queryKey: exerciseKeys.list(),
    queryFn: () => api.get<PagedResponse<Exercise>>('/exercises').then(r => r.data.items),
  })
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: () => api.get<Exercise>(`/exercises/${id}`).then(r => r.data),
  })
}

export function useExerciseBpmLogs(id: number) {
  return useQuery({
    queryKey: exerciseKeys.bpmLogs(id),
    queryFn: () => api.get<{ items: ExerciseBpmLog[]; last_bpm: number | null }>(`/exercises/${id}/bpm`).then(r => r.data),
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormData) =>
      api.post<Exercise>('/exercises', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: exerciseKeys.all }),
  })
}

export function useLogBpm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, bpm }: { id: number; bpm: number }) =>
      api.post<ExerciseBpmLog>(`/exercises/${id}/bpm`, { bpm }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.list() })
      qc.invalidateQueries({ queryKey: exerciseKeys.bpmLogs(id) })
      qc.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/exercises/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: exerciseKeys.all }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch<Exercise>(`/exercises/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.list() })
      qc.invalidateQueries({ queryKey: exerciseKeys.detail(id) })
    },
  })
}
