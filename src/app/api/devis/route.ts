import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/devis — List devis with pagination, search, and filters
// Query: ?page=1&limit=20&search=term&statut=BROUILLON&clientId=xxx
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const search = searchParams.get('search')?.trim() || ''
    const statut = searchParams.get('statut')?.trim() || ''
    const clientId = searchParams.get('clientId')?.trim() || ''

    // Build where clause — multi-tenant scoped
    const where: Record<string, unknown> = {}

    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      where.entrepriseId = ctx.entrepriseId
    }

    if (statut) {
      where.statut = statut
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (search) {
      where.OR = [
        { numero: { contains: search } },
        { client: { raisonSociale: { contains: search } } },
      ]
    }

    const [devis, total] = await Promise.all([
      db.devis.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              raisonSociale: true,
            },
          },
          _count: {
            select: { lignes: true },
          },
        },
      }),
      db.devis.count({ where }),
    ])

    return NextResponse.json({
      devis,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/devis error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des devis' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/devis — Create devis with line items
// Body: { clientId, lignes: [...], conditions?, remiseGlobale?, tauxTVA?, notes?, dateValidite? }
// Auto-generates numero: DEV-YYYY-MM-NNN
// Auto-calculates: totalHT, remise, TVA 18%, totalTTC
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    const body = await request.json()
    const {
      clientId,
      lignes,
      conditions,
      remiseGlobale,
      tauxTVA,
      notes,
      dateValidite,
    } = body

    // Validate required fields
    if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
      return NextResponse.json(
        { error: 'Le client est requis.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une ligne de devis est requise.' },
        { status: 400 }
      )
    }

    // Validate each line
    for (const ligne of lignes) {
      if (!ligne.designation || ligne.designation.trim() === '') {
        return NextResponse.json(
          { error: 'La désignation est requise pour chaque ligne.' },
          { status: 400 }
        )
      }
      if (ligne.quantite == null || ligne.quantite <= 0) {
        return NextResponse.json(
          { error: 'La quantité doit être supérieure à 0 pour chaque ligne.' },
          { status: 400 }
        )
      }
      if (ligne.prixUnitaire == null || ligne.prixUnitaire < 0) {
        return NextResponse.json(
          { error: 'Le prix unitaire est requis pour chaque ligne.' },
          { status: 400 }
        )
      }
    }

    // Verify client exists
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, raisonSociale: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client non trouvé.' },
        { status: 404 }
      )
    }

    // Generate auto-number: DEV-YYYY-MM-NNN
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `DEV-${year}-${month}`

    const lastDevis = await db.devis.findFirst({
      where: {
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })

    let sequence = 1
    if (lastDevis) {
      const parts = lastDevis.numero.split('-')
      sequence = parseInt(parts[3] || '0', 10) + 1
    }

    const numero = `${prefix}-${String(sequence).padStart(3, '0')}`

    // Calculate totals
    const effectiveTauxTVA = tauxTVA ?? 18
    const effectiveRemiseGlobale = remiseGlobale ?? 0

    // Calculate line totals and sum
    const lignesData = lignes.map((ligne: Record<string, unknown>, index: number) => {
      const quantite = Number(ligne.quantite) || 0
      const prixUnitaire = Number(ligne.prixUnitaire) || 0
      return {
        designation: String(ligne.designation).trim(),
        description: ligne.description ? String(ligne.description).trim() : null,
        quantite,
        unite: String(ligne.unite || 'u').trim(),
        prixUnitaire,
        totalHT: quantite * prixUnitaire,
        ordre: ligne.ordre ?? index + 1,
      }
    })

    const totalHT = lignesData.reduce((sum, l) => sum + l.totalHT, 0)
    const remiseMontant = totalHT * (effectiveRemiseGlobale / 100)
    const montantApresRemise = totalHT - remiseMontant
    const montantTVA = montantApresRemise * (effectiveTauxTVA / 100)
    const totalTTC = montantApresRemise + montantTVA

    // Determine entrepriseId
    let entrepriseId = ctx.entrepriseId
    if (ctx.isSuperAdmin && !entrepriseId) {
      // Super admin must specify via body or use client's entrepriseId
      const clientWithEntreprise = await db.client.findUnique({
        where: { id: clientId },
        select: { entrepriseId: true },
      })
      entrepriseId = clientWithEntreprise?.entrepriseId || null
    }

    // Create devis with nested lignes
    const devis = await db.devis.create({
      data: {
        numero,
        clientId,
        entrepriseId,
        dateValidite: dateValidite ? new Date(dateValidite) : null,
        conditions: conditions?.trim() || null,
        remiseGlobale: effectiveRemiseGlobale,
        totalHT,
        tauxTVA: effectiveTauxTVA,
        montantTVA,
        totalTTC,
        notes: notes?.trim() || null,
        lignes: {
          create: lignesData,
        },
      },
      include: {
        lignes: {
          orderBy: { ordre: 'asc' },
        },
        client: {
          select: {
            id: true,
            raisonSociale: true,
          },
        },
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId,
        action: 'CREATE',
        module: 'devis',
        entityType: 'Devis',
        entityId: devis.id,
        details: `Création du devis "${devis.numero}" pour le client "${client.raisonSociale}" — ${totalTTC.toLocaleString('fr-FR')} FCFA TTC`,
      },
    })

    return NextResponse.json(devis, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/devis error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du devis' },
      { status: 500 }
    )
  }
}
