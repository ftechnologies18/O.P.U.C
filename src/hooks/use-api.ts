'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// GET hook
export function useApiGet<T>(key: string[], url: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Erreur réseau' }))
        throw new Error(error.error || `Erreur ${res.status}`)
      }
      return res.json() as Promise<T>
    },
    ...options,
  })
}

// POST/PUT/DELETE mutation hook
export function useApiMutation<TData, TResponse = unknown>(url: string, method: 'POST' | 'PUT' | 'DELETE' = 'POST') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data?: TData) => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Erreur réseau' }))
        throw new Error(error.error || `Erreur ${res.status}`)
      }
      return res.json() as Promise<TResponse>
    },
  })
}
