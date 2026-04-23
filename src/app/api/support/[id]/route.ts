import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantContext } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/support/[id] — Get ticket with messages (ordered by createdAt)
// ═══════════════════════════════════════════════════════════
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(_request)
    const { id } = await params

    const ticket = await db.ticketSupport.findFirst({
      where: {
        id,
        entrepriseId: ctx.entrepriseId,
      },
      include: {
        client: {
          select: { id: true, raisonSociale: true, telephone: true, email: true },
        },
        assigneA: {
          select: { id: true, name: true, email: true },
        },
        resoluPar: {
          select: { id: true, name: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            auteur: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket non trouvé.' },
        { status: 404 }
      )
    }

    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/support/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du ticket' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/support/[id] — Update ticket fields
// Body: { titre?, description?, statut?, priorite?, categorie?, assigneAId? }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    const existing = await db.ticketSupport.findFirst({
      where: {
        id,
        entrepriseId: ctx.entrepriseId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Ticket non trouvé.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { titre, description, statut, priorite, categorie, assigneAId } = body

    // Validate fields if provided
    const validStatuts = ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME']
    const validPriorites = ['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE']
    const validCategories = ['TECHNIQUE', 'FACTURATION', 'PLANNING', 'AUTRE']

    if (statut && !validStatuts.includes(statut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}` },
        { status: 400 }
      )
    }

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

    // Handle status-specific fields via simple PUT
    const updateData: Record<string, unknown> = {}

    if (titre !== undefined) updateData.titre = titre.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (statut !== undefined) updateData.statut = statut
    if (priorite !== undefined) updateData.priorite = priorite
    if (categorie !== undefined) updateData.categorie = categorie
    if (assigneAId !== undefined) updateData.assigneAId = assigneAId || null

    const ticket = await db.ticketSupport.update({
      where: { id },
      data: updateData,
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
        action: 'UPDATE',
        module: 'support',
        entityType: 'TicketSupport',
        entityId: ticket.id,
        details: `Modification du ticket "${ticket.titre}"`,
      },
    })

    return NextResponse.json(ticket)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/support/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du ticket' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/support/[id] — Delete ticket
// Only allowed if statut is OUVERT or FERME
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(_request)
    const { id } = await params

    const existing = await db.ticketSupport.findFirst({
      where: {
        id,
        entrepriseId: ctx.entrepriseId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Ticket non trouvé.' },
        { status: 404 }
      )
    }

    // Only OUVERT or FERME tickets can be deleted
    if (existing.statut !== 'OUVERT' && existing.statut !== 'FERME') {
      return NextResponse.json(
        { error: 'Seuls les tickets OUVERT ou FERME peuvent être supprimés.' },
        { status: 400 }
      )
    }

    await db.ticketSupport.delete({
      where: { id },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'DELETE',
        module: 'support',
        entityType: 'TicketSupport',
        entityId: id,
        details: `Suppression du ticket "${existing.titre}"`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/support/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du ticket' },
      { status: 500 }
    )
  }
}
