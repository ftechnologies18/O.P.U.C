'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addToSyncQueue,
  getPendingCount,
  getPendingItems,
  removeItem,
  clearPendingQueue,
  syncPendingItems,
  generateOfflineId,
  type PendingSyncItem,
  type SyncItemType,
  type SyncResult,
} from '@/lib/offline-db'

// ─── Types ─────────────────────────────────────────────────────────────

export interface UseOfflineSyncReturn {
  /** Whether the browser is currently online */
  isOnline: boolean
  /** Number of items pending sync */
  pendingCount: number
  /** Whether sync is currently in progress */
  isSyncing: boolean
  /** Last sync result */
  lastSyncResult: SyncResult | null
  /** Trigger a manual sync */
  syncNow: () => Promise<SyncResult>
  /** Add an item to the offline queue (auto-syncs if online) */
  addToQueue: (type: SyncItemType, payload: Record<string, unknown>) => Promise<string>
  /** Get all pending items (for display) */
  getPending: () => Promise<PendingSyncItem[]>
  /** Remove a specific pending item */
  removePending: (id: string) => Promise<void>
  /** Clear all pending items */
  clearAll: () => Promise<void>
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const syncInProgressRef = useRef(false)

  // Keep syncNow in a ref so effects can call the latest version without re-subscribing
  const syncNowRef = useRef<() => Promise<SyncResult>>(() => Promise.resolve({ synced: 0, errors: [] }))

  // The actual sync function
  const doSync = useCallback(async (): Promise<SyncResult> => {
    if (syncInProgressRef.current) return { synced: 0, errors: [] }

    syncInProgressRef.current = true
    setIsSyncing(true)

    try {
      const result = await syncPendingItems()
      setLastSyncResult(result)

      // Refresh pending count
      const count = await getPendingCount()
      setPendingCount(count)

      return result
    } catch {
      return { synced: 0, errors: [{ clientId: 'system', error: 'Erreur de synchronisation' }] }
    } finally {
      syncInProgressRef.current = false
      setIsSyncing(false)
    }
  }, [])

  // Keep ref in sync
  useEffect(() => {
    syncNowRef.current = doSync
  }, [doSync])

  // Track online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Refresh pending count periodically
  useEffect(() => {
    const refreshCount = async () => {
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {
        // IndexedDB may not be available
      }
    }

    refreshCount()
    const interval = setInterval(refreshCount, 5000)

    return () => clearInterval(interval)
  }, [])

  // Auto-sync when coming back online — track previous state via ref
  const prevOnlineRef = useRef(isOnline)
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current && isOnline
    prevOnlineRef.current = isOnline

    if (wasOffline) {
      // Check if there are pending items and sync
      getPendingCount().then((count) => {
        if (count > 0 && !syncInProgressRef.current) {
          syncNowRef.current()
        }
      })
    }
  }, [isOnline])

  // Listen for SW sync messages
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_STARTED') {
        setIsSyncing(true)
      } else if (event.data?.type === 'SYNC_COMPLETE') {
        syncNowRef.current()
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  // Public syncNow wrapper
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    return syncNowRef.current()
  }, [])

  const addToQueue = useCallback(async (type: SyncItemType, payload: Record<string, unknown>): Promise<string> => {
    const id = generateOfflineId()
    await addToSyncQueue({
      id,
      type,
      payload,
      createdAt: new Date().toISOString(),
    })

    // Update pending count
    const count = await getPendingCount()
    setPendingCount(count)

    // If online, auto-sync immediately
    if (navigator.onLine) {
      syncNowRef.current()
    }

    return id
  }, [])

  const getPending = useCallback(async (): Promise<PendingSyncItem[]> => {
    return getPendingItems()
  }, [])

  const removePending = useCallback(async (id: string): Promise<void> => {
    await removeItem(id)
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const clearAll = useCallback(async (): Promise<void> => {
    await clearPendingQueue()
    setPendingCount(0)
    setLastSyncResult(null)
  }, [])

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncNow,
    addToQueue,
    getPending,
    removePending,
    clearAll,
  }
}
