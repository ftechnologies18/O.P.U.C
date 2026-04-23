import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/clients — List clients with pagination, search & filters
// Multi-tenant: filtered by entrepriseId (except SUPER_ADMIN)
// Query params: page, limit, search, statut, type
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const search = searchParams.get('search')?.trim() || null
    const statut = searchParams.get('statut')?.trim() || null
    const type = searchParams.get('type')?.trim() || null

    // Build the where clause — tenant-scoped for non-super-admin
    const where: Record<string, unknown> = {}

    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      where.entrepriseId = ctx.entrepriseId
    }

    if (search) {
      where.OR = [
        { raisonSociale: { contains: search } },
        { nomContact: { contains: search } },
        { email: { contains: search } },
        { telephone: { contains: search } },
      ]
    }

    if (statut && statut !== 'TOUS') {
      where.statut = statut
    }

    if (type && type !== 'TOUS') {
      where.type = type
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              chantiers: true,
              devis: true,
              contrats: true,
              factures: true,
              tickets: true,
            },
          },
        },
      }),
      db.client.count({ where }),
    ])

    return NextResponse.json({
      clients,
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
    console.error('GET /api/clients error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des clients' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/clients — Create a new client
// Body: { raisonSociale, nomContact?, telephone?, email?, adresse?,
//         rccm?, nif?, type?, statut?, notes? }
// Multi-tenant: auto-set entrepriseId from session
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    const body = await request.json()
    const {
      raisonSociale,
      nomContact,
      telephone,
      email,
      adresse,
      rccm,
      nif,
      type,
      statut,
      notes,
    } = body

    // Validate required field
    if (!raisonSociale || typeof raisonSociale !== 'string' || raisonSociale.trim() === '') {
      return NextResponse.json(
        { error: 'La raison sociale est requise.' },
        { status: 400 }
      )
    }

    // Validate type if provided
    const validTypes = ['ENTREPRISE', 'PARTICULIER', 'INSTITUTION']
    const clientType = type?.trim() || 'ENTREPRISE'
    if (!validTypes.includes(clientType)) {
      return NextResponse.json(
        { error: `Type invalide. Valeurs acceptées : ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate statut if provided
    const validStatuts = ['ACTIF', 'INACTIF', 'PROSPECT']
    const clientStatut = statut?.trim() || 'ACTIF'
    if (!validStatuts.includes(clientStatut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}` },
        { status: 400 }
      )
    }

    // Determine entrepriseId — non-super-admin must have one
    let entrepriseId: string | null = ctx.entrepriseId ?? null
    if (!ctx.isSuperAdmin && !entrepriseId) {
      return NextResponse.json(
        { error: 'Aucune entreprise assignée. Impossible de créer un client.' },
        { status: 400 }
      )
    }

    // Create the client
    const client = await db.client.create({
      data: {
        raisonSociale: raisonSociale.trim(),
        nomContact: nomContact?.trim() || null,
        telephone: telephone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        adresse: adresse?.trim() || null,
        rccm: rccm?.trim() || null,
        nif: nif?.trim() || null,
        type: clientType,
        statut: clientStatut,
        notes: notes?.trim() || null,
        entrepriseId,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId,
        action: 'CREATE',
        module: 'clients',
        entityType: 'Client',
        entityId: client.id,
        details: `Création du client "${client.raisonSociale}" (${client.type})`,
      },
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/clients error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du client' },
      { status: 500 }
    )
  }
}
