/**
 * offline-db stub — IndexedDB offline queue désactivé (Phase 6 cleanup).
 *
 * Le PWA offline sync utilisait IndexedDB pour stocker les mutations hors-ligne.
 * Avec la migration vers l'API Go, le sync passe désormais par POST /api/v1/sync.
 * Ce stub maintient la compatibilité des types sans fonctionnalité IndexedDB.
 *
 * TODO (Phase 7): réimplémenter le sync offline via /api/v1/sync + Service Worker Cache.
 */

export type SyncItemType =
  | 'pointage'
  | 'stock'
  | 'carburant'
  | 'chantier'
  | 'journalier'
  | 'depense'
  | 'autre'

export interface PendingSyncItem {
  id: string
  type: SyncItemType
  data: any
  createdAt: number
  retryCount: number
}

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

// No-op stubs — toutes les fonctions retournent des valeurs vides
export async function addToSyncQueue(_type: SyncItemType, _data: any): Promise<void> {}
export async function getPendingCount(): Promise<number> { return 0 }
export async function getPendingItems(): Promise<PendingSyncItem[]> { return [] }
export async function removeItem(_id: string): Promise<void> {}
export async function clearPendingQueue(): Promise<void> {}
export async function syncPendingItems(): Promise<SyncResult> {
  return { success: true, synced: 0, failed: 0, errors: [] }
}
export function generateOfflineId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
