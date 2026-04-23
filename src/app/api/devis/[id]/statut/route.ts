import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// Valid status transitions for Devis:
//   BROUILLON  → ENVOYE
//   ENVOYE     → ACCEPTE | REFUSE | EXPIRE
//   ACCEPTE    → (terminal — no transitions)
//   REFUSE     → (terminal — no transitions)
//   EXPIRE     → (terminal — no transitions)
// ═══════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['ENVOYE'],
  ENVOYE: ['ACCEPTE', 'REFUSE', 'EXPIRE'],
  ACCEPTE: [],
  REFUSE: [],
  EXPIRE: [],
}

const ALL_STATUTS = ['BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE', 'EXPIRE']

// ═══════════════════════════════════════════════════════════
// PUT /api/devis/[id]/statut — Change devis status
// Body: { statut: "ENVOYE" | "ACCEPTE" | "REFUSE" | "EXPIRE" }
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

    // Find existing devis
    const devisWhere: Record<string, unknown> = { id }
    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      devisWhere.entrepriseId = ctx.entrepriseId
    }

    const existing = await db.devis.findFirst({
      where: devisWhere,
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Devis non trouvé.' },
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
    const devis = await db.devis.update({
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
        module: 'devis',
        entityType: 'Devis',
        entityId: id,
        details: `Changement de statut du devis "${existing.numero}" : ${existing.statut} → ${statut}`,
      },
    })

    return NextResponse.json({
      devis,
      message: `Statut du devis "${existing.numero}" mis à jour : ${existing.statut} → ${statut}.`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/devis/[id]/statut error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du statut du devis' },
      { status: 500 }
    )
  }
}
