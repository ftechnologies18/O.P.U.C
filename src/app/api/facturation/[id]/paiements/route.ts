import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantContext, AuthError, ForbiddenError } from '@/lib/tenant'

const VALID_MODES_PAIEMENT = ['ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE']

// ═══════════════════════════════════════════════════════════
// Helper: Recalculate facture payment status based on payments
// ═══════════════════════════════════════════════════════════

async function recalculateFactureStatus(factureId: string): Promise<{
  montantPaye: number
  statut: string
  datePaiement: Date | null
}> {
  // Sum all payments for this facture
  const paymentsAgg = await db.paiementFacture.aggregate({
    where: { factureId },
    _sum: { montant: true },
  })

  const montantPaye = paymentsAgg._sum.montant ?? 0

  // Get the facture to check totalTTC
  const facture = await db.facture.findUnique({
    where: { id: factureId },
    select: { totalTTC: true, statut: true },
  })

  if (!facture) {
    return { montantPaye, statut: 'BROUILLON', datePaiement: null }
  }

  // Determine new status
  let newStatut: string
  let datePaiement: Date | null = null

  // Only auto-update status for non-BROUILLON, non-ANNULEE factures
  if (facture.statut === 'BROUILLON' || facture.statut === 'ANNULEE') {
    // Don't auto-change BROUILLON or ANNULEE status
    return { montantPaye, statut: facture.statut, datePaiement: null }
  }

  if (montantPaye >= facture.totalTTC) {
    newStatut = 'PAYEE'
    datePaiement = new Date()
  } else if (montantPaye > 0) {
    newStatut = 'PARTIELLEMENT_PAYEE'
  } else {
    // No payments — revert to ENVOYE if was PARTIELLEMENT_PAYEE
    newStatut = facture.statut === 'PARTIELLEMENT_PAYEE' ? 'ENVOYE' : facture.statut
  }

  return { montantPaye, statut: newStatut, datePaiement }
}

// ═══════════════════════════════════════════════════════════
// GET /api/facturation/[id]/paiements — List payments for a facture
// ═══════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    // Verify facture exists and belongs to tenant
    const facture = await db.facture.findFirst({
      where: { id, entrepriseId: ctx.entrepriseId },
      select: { id: true, numero: true, totalTTC: true, montantPaye: true },
    })

    if (!facture) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    const paiements = await db.paiementFacture.findMany({
      where: { factureId: id },
      orderBy: { datePaiement: 'desc' },
    })

    return NextResponse.json({
      paiements,
      facture: {
        id: facture.id,
        numero: facture.numero,
        totalTTC: facture.totalTTC,
        montantPaye: facture.montantPaye,
        resteAPayer: facture.totalTTC - facture.montantPaye,
      },
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/facturation/[id]/paiements error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paiements' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/facturation/[id]/paiements — Add a payment to a facture
// Body: { montant, modePaiement, reference?, notes? }
// ═══════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    // Verify facture exists and belongs to tenant
    const facture = await db.facture.findFirst({
      where: { id, entrepriseId: ctx.entrepriseId },
    })

    if (!facture) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    // Cannot add payment to BROUILLON or ANNULEE factures
    if (facture.statut === 'BROUILLON') {
      return NextResponse.json(
        { error: 'Impossible d\'ajouter un paiement à une facture en brouillon. Envoyez-la d\'abord.' },
        { status: 400 }
      )
    }

    if (facture.statut === 'ANNULEE') {
      return NextResponse.json(
        { error: 'Impossible d\'ajouter un paiement à une facture annulée.' },
        { status: 400 }
      )
    }

    if (facture.statut === 'PAYEE') {
      return NextResponse.json(
        { error: 'Cette facture est déjà payée intégralement.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { montant, modePaiement, reference, notes } = body

    // Validate montant
    if (!montant || isNaN(Number(montant)) || Number(montant) <= 0) {
      return NextResponse.json(
        { error: 'Le montant du paiement est requis et doit être positif.' },
        { status: 400 }
      )
    }

    const paymentMontant = Number(montant)

    // Check remaining amount
    const resteAPayer = facture.totalTTC - facture.montantPaye
    if (paymentMontant > resteAPayer) {
      return NextResponse.json(
        {
          error: `Le montant du paiement (${paymentMontant.toLocaleString('fr-FR')} FCFA) dépasse le restant à payer (${resteAPayer.toLocaleString('fr-FR')} FCFA).`,
        },
        { status: 400 }
      )
    }

    // Validate modePaiement
    if (!modePaiement || !VALID_MODES_PAIEMENT.includes(modePaiement)) {
      return NextResponse.json(
        { error: `Mode de paiement invalide. Valeurs acceptées : ${VALID_MODES_PAIEMENT.join(', ')}` },
        { status: 400 }
      )
    }

    // Create the payment
    const paiement = await db.paiementFacture.create({
      data: {
        factureId: id,
        montant: paymentMontant,
        modePaiement,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        datePaiement: new Date(),
      },
    })

    // Recalculate facture status
    const { montantPaye, statut, datePaiement } = await recalculateFactureStatus(id)

    // Update facture
    await db.facture.update({
      where: { id },
      data: {
        montantPaye,
        statut,
        ...(datePaiement ? { datePaiement } : {}),
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'CREATE',
        module: 'facturation',
        entityType: 'PaiementFacture',
        entityId: paiement.id,
        details: `Paiement de ${paymentMontant.toLocaleString('fr-FR')} FCFA (${modePaiement}) sur la facture ${facture.numero}. Statut: ${statut}`,
      },
    })

    return NextResponse.json({
      paiement,
      factureMiseAJour: {
        montantPaye,
        statut,
        resteAPayer: facture.totalTTC - montantPaye,
        datePaiement,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/facturation/[id]/paiements error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du paiement' },
      { status: 500 }
    )
  }
}
