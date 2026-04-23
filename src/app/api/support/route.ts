import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantContext } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/support — List support tickets with filters
// Multi-tenant: filters by entrepriseId from session
// Query params: page, limit, search, statut, priorite, clientId, categorie, assigneAId
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const search = searchParams.get('search')?.trim() || ''
    const statut = searchParams.get('statut')?.trim() || ''
    const priorite = searchParams.get('priorite')?.trim() || ''
    const clientId = searchParams.get('clientId')?.trim() || ''
    const categorie = searchParams.get('categorie')?.trim() || ''
    const assigneAId = searchParams.get('assigneAId')?.trim() || ''

    const validStatuts = ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME']
    const validPriorites = ['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE']
    const validCategories = ['TECHNIQUE', 'FACTURATION', 'PLANNING', 'AUTRE']

    // Build where clause — always tenant-scoped
    const where: Record<string, unknown> = {
      entrepriseId: ctx.entrepriseId,
    }

    if (search) {
      where.OR = [
        { titre: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (statut && validStatuts.includes(statut)) {
      where.statut = statut
    }

    if (priorite && validPriorites.includes(priorite)) {
      where.priorite = priorite
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (categorie && validCategories.includes(categorie)) {
      where.categorie = categorie
    }

    if (assigneAId) {
      where.assigneAId = assigneAId
    }

    const [tickets, total] = await Promise.all([
      db.ticketSupport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, raisonSociale: true },
          },
          assigneA: {
            select: { id: true, name: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      db.ticketSupport.count({ where }),
    ])

    return NextResponse.json({
      tickets,
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
    console.error('GET /api/support error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des tickets' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/support — Create a support ticket
// Body: { titre, description, clientId?, categorie?, priorite?, assigneAId? }
// Auto-set: entrepriseId from session, statut: OUVERT, priorite: MOYENNE
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const body = await request.json()
    const { titre, description, clientId, categorie, priorite, assigneAId } = body

    // Validation
    if (!titre || typeof titre !== 'string' || titre.trim() === '') {
      return NextResponse.json(
        { error: 'Le titre du ticket est requis.' },
        { status: 400 }
      )
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return NextResponse.json(
        { error: 'La description du ticket est requise.' },
        { status: 400 }
      )
    }

    const validPriorites = ['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE']
    const validCategories = ['TECHNIQUE', 'FACTURATION', 'PLANNING', 'AUTRE']

    if (priorite && !validPriorites.includes(priorite)) {
      return NextResponse.json(
        { error: `Priorité invalide. Valeurs acceptées : ${validPriorites.join(', ')}` },
        { status: 400 }
      )
    }

    if (categorie && !validCategories.includes(categorie)) {
      return NextResponse.json(
        { error: `Catégorie invalide. Valeurs acceptées : ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify client exists if provided
    if (clientId) {
      const client = await db.client.findFirst({
        where: { id: clientId, entrepriseId: ctx.entrepriseId },
      })
      if (!client) {
        return NextResponse.json(
          { error: 'Client non trouvé.' },
          { status: 404 }
        )
      }
    }

    // Verify assignee exists if provided
    if (assigneAId) {
      const assignee = await db.user.findFirst({
        where: { id: assigneAId, entrepriseId: ctx.entrepriseId },
      })
      if (!assignee) {
        return NextResponse.json(
          { error: 'Utilisateur assigné non trouvé.' },
          { status: 404 }
        )
      }
    }

    const ticket = await db.ticketSupport.create({
      data: {
        titre: titre.trim(),
        description: description.trim(),
        entrepriseId: ctx.entrepriseId,
        clientId: clientId || null,
        categorie: categorie || null,
        priorite: priorite || 'MOYENNE',
        statut: 'OUVERT',
        assigneAId: assigneAId || null,
      },
      include: {
        client: {
          select: { id: true, raisonSociale: true },
        },
        assigneA: {
          select: { id: true, name: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'CREATE',
        module: 'support',
        entityType: 'TicketSupport',
        entityId: ticket.id,
        details: `Création du ticket "${ticket.titre}" (priorité: ${ticket.priorite}, catégorie: ${ticket.categorie || 'Aucune'})`,
      },
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/support error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création du ticket" },
      { status: 500 }
    )
  }
}
