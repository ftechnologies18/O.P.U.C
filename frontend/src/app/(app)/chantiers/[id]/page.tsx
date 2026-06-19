'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { ChantierDetailView } from '@/components/chantiers/chantier-detail-view'

/**
 * Chantier detail route (`/chantiers/[id]`).
 *
 * The `ChantierDetailView` component reads the selected chantier id from the
 * Zustand store (`selectedChantierId`). This wrapper syncs the URL parameter
 * into the store so that the existing view component works unchanged for both
 * direct-URL access and in-app navigation.
 */
export default function ChantierDetailPage() {
  const params = useParams<{ id: string }>()
  const setSelectedChantierId = useAppStore((s) => s.setSelectedChantierId)

  useEffect(() => {
    if (params?.id) {
      setSelectedChantierId(params.id)
    }
  }, [params?.id, setSelectedChantierId])

  return <ChantierDetailView />
}
