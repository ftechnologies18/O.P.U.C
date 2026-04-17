import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/sync
 * Receives batched offline data from the client (IndexedDB) and persists it.
 *
 * Request body:
 * {
 *   items: Array<{
 *     id: string,          // client-generated UUID
 *     type: string,        // 'pointage' | 'rapport' | 'photo' | 'sortie_stock' | 'sortie_carburant'
 *     payload: object,     // the actual data matching the corresponding model
 *     createdAt: string,   // ISO date when created offline
 *     syncedAt?: string    // ISO date when synced (set by server)
 *   }>
 * }
 *
 * Returns: { synced: number, errors: Array<{ id, error }> }
 */

interface SyncItem {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

// Allowed sync types and their validation
const ALLOWED_TYPES = [
  'pointage',
  'rapport',
  'photo',
  'sortie_stock',
  'sortie_carburant',
  'entree_carburant',
  'releve_compteur',
  'general',
] as const

function validatePointage(payload: Record<string, unknown>): string | null {
  if (!payload.journalierId) return 'journalierId requis'
  if (!payload.chantierId) return 'chantierId requis'
  if (!payload.dateTravail) return 'dateTravail requis'
  return null
}

function validateRapport(payload: Record<string, unknown>): string | null {
  if (!payload.chantierId) return 'chantierId requis'
  if (!payload.dateRapport) return 'dateRapport requis'
  if (!payload.travauxRealises) return 'travauxRealises requis'
  return null
}

function validateSortieStock(payload: Record<string, unknown>): string | null {
  if (!payload.stockId) return 'stockId requis'
  if (!payload.chantierId) return 'chantierId requis'
  if (!payload.quantite) return 'quantite requise'
  return null
}

function validateSortieCarburant(payload: Record<string, unknown>): string | null {
  if (!payload.stockCarburantId) return 'stockCarburantId requis'
  if (!payload.chantierId) return 'chantierId requis'
  if (!payload.quantite) return 'quantite requise'
  return null
}

async function processPointage(payload: Record<string, unknown>, userId: string) {
  // Check for duplicate (same journalier, same date)
  const existing = await db.pointage.findFirst({
    where: {
      journalierId: payload.journalierId as string,
      chantierId: payload.chantierId as string,
      dateTravail: new Date(payload.dateTravail as string),
    },
  })

  if (existing) {
    // Update existing instead of creating duplicate
    await db.pointage.update({
      where: { id: existing.id },
      data: {
        present: payload.present !== false,
        observation: (payload.observation as string) || existing.observation,
        tauxJournalier: (payload.tauxJournalier as number) || existing.tauxJournalier,
      },
    })
    return { action: 'updated', id: existing.id }
  }

  const pointage = await db.pointage.create({
    data: {
      journalierId: payload.journalierId as string,
      chantierId: payload.chantierId as string,
      chefChantierId: userId,
      dateTravail: new Date(payload.dateTravail as string),
      tauxJournalier: (payload.tauxJournalier as number) || 0,
      present: payload.present !== false,
      observation: (payload.observation as string) || null,
    },
  })
  return { action: 'created', id: pointage.id }
}

async function processRapport(payload: Record<string, unknown>, userId: string) {
  const rapport = await db.rapportJournalier.create({
    data: {
      chantierId: payload.chantierId as string,
      auteurId: userId,
      dateRapport: new Date(payload.dateRapport as string),
      travauxRealises: payload.travauxRealises as string,
      incidents: (payload.incidents as string) || null,
      observations: (payload.observations as string) || null,
      meteo: (payload.meteo as string) || null,
      effectifPresent: payload.effectifPresent ? parseInt(String(payload.effectifPresent)) : null,
    },
  })
  return { action: 'created', id: rapport.id }
}

async function processSortieStock(payload: Record<string, unknown>) {
  const sortie = await db.sortieStock.create({
    data: {
      stockId: payload.stockId as string,
      chantierId: payload.chantierId as string,
      quantite: payload.quantite as number,
      tacheId: (payload.tacheId as string) || null,
      operateur: (payload.operateur as string) || null,
      motif: (payload.motif as string) || null,
      dateSortie: payload.dateSortie ? new Date(payload.dateSortie as string) : new Date(),
    },
  })
  return { action: 'created', id: sortie.id }
}

async function processSortieCarburant(payload: Record<string, unknown>) {
  const sortie = await db.sortieCarburant.create({
    data: {
      stockCarburantId: payload.stockCarburantId as string,
      chantierId: payload.chantierId as string,
      equipementId: (payload.equipementId as string) || null,
      dateSortie: payload.dateSortie ? new Date(payload.dateSortie as string) : new Date(),
      quantite: payload.quantite as number,
      operateur: (payload.operateur as string) || null,
      compteurHeuresAvant: payload.compteurHeuresAvant ? Number(payload.compteurHeuresAvant) : null,
      compteurHeuresApres: payload.compteurHeuresApres ? Number(payload.compteurHeuresApres) : null,
      observation: (payload.observation as string) || null,
    },
  })
  return { action: 'created', id: sortie.id }
}

async function processEntreeCarburant(payload: Record<string, unknown>) {
  const entree = await db.entreeCarburant.create({
    data: {
      stockCarburantId: payload.stockCarburantId as string,
      chantierId: payload.chantierId as string,
      dateEntree: payload.dateEntree ? new Date(payload.dateEntree as string) : new Date(),
      quantite: payload.quantite as number,
      prixUnitaire: payload.prixUnitaire as number,
      prixTotal: payload.prixTotal as number,
      fournisseur: (payload.fournisseur as string) || null,
      numeroBL: (payload.numeroBL as string) || null,
      observation: (payload.observation as string) || null,
    },
  })
  return { action: 'created', id: entree.id }
}

async function processReleveCompteur(payload: Record<string, unknown>) {
  const releve = await db.releveCompteurEngin.create({
    data: {
      equipementId: payload.equipementId as string,
      chantierId: payload.chantierId as string,
      dateReleve: payload.dateReleve ? new Date(payload.dateReleve as string) : new Date(),
      heuresKm: payload.heuresKm as number,
      observation: (payload.observation as string) || null,
    },
  })
  return { action: 'created', id: releve.id }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const items: SyncItem[] = body.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à synchroniser' }, { status: 400 })
    }

    if (items.length > 500) {
      return NextResponse.json({ error: 'Trop de données (max 500 par requête)' }, { status: 400 })
    }

    const synced: Array<{ clientId: string; action: string; serverId: string }> = []
    const errors: Array<{ clientId: string; error: string }> = []

    for (const item of items) {
      try {
        // Validate type
        if (!ALLOWED_TYPES.includes(item.type as any)) {
          errors.push({ clientId: item.id, error: `Type non supporté: ${item.type}` })
          continue
        }

        // Validate and process by type
        let result: { action: string; id: string } | null = null

        switch (item.type) {
          case 'pointage': {
            const validationError = validatePointage(item.payload)
            if (validationError) {
              errors.push({ clientId: item.id, error: validationError })
              continue
            }
            result = await processPointage(item.payload, userId)
            break
          }

          case 'rapport': {
            const validationError = validateRapport(item.payload)
            if (validationError) {
              errors.push({ clientId: item.id, error: validationError })
              continue
            }
            result = await processRapport(item.payload, userId)
            break
          }

          case 'sortie_stock': {
            const validationError = validateSortieStock(item.payload)
            if (validationError) {
              errors.push({ clientId: item.id, error: validationError })
              continue
            }
            result = await processSortieStock(item.payload)
            break
          }

          case 'sortie_carburant': {
            const validationError = validateSortieCarburant(item.payload)
            if (validationError) {
              errors.push({ clientId: item.id, error: validationError })
              continue
            }
            result = await processSortieCarburant(item.payload)
            break
          }

          case 'entree_carburant': {
            if (!item.payload.stockCarburantId || !item.payload.quantite) {
              errors.push({ clientId: item.id, error: 'Données carburant incomplètes' })
              continue
            }
            result = await processEntreeCarburant(item.payload)
            break
          }

          case 'releve_compteur': {
            if (!item.payload.equipementId || !item.payload.heuresKm) {
              errors.push({ clientId: item.id, error: 'Données relevé incomplètes' })
              continue
            }
            result = await processReleveCompteur(item.payload)
            break
          }

          case 'general': {
            // Generic items — just log them as synced
            result = { action: 'logged', id: item.id }
            break
          }
        }

        if (result) {
          synced.push({
            clientId: item.id,
            action: result.action,
            serverId: result.id,
          })
        }
      } catch (error: any) {
        console.error(`[Sync] Erreur pour l'item ${item.id}:`, error)
        errors.push({
          clientId: item.id,
          error: error.message || "Erreur lors du traitement",
        })
      }
    }

    return NextResponse.json({
      synced: synced.length,
      errors: errors.length,
      results: synced,
      errorDetails: errors,
    })
  } catch (error) {
    console.error('[Sync] Erreur générale:', error)
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync
 * Returns the status of offline sync (count of pending items).
 * Also acts as a health check endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Endpoint de synchronisation disponible',
    supportedTypes: ALLOWED_TYPES,
    maxBatchSize: 500,
  })
}
