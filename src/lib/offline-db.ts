// ═══════════════════════════════════════════════════════════════════════
//  O.P.U.C. — IndexedDB Offline Storage Utility
//  Utilisé pour stocker les données localement quand le réseau est indisponible
// ═══════════════════════════════════════════════════════════════════════

const DB_NAME = 'opuc-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-sync'

export interface PendingSyncItem {
  id: string                // client-generated UUID
  type: SyncItemType        // 'pointage' | 'rapport' | 'photo' | 'sortie_stock' | ...
  payload: Record<string, unknown>
  createdAt: string         // ISO date
  retryCount: number
  lastError: string | null
}

export type SyncItemType =
  | 'pointage'
  | 'rapport'
  | 'photo'
  | 'sortie_stock'
  | 'sortie_carburant'
  | 'entree_carburant'
  | 'releve_compteur'
  | 'general'

export interface SyncResult {
  synced: number
  errors: Array<{ clientId: string; error: string }>
}

// ─── DB Open ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── CRUD Operations ──────────────────────────────────────────────────

/** Add a new item to the pending sync queue */
export async function addToSyncQueue(item: Omit<PendingSyncItem, 'retryCount' | 'lastError'>): Promise<string> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const fullItem: PendingSyncItem = {
    ...item,
    retryCount: 0,
    lastError: null,
  }

  return new Promise((resolve, reject) => {
    const request = store.put(fullItem)
    request.onsuccess = () => resolve(item.id)
    request.onerror = () => reject(request.error)
  })
}

/** Get all pending items from the queue */
export async function getPendingItems(): Promise<PendingSyncItem[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/** Get count of pending items */
export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Remove successfully synced items from the queue */
export async function removeSyncedItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  for (const id of ids) {
    store.delete(id)
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Update an item's retry count and last error */
export async function updateItemError(id: string, error: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result as PendingSyncItem | undefined
      if (!item) {
        resolve()
        return
      }
      item.retryCount = (item.retryCount || 0) + 1
      item.lastError = error
      const putReq = store.put(item)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/** Remove a specific item */
export async function removeItem(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Clear all pending items */
export async function clearPendingQueue(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ─── Sync Engine ──────────────────────────────────────────────────────

/** Send all pending items to the server and remove synced ones */
export async function syncPendingItems(): Promise<SyncResult> {
  const items = await getPendingItems()

  if (items.length === 0) {
    return { synced: 0, errors: [] }
  }

  // Filter out items with too many retries (max 5)
  const toSync = items.filter((item) => (item.retryCount || 0) < 5)
  const failedTooMany = items.filter((item) => (item.retryCount || 0) >= 5)

  const result: SyncResult = {
    synced: 0,
    errors: [],
  }

  // Report items that exceeded retry limit
  for (const item of failedTooMany) {
    result.errors.push({
      clientId: item.id,
      error: `Trop de tentatives (${item.retryCount}), élément ignoré`,
    })
  }

  if (toSync.length === 0) {
    return result
  }

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: toSync.map((item) => ({
          id: item.id,
          type: item.type,
          payload: item.payload,
          createdAt: item.createdAt,
        })),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `Erreur serveur ${response.status}`)
    }

    const data = await response.json()

    // Remove successfully synced items
    const syncedIds = (data.results || [])
      .map((r: { clientId: string }) => r.clientId)
    await removeSyncedItems(syncedIds)

    result.synced = data.synced || 0
    result.errors = (data.errorDetails || []).map(
      (e: { clientId: string; error: string }) => ({
        clientId: e.clientId,
        error: e.error,
      })
    )

    // Update error info for failed items
    for (const error of result.errors) {
      await updateItemError(error.clientId, error.error)
    }
  } catch (error: any) {
    // Network error — update all items with error
    for (const item of toSync) {
      await updateItemError(item.id, error.message || 'Erreur réseau')
    }
    result.errors.push({
      clientId: 'batch',
      error: error.message || 'Erreur de connexion au serveur',
    })
  }

  return result
}

/** Generate a UUID for offline items */
export function generateOfflineId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
