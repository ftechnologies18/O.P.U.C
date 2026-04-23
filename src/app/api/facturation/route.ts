import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantContext, AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// Type prefix mapping for auto-numbering
// ═══════════════════════════════════════════════════════════

const TYPE_PREFIXES: Record<string, string> = {
  FACTURE: 'FAC',
  ACOMPTE: 'ACO',
  SITUATION: 'SIT',
  SOLDE: 'SOL',
}

const VALID_STATUTS = [
  'BROUILLON',
  'ENVOYE',
  'PAYEE',
  'PARTIELLEMENT_PAYEE',
  'ANNULEE',
  'EN_RETARD',
]

const VALID_TYPES = ['FACTURE', 'ACOMPTE', 'SITUATION', 'SOLDE']

// ═══════════════════════════════════════════════════════════
// Helper: Generate the next sequential number for a type/year
// ═══════════════════════════════════════════════════════════

async function generateNumero(typeFacture: string, entrepriseId: string): Promise<string> {
  const prefix = TYPE_PREFIXES[typeFacture] || 'FAC'
  const year = new Date().getFullYear()
  const pattern = `${prefix}-${year}-%`

  // Find the max number for this prefix+year+entreprise
  const lastFacture = await db.facture.findFirst({
    where: {
      entrepriseId,
      numero: { startsWith: `${prefix}-${year}-` },
    },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })

  let nextNum = 1
  if (lastFacture) {
    const parts = lastFacture.numero.split('-')
    const lastNum = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}-${year}-${String(nextNum).padStart(3, '0')}`
}

// ═══════════════════════════════════════════════════════════
// GET /api/facturation — List factures with pagination, search, filters
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || null
    const statut = searchParams.get('statut')?.trim() || null
    const clientId = searchParams.get('clientId')?.trim() || null
    const typeFacture = searchParams.get('typeFacture')?.trim() || null

    // Build where clause — always scoped to entreprise
    const where: Record<string, unknown> = {
      entrepriseId: ctx.entrepriseId,
    }

    if (search) {
      where.OR = [
        { numero: { contains: search } },
        { client: { raisonSociale: { contains: search } } },
        { client: { nomContact: { contains: search } } },
      ]
    }

    if (statut && statut !== 'TOUS' && VALID_STATUTS.includes(statut)) {
      where.statut = statut
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (typeFacture && VALID_TYPES.includes(typeFacture)) {
      where.typeFacture = typeFacture
    }

    const [total, factures, resumeData] = await Promise.all([
      // Total count
      db.facture.count({ where }),

      // Paginated list
      db.facture.findMany({
        where,
        orderBy: { dateEmission: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: {
            select: { id: true, raisonSociale: true },
          },
          contrat: {
            select: { id: true, numero: true, objet: true },
          },
          _count: {
            select: { paiements: true },
          },
        },
      }),

      // Summary counts
      db.facture.aggregate({
        where: { entrepriseId: ctx.entrepriseId },
        _sum: {
          totalTTC: true,
          montantPaye: true,
        },
        _count: true,
      }),

      // Total en retard
      db.facture.aggregate({
        where: {
          entrepriseId: ctx.entrepriseId,
          statut: 'EN_RETARD',
        },
        _sum: { totalTTC: true },
        _count: true,
      }),

      // Total en attente (ENVOYE + PARTIELLEMENT_PAYEE)
      db.facture.aggregate({
        where: {
          entrepriseId: ctx.entrepriseId,
          statut: { in: ['ENVOYE', 'PARTIELLEMENT_PAYEE'] },
        },
        _sum: { totalTTC: true },
        _count: true,
      }),

      // Total payée
      db.facture.aggregate({
        where: {
          entrepriseId: ctx.entrepriseId,
          statut: 'PAYEE',
        },
        _sum: { totalTTC: true },
        _count: true,
      }),
    ])

    const [, totalEnRetard, totalEnAttente, totalPayee] = resumeData as unknown as [
      typeof resumeData,
      { _sum: { totalTTC: number | null }; _count: number },
      { _sum: { totalTTC: number | null }; _count: number },
      { _sum: { totalTTC: number | null }; _count: number },
    ]

    return NextResponse.json({
      factures,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      resume: {
        totalEnAttente: totalEnAttente._sum.totalTTC ?? 0,
        totalPayee: totalPayee._sum.totalTTC ?? 0,
        totalEnRetard: totalEnRetard._sum.totalTTC ?? 0,
      },
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/facturation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/facturation — Create a new facture
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const body = await request.json()
    const {
      clientId,
      contratId,
      typeFacture = 'FACTURE',
      montantHT,
      tauxTVA = 18,
      conditions,
      dateEcheance,
      notes,
    } = body

    // Validate required fields
    if (!clientId) {
      return NextResponse.json(
        { error: 'Le client est requis.' },
        { status: 400 }
      )
    }

    if (montantHT === undefined || montantHT === null || isNaN(Number(montantHT)) || Number(montantHT) < 0) {
      return NextResponse.json(
        { error: 'Le montant HT est requis et doit être positif.' },
        { status: 400 }
      )
    }

    if (!VALID_TYPES.includes(typeFacture)) {
      return NextResponse.json(
        { error: `Type de facture invalide. Valeurs acceptées : ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify client belongs to the same entreprise
    const client = await db.client.findFirst({
      where: { id: clientId, entrepriseId: ctx.entrepriseId },
    })
    if (!client) {
      return NextResponse.json(
        { error: 'Client introuvable ou non autorisé.' },
        { status: 404 }
      )
    }

    // Verify contrat if provided
    if (contratId) {
      const contrat = await db.contrat.findFirst({
        where: { id: contratId, entrepriseId: ctx.entrepriseId },
      })
      if (!contrat) {
        return NextResponse.json(
          { error: 'Contrat introuvable ou non autorisé.' },
          { status: 404 }
        )
      }
    }

    // Auto-calculate TVA and TTC
    const ht = Number(montantHT)
    const tva = Number(tauxTVA)
    const montantTVA = Math.round(ht * tva / 100)
    const totalTTC = ht + montantTVA

    // Generate sequential numero
    const numero = await generateNumero(typeFacture, ctx.entrepriseId)

    // Parse dateEcheance if provided
    const parsedDateEcheance = dateEcheance ? new Date(dateEcheance) : null

    const facture = await db.facture.create({
      data: {
        numero,
        clientId,
        contratId: contratId || null,
        typeFacture,
        statut: 'BROUILLON',
        montantHT: ht,
        tauxTVA: tva,
        montantTVA,
        totalTTC,
        montantPaye: 0,
        dateEcheance: parsedDateEcheance,
        conditions: conditions?.trim() || null,
        notes: notes?.trim() || null,
        entrepriseId: ctx.entrepriseId,
      },
      include: {
        client: {
          select: { id: true, raisonSociale: true },
        },
        contrat: {
          select: { id: true, numero: true, objet: true },
        },
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'CREATE',
        module: 'facturation',
        entityType: 'Facture',
        entityId: facture.id,
        details: `Création de la facture ${facture.numero} (${typeFacture}) - ${totalTTC.toLocaleString('fr-FR')} FCFA pour le client "${client.raisonSociale}"`,
      },
    })

    return NextResponse.json({ facture }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/facturation error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la facture' },
      { status: 500 }
    )
  }
}
