import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantContext } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// Status transition map — validates allowed transitions
// OUVERT → EN_COURS → RESOLU → FERME
// ═══════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  OUVERT: ['EN_COURS', 'FERME'],
  EN_COURS: ['RESOLU', 'OUVERT', 'FERME'],
  RESOLU: ['FERME', 'EN_COURS'],
  FERME: ['OUVERT'],
}

// ═══════════════════════════════════════════════════════════
// PUT /api/support/[id]/statut — Change ticket status
// Body: { statut }
// When setting to RESOLU: auto-set resoluLe = now(), resoluParId = current user
// Validates state machine transitions
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    // Verify ticket exists and belongs to the tenant
    const ticket = await db.ticketSupport.findFirst({
      where: {
        id,
        entrepriseId: ctx.entrepriseId,
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket non trouvé.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { statut } = body

    // Validate statut
    const validStatuts = ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME']
    if (!statut || !validStatuts.includes(statut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate transition
    if (statut === ticket.statut) {
      return NextResponse.json(
        { error: `Le ticket est déjà dans l'état ${statut}.` },
        { status: 400 }
      )
    }

    const allowedTransitions = VALID_TRANSITIONS[ticket.statut]
    if (!allowedTransitions || !allowedTransitions.includes(statut)) {
      return NextResponse.json(
        { error: `Transition non autorisée de ${ticket.statut} vers ${statut}. Transitions possibles : ${allowedTransitions?.join(', ')}` },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      statut,
    }

    // When resolving: set resoluLe and resoluParId
    if (statut === 'RESOLU') {
      updateData.resoluLe = new Date()
      updateData.resoluParId = ctx.userId
    }

    // When re-opening or changing from RESOLU: clear resolution fields
    if (statut === 'OUVERT' || statut === 'EN_COURS') {
      if (ticket.statut === 'RESOLU') {
        updateData.resoluLe = null
        updateData.resoluParId = null
      }
    }

    const updatedTicket = await db.ticketSupport.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, raisonSociale: true },
        },
        assigneA: {
          select: { id: true, name: true },
        },
        resoluPar: {
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
        details: `Changement de statut du ticket "${ticket.titre}" : ${ticket.statut} → ${statut}`,
      },
    })

    return NextResponse.json(updatedTicket)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/support/[id]/statut error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du changement de statut' },
      { status: 500 }
    )
  }
}
