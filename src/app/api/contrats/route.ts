import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/contrats — List contrats with pagination, search, and filters
// Query: ?page=1&limit=20&search=term&statut=EN_PREPARATION&clientId=xxx&typeContrat=TRAVAUX
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
    const typeContrat = searchParams.get('typeContrat')?.trim() || ''

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

    if (typeContrat) {
      where.typeContrat = typeContrat
    }

    if (search) {
      where.OR = [
        { numero: { contains: search } },
        { objet: { contains: search } },
        { client: { raisonSociale: { contains: search } } },
      ]
    }

    const [contrats, total] = await Promise.all([
      db.contrat.findMany({
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
            select: { factures: true },
          },
        },
      }),
      db.contrat.count({ where }),
    ])

    return NextResponse.json({
      contrats,
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
    console.error('GET /api/contrats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des contrats' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/contrats — Create contract
// Body: { clientId, objet, typeContrat?, montantHT?, tauxTVA?, conditions?, dateDebut?, dateFin?, penaltyRetard? }
// Auto-generates numero: CTR-YYYY-NNN
// Auto-calculates montantTTC
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    const body = await request.json()
    const {
      clientId,
      objet,
      typeContrat,
      montantHT,
      tauxTVA,
      conditions,
      dateDebut,
      dateFin,
      penaltyRetard,
    } = body

    // Validate required fields
    if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
      return NextResponse.json(
        { error: 'Le client est requis.' },
        { status: 400 }
      )
    }

    if (!objet || typeof objet !== 'string' || objet.trim() === '') {
      return NextResponse.json(
        { error: "L'objet du contrat est requis." },
        { status: 400 }
      )
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

    // Validate typeContrat if provided
    const validTypes = ['TRAVAUX', 'FOURNITURE', 'SERVICE', 'MIXTE']
    if (typeContrat && !validTypes.includes(typeContrat)) {
      return NextResponse.json(
        { error: `Type de contrat invalide. Valeurs acceptées : ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate auto-number: CTR-YYYY-NNN
    const now = new Date()
    const year = now.getFullYear()
    const prefix = `CTR-${year}`

    const lastContrat = await db.contrat.findFirst({
      where: {
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })

    let sequence = 1
    if (lastContrat) {
      const parts = lastContrat.numero.split('-')
      sequence = parseInt(parts[2] || '0', 10) + 1
    }

    const numero = `${prefix}-${String(sequence).padStart(3, '0')}`

    // Calculate totals
    const effectiveTauxTVA = tauxTVA ?? 18
    const effectiveMontantHT = montantHT ?? 0
    const montantTVA = effectiveMontantHT * (effectiveTauxTVA / 100)
    const totalTTC = effectiveMontantHT + montantTVA

    // Determine entrepriseId
    let entrepriseId = ctx.entrepriseId
    if (ctx.isSuperAdmin && !entrepriseId) {
      const clientWithEntreprise = await db.client.findUnique({
        where: { id: clientId },
        select: { entrepriseId: true },
      })
      entrepriseId = clientWithEntreprise?.entrepriseId || null
    }

    // Create contract
    const contrat = await db.contrat.create({
      data: {
        numero,
        clientId,
        objet: objet.trim(),
        typeContrat: typeContrat || 'TRAVAUX',
        montantHT: effectiveMontantHT,
        tauxTVA: effectiveTauxTVA,
        montantTTC: totalTTC,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        conditions: conditions?.trim() || null,
        penaltyRetard: penaltyRetard ?? 0,
        entrepriseId,
      },
      include: {
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
        module: 'contrats',
        entityType: 'Contrat',
        entityId: contrat.id,
        details: `Création du contrat "${contrat.numero}" pour le client "${client.raisonSociale}" — ${totalTTC.toLocaleString('fr-FR')} FCFA TTC`,
      },
    })

    return NextResponse.json(contrat, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/contrats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du contrat' },
      { status: 500 }
    )
  }
}
