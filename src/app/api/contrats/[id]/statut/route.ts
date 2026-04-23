import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// Valid status transitions for Contrats:
//   EN_PREPARATION → ACTIF
//   ACTIF          → EXPIRE | RESILIE | TERMINE
//   EXPIRE         → (terminal — no transitions)
//   RESILIE        → (terminal — no transitions)
//   TERMINE        → (terminal — no transitions)
// ═══════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  EN_PREPARATION: ['ACTIF'],
  ACTIF: ['EXPIRE', 'RESILIE', 'TERMINE'],
  EXPIRE: [],
  RESILIE: [],
  TERMINE: [],
}

const ALL_STATUTS = ['EN_PREPARATION', 'ACTIF', 'EXPIRE', 'RESILIE', 'TERMINE']

// ═══════════════════════════════════════════════════════════
// PUT /api/contrats/[id]/statut — Change contract status
// Body: { statut: "ACTIF" | "EXPIRE" | "RESILIE" | "TERMINE" }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const body = await request.json()
    const { statut } = body

    // Validate statut
    if (!statut || !ALL_STATUTS.includes(statut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${ALL_STATUTS.join(', ')}` },
        { status: 400 }
      )
    }

    // Find existing contract
    const contratWhere: Record<string, unknown> = { id }
    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      contratWhere.entrepriseId = ctx.entrepriseId
    }

    const existing = await db.contrat.findFirst({
      where: contratWhere,
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Contrat non trouvé.' },
        { status: 404 }
      )
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[existing.statut] || []
    if (!allowedTransitions.includes(statut)) {
      return NextResponse.json(
        {
          error: `Transition invalide. Le statut "${existing.statut}" ne peut pas passer à "${statut}". Transitions autorisées : ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'aucune (statut terminal)'}.`,
        },
        { status: 400 }
      )
    }

    // Update status
    const contrat = await db.contrat.update({
      where: { id },
      data: { statut },
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
        entrepriseId: existing.entrepriseId,
        action: 'UPDATE',
        module: 'contrats',
        entityType: 'Contrat',
        entityId: id,
        details: `Changement de statut du contrat "${existing.numero}" : ${existing.statut} → ${statut}`,
      },
    })

    return NextResponse.json({
      contrat,
      message: `Statut du contrat "${existing.numero}" mis à jour : ${existing.statut} → ${statut}.`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/contrats/[id]/statut error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du statut du contrat' },
      { status: 500 }
    )
  }
}
