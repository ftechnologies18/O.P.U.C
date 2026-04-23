import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantContext } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/support/[id]/messages — List messages for a ticket
// Returns messages ordered by createdAt with auteur info
// ═══════════════════════════════════════════════════════════
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(_request)
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

    const messages = await db.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        auteur: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/support/[id]/messages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des messages' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/support/[id]/messages — Add a message to a ticket
// Body: { contenu, pieceJointe? }
// Auto-set: auteurId from session
// ═══════════════════════════════════════════════════════════
export async function POST(
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
    const { contenu, pieceJointe } = body

    // Validation
    if (!contenu || typeof contenu !== 'string' || contenu.trim() === '') {
      return NextResponse.json(
        { error: 'Le contenu du message est requis.' },
        { status: 400 }
      )
    }

    const message = await db.ticketMessage.create({
      data: {
        ticketId: id,
        auteurId: ctx.userId,
        contenu: contenu.trim(),
        pieceJointe: pieceJointe || null,
      },
      include: {
        auteur: {
          select: { id: true, name: true, email: true },
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
        entityType: 'TicketMessage',
        entityId: message.id,
        details: `Message ajouté au ticket "${ticket.titre}" (${message.id.substring(0, 8)})`,
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/support/[id]/messages error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du message" },
      { status: 500 }
    )
  }
}
