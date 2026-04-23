import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantContext, AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/facturation/[id] — Get a single facture with full details
// ═══════════════════════════════════════════════════════════

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(_request)
    const { id } = await params

    const facture = await db.facture.findFirst({
      where: {
        id,
        entrepriseId: ctx.entrepriseId,
      },
      include: {
        client: {
          select: {
            id: true,
            raisonSociale: true,
            nomContact: true,
            telephone: true,
            email: true,
            adresse: true,
            nif: true,
            rccm: true,
          },
        },
        contrat: {
          select: {
            id: true,
            numero: true,
            objet: true,
            typeContrat: true,
            montantHT: true,
            montantTTC: true,
          },
        },
        paiements: {
          orderBy: { datePaiement: 'desc' },
        },
      },
    })

    if (!facture) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ facture })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/facturation/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la facture' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/facturation/[id] — Update a facture
// ═══════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    // Fetch existing facture scoped to tenant
    const existing = await db.facture.findFirst({
      where: { id, entrepriseId: ctx.entrepriseId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    // Cannot update ANNULEE or PAYEE factures
    if (existing.statut === 'ANNULEE') {
      return NextResponse.json(
        { error: 'Impossible de modifier une facture annulée.' },
        { status: 400 }
      )
    }

    if (existing.statut === 'PAYEE') {
      return NextResponse.json(
        { error: 'Impossible de modifier une facture payée.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      clientId,
      contratId,
      typeFacture,
      montantHT,
      tauxTVA,
      conditions,
      dateEcheance,
      notes,
    } = body

    // Validate clientId if provided
    if (clientId && clientId !== existing.clientId) {
      const client = await db.client.findFirst({
        where: { id: clientId, entrepriseId: ctx.entrepriseId },
      })
      if (!client) {
        return NextResponse.json(
          { error: 'Client introuvable ou non autorisé.' },
          { status: 404 }
        )
      }
    }

    // Validate contratId if provided
    if (contratId && contratId !== existing.contratId) {
      const contrat = await db.contrat.findFirst({
        where: { id: contratId, entrepriseId: ctx.entrepriseId },
      })
      if (!contrat) {
        return NextResponse.json(
          { error: 'Contrat introuvable ou non autorisé.' },
          { status: 404 }
        )
      }
    }

    // Auto-calculate TVA and TTC if amounts change
    const ht = montantHT !== undefined ? Number(montantHT) : existing.montantHT
    const tva = tauxTVA !== undefined ? Number(tauxTVA) : existing.tauxTVA
    const montantTVA = Math.round(ht * tva / 100)
    const totalTTC = ht + montantTVA

    // Build update data
    const data: Record<string, unknown> = {
      montantHT: ht,
      tauxTVA: tva,
      montantTVA,
      totalTTC,
      updatedAt: new Date(),
    }

    if (clientId !== undefined) data.clientId = clientId
    if (contratId !== undefined) data.contratId = contratId || null
    if (typeFacture !== undefined) data.typeFacture = typeFacture
    if (conditions !== undefined) data.conditions = conditions?.trim() || null
    if (dateEcheance !== undefined) data.dateEcheance = dateEcheance ? new Date(dateEcheance) : null
    if (notes !== undefined) data.notes = notes?.trim() || null

    const facture = await db.facture.update({
      where: { id },
      data,
      include: {
        client: {
          select: { id: true, raisonSociale: true },
        },
        contrat: {
          select: { id: true, numero: true, objet: true },
        },
        _count: {
          select: { paiements: true },
        },
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
        details: `Modification de la facture ${facture.numero} - Nouveau total: ${totalTTC.toLocaleString('fr-FR')} FCFA`,
      },
    })

    return NextResponse.json({ facture })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/facturation/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification de la facture' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/facturation/[id] — Delete a facture (BROUILLON only)
// ═══════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantContext(request)
    const { id } = await params

    // Fetch existing facture scoped to tenant
    const existing = await db.facture.findFirst({
      where: { id, entrepriseId: ctx.entrepriseId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Facture introuvable.' },
        { status: 404 }
      )
    }

    // Only BROUILLON factures can be deleted
    if (existing.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seules les factures en brouillon peuvent être supprimées.' },
        { status: 400 }
      )
    }

    // Delete facture (cascade will delete associated paiements)
    await db.facture.delete({
      where: { id },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: ctx.entrepriseId,
        action: 'DELETE',
        module: 'facturation',
        entityType: 'Facture',
        entityId: id,
        details: `Suppression de la facture ${existing.numero}`,
      },
    })

    return NextResponse.json({
      message: `Facture ${existing.numero} supprimée avec succès.`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/facturation/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la facture' },
      { status: 500 }
    )
  }
}
