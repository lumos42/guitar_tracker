import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { sortSongsByRecentAccess } from '@/lib/utils'
import type { Song, SpotifyTrack, PagedResponse, ChordChart, Recording, DownloadStatus } from '@/types'

export const songKeys = {
  all: ['songs'] as const,
  list: (q?: string) => [...songKeys.all, 'list', q] as const,
  detail: (id: number) => [...songKeys.all, id] as const,
  downloadStatus: (id: number) => [...songKeys.detail(id), 'download-status'] as const,
  chordCharts: (id: number) => [...songKeys.detail(id), 'chord-charts'] as const,
  recordings: (id: number) => [...songKeys.detail(id), 'recordings'] as const,
}

export function useSongs(q?: string) {
  return useQuery({
    queryKey: songKeys.list(q),
    queryFn: () =>
      api
        .get<PagedResponse<Song>>('/songs', { params: { limit: 100, ...(q ? { q } : {}) } })
        .then((r) => sortSongsByRecentAccess(r.data.items)),
    refetchOnMount: 'always',
  })
}

export function useSong(id: number, pollWhileDownloading = false) {
  const qc = useQueryClient()
  const didInvalidateList = useRef(false)

  useEffect(() => {
    didInvalidateList.current = false
  }, [id])

  const query = useQuery({
    queryKey: songKeys.detail(id),
    queryFn: () => api.get<Song>(`/songs/${id}`).then(r => r.data),
    refetchInterval: (q) => {
      if (!pollWhileDownloading) return false
      const status = q.state.data?.download_status
      return status === 'pending' || status === 'downloading' ? 2000 : false
    },
  })

  useEffect(() => {
    if (query.data && !didInvalidateList.current) {
      didInvalidateList.current = true
      qc.invalidateQueries({ queryKey: songKeys.all })
    }
  }, [query.data, qc])

  return query
}

export function useCreateSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Song>) => api.post<Song>('/songs', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: songKeys.all }),
  })
}

export function useDeleteSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/songs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: songKeys.all }),
  })
}

export function useDownloadSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Song>(`/songs/${id}/download`).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(songKeys.detail(data.id), data)
      // Kick off status polling immediately
      qc.invalidateQueries({ queryKey: songKeys.downloadStatus(data.id) })
    },
  })
}

export const ACTIVE_DOWNLOAD_STATUSES: (string | null)[] = ['pending', 'downloading']

export function useDownloadStatus(songId: number, enabled = true) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: songKeys.downloadStatus(songId),
    queryFn: () =>
      api.get<DownloadStatus>(`/songs/${songId}/download-status`).then(r => r.data),
    enabled: enabled && Number.isFinite(songId) && songId > 0,
    refetchInterval: (q) => {
      const status = q.state.data?.download_status
      return ACTIVE_DOWNLOAD_STATUSES.includes(status ?? null) ? 3000 : false
    },
  })

  // When download transitions out of an active state, refresh the song detail.
  // This is done in useEffect (not select) to avoid triggering during render.
  const status = query.data?.download_status
  useEffect(() => {
    if (status != null && !ACTIVE_DOWNLOAD_STATUSES.includes(status)) {
      qc.invalidateQueries({ queryKey: songKeys.detail(songId) })
    }
  }, [status, songId, qc])

  return query
}

export function useDownloadLog(songId: number, enabled = true) {
  return useQuery({
    queryKey: [...songKeys.downloadStatus(songId), 'log'],
    queryFn: () =>
      api.get<{ log: string }>(`/songs/${songId}/download-log`).then(r => r.data.log),
    enabled: enabled && Number.isFinite(songId) && songId > 0,
    refetchInterval: enabled ? 3000 : false,
    staleTime: 0,
  })
}

export function useUpdateSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Song> }) =>
      api.patch<Song>(`/songs/${id}`, data).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(songKeys.detail(data.id), data)
      qc.invalidateQueries({ queryKey: songKeys.list() })
    },
  })
}

export function useSongChordCharts(songId: number) {
  return useQuery({
    queryKey: songKeys.chordCharts(songId),
    queryFn: () => api.get<ChordChart[]>(`/songs/${songId}/chord-charts`).then(r => r.data),
    enabled: Number.isFinite(songId) && songId > 0,
  })
}

export function useUploadChordChart(songId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, label }: { file: File; label?: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      if (label) formData.append('label', label)
      return api.post<ChordChart>(`/songs/${songId}/chord-charts`, formData).then(r => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: songKeys.chordCharts(songId) }),
  })
}

export function useSongRecordings(songId: number) {
  return useQuery({
    queryKey: songKeys.recordings(songId),
    queryFn: () => api.get<Recording[]>(`/recordings/songs/${songId}`).then(r => r.data),
    enabled: Number.isFinite(songId) && songId > 0,
  })
}

export function useUploadSongRecording(songId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, label }: { file: Blob; label?: string }) => {
      const formData = new FormData()
      const mimeType = file.type || 'audio/webm'
      const extension = mimeType.includes('mpeg')
        ? 'mp3'
        : mimeType.includes('wav')
          ? 'wav'
          : mimeType.includes('mp4')
            ? 'm4a'
            : mimeType.includes('ogg')
              ? 'ogg'
              : 'webm'
      formData.append('file', file, `recording-${Date.now()}.${extension}`)
      if (label) formData.append('label', label)
      return api.post<Recording>(`/recordings/songs/${songId}`, formData).then(r => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: songKeys.recordings(songId) })
      qc.invalidateQueries({ queryKey: songKeys.detail(songId) })
    },
  })
}

export function useSpotifySearch(q: string) {
  return useQuery({
    queryKey: ['spotify-search', q],
    queryFn: () => api.get<SpotifyTrack[]>('/spotify/search', { params: { q } }).then(r => r.data),
    enabled: q.length > 1,
    staleTime: 1000 * 30,
  })
}
