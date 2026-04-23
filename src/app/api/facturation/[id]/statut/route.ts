import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantContext, AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// Valid status transitions
// ═══════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['ENVOYE'],
  ENVOYE: ['PAYEE', 'ANNULEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE'],
  EN_RETARD: ['PAYEE', 'ANNULEE', 'PARTIELLEMENT_PAYEE'],
  PARTIELLEMENT_PAYEE: ['PAYEE', 'ANNULEE', 'EN_RETARD'],
}

// ═══════════════════════════════════════════════════════════
// PUT /api/facturation/[id]/statut — Change facture status
// Body: { statut: string }
// ═══════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    const body = await request.json()
    const { statut } = body

    if (!statut) {
      return NextResponse.json(
        { error: 'Le statut est requis.' },
        { status: 400 }
      )
    }

    // Fetch existing facture scoped to tenant
    const existing = await db.facture.findFirst({
      where: { id, entrepriseId: ctx.entrepriseId },
      include: {
        client: { select: { raisonSociale: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    // Cannot change status of ANNULEE or PAYEE
    if (existing.statut === 'ANNULEE') {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut d\'une facture annulée.' },
        { status: 400 }
      )
    }

    if (existing.statut === 'PAYEE') {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut d\'une facture payée.' },
        { status: 400 }
      )
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[existing.statut]
    if (!allowedTransitions || !allowedTransitions.includes(statut)) {
      return NextResponse.json(
        {
          error: `Transition de statut invalide. De "${existing.statut}", vous pouvez passer à : ${allowedTransitions?.join(', ') || 'aucune'}.`,
        },
        { status: 400 }
      )
    }

    // Build update data
    const data: Record<string, unknown> = {
      statut,
      updatedAt: new Date(),
    }

    // If marking as PAYEE, set datePaiement and montantPaye = totalTTC
    if (statut === 'PAYEE') {
      data.datePaiement = new Date()
      data.montantPaye = existing.totalTTC
    }

    const facture = await db.facture.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, raisonSociale: true } },
        contrat: { select: { id: true, numero: true, objet: true } },
        _count: { select: { paiements: true } },
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'UPDATE',
        module: 'facturation',
        entityType: 'Facture',
        entityId: facture.id,
        details: `Changement de statut de la facture ${facture.numero} : "${existing.statut}" → "${statut}"`,
      },
    })

    return NextResponse.json({
      facture,
      message: `Statut de la facture ${facture.numero} mis à jour : ${statut}`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/facturation/[id]/statut error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du statut' },
      { status: 500 }
    )
  }
}
