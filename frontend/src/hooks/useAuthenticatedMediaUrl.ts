import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAuthenticatedMediaUrl(streamUrl?: string) {
  const query = useQuery({
    queryKey: ['authenticated-media-url', streamUrl],
    queryFn: async () => {
      if (!streamUrl) return null
      const requestPath = streamUrl.startsWith('/api/v1/')
        ? streamUrl.replace('/api/v1', '')
        : streamUrl
      const response = await api.get<Blob>(requestPath, { responseType: 'blob' })
      return URL.createObjectURL(response.data)
    },
    enabled: Boolean(streamUrl),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    return () => {
      if (query.data?.startsWith('blob:')) {
        URL.revokeObjectURL(query.data)
      }
    }
  }, [query.data])

  return query
}
