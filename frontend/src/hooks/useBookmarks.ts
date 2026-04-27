import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Bookmark, PagedResponse } from '@/types'

export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  list: () => [...bookmarkKeys.all, 'list'] as const,
}

export function useBookmarks() {
  return useQuery({
    queryKey: bookmarkKeys.list(),
    queryFn: () => api.get<PagedResponse<Bookmark>>('/bookmarks').then(r => r.data.items),
  })
}

export function useCreateBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormData | Partial<Bookmark>) => {
      const isFormData = data instanceof FormData
      return api
        .post<Bookmark>('/bookmarks', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)
        .then(r => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bookmarkKeys.all }),
  })
}

export function useDeleteBookmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/bookmarks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bookmarkKeys.all }),
  })
}
