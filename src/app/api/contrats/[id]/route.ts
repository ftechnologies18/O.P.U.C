import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/contrats/[id] — Get contract with client info and factures count
// ═══════════════════════════════════════════════════════════
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(_request)
    const { id } = await params

    const where: Record<string, unknown> = { id }

    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      where.entrepriseId = ctx.entrepriseId
    }

    const contrat = await db.contrat.findFirst({
      where,
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
        entreprise: {
          select: {
            id: true,
            nom: true,
            adresse: true,
            telephone: true,
            email: true,
          },
        },
        factures: {
          select: {
            id: true,
            numero: true,
            typeFacture: true,
            statut: true,
            totalTTC: true,
            dateEmission: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!contrat) {
      return NextResponse.json(
        { error: 'Contrat non trouvé.' },
        { status: 404 }
      )
    }

    return NextResponse.json(contrat)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/contrats/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du contrat' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/contrats/[id] — Update contract (recalculate montantTTC)
// Body: { clientId?, objet?, typeContrat?, montantHT?, tauxTVA?, conditions?, dateDebut?, dateFin?, penaltyRetard? }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    // Check existing contract
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

    const body = await request.json()
    const {
      clientId,
      objet,
      typeContrat,
      montantHT,
      tauxTVA,
      conditions,
      dateDebut,
      dateFin,
      penaltyRetard,
    } = body

    // Build update data
    const updateData: Record<string, unknown> = {}
    let needRecalc = false

    if (clientId !== undefined) {
      if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
        return NextResponse.json(
          { error: 'Le client est requis.' },
          { status: 400 }
        )
      }
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      })
      if (!client) {
        return NextResponse.json(
          { error: 'Client non trouvé.' },
          { status: 404 }
        )
      }
      updateData.clientId = clientId
    }

    if (objet !== undefined) {
      if (!objet || typeof objet !== 'string' || objet.trim() === '') {
        return NextResponse.json(
          { error: "L'objet du contrat est requis." },
          { status: 400 }
        )
      }
      updateData.objet = objet.trim()
    }

    if (typeContrat !== undefined) {
      const validTypes = ['TRAVAUX', 'FOURNITURE', 'SERVICE', 'MIXTE']
      if (!validTypes.includes(typeContrat)) {
        return NextResponse.json(
          { error: `Type de contrat invalide. Valeurs acceptées : ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.typeContrat = typeContrat
    }

    if (montantHT !== undefined) {
      updateData.montantHT = Number(montantHT) || 0
      needRecalc = true
    }

    if (tauxTVA !== undefined) {
      updateData.tauxTVA = Number(tauxTVA) || 0
      needRecalc = true
    }

    if (conditions !== undefined) {
      updateData.conditions = conditions?.trim() || null
    }

    if (dateDebut !== undefined) {
      updateData.dateDebut = dateDebut ? new Date(dateDebut) : null
    }

    if (dateFin !== undefined) {
      updateData.dateFin = dateFin ? new Date(dateFin) : null
    }

    if (penaltyRetard !== undefined) {
      updateData.penaltyRetard = Number(penaltyRetard) || 0
    }

    // Recalculate montantTTC if montantHT or tauxTVA changed
    if (needRecalc) {
      const effectiveHT = updateData.montantHT !== undefined ? updateData.montantHT as number : existing.montantHT
      const effectiveTVA = updateData.tauxTVA !== undefined ? updateData.tauxTVA as number : existing.tauxTVA
      updateData.montantTVA = effectiveHT * (effectiveTVA / 100)
      updateData.montantTTC = effectiveHT + (effectiveHT * (effectiveTVA / 100))
    }

    const contrat = await db.contrat.update({
      where: { id },
      data: updateData,
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
        details: `Mise à jour du contrat "${existing.numero}"`,
      },
    })

    return NextResponse.json(contrat)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/contrats/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du contrat' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/contrats/[id] — Delete contract (only if EN_PREPARATION)
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

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

    // Only allow deletion if status is EN_PREPARATION
    if (existing.statut !== 'EN_PREPARATION') {
      return NextResponse.json(
        { error: 'Seuls les contrats en statut EN_PREPARATION peuvent être supprimés.' },
        { status: 400 }
      )
    }

    // Check for linked factures
    const facturesCount = await db.facture.count({
      where: { contratId: id },
    })

    if (facturesCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer ce contrat car il a ${facturesCount} facture(s) liée(s).` },
        { status: 400 }
      )
    }

    await db.contrat.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: existing.entrepriseId,
        action: 'DELETE',
        module: 'contrats',
        entityType: 'Contrat',
        entityId: id,
        details: `Suppression du contrat "${existing.numero}"`,
      },
    })

    return NextResponse.json({ success: true, message: 'Contrat supprimé avec succès.' })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/contrats/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du contrat' },
      { status: 500 }
    )
  }
}
