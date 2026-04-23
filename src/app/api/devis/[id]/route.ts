import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/devis/[id] — Get devis with all lignes and client info
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

    const devis = await db.devis.findFirst({
      where,
      include: {
        lignes: {
          orderBy: { ordre: 'asc' },
        },
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
      },
    })

    if (!devis) {
      return NextResponse.json(
        { error: 'Devis non trouvé.' },
        { status: 404 }
      )
    }

    return NextResponse.json(devis)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/devis/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du devis' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/devis/[id] — Update devis (recalculate totals)
// Body: { clientId?, lignes?, conditions?, remiseGlobale?, tauxTVA?, notes?, dateValidite? }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    // Check existing devis
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

    const body = await request.json()
    const {
      clientId,
      lignes,
      conditions,
      remiseGlobale,
      tauxTVA,
      notes,
      dateValidite,
    } = body

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (clientId !== undefined) {
      if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
        return NextResponse.json(
          { error: 'Le client est requis.' },
          { status: 400 }
        )
      }
      // Verify client exists
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

    if (conditions !== undefined) {
      updateData.conditions = conditions?.trim() || null
    }

    if (remiseGlobale !== undefined) {
      updateData.remiseGlobale = Number(remiseGlobale) || 0
    }

    if (tauxTVA !== undefined) {
      updateData.tauxTVA = Number(tauxTVA) || 0
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null
    }

    if (dateValidite !== undefined) {
      updateData.dateValidite = dateValidite ? new Date(dateValidite) : null
    }

    // If lignes are provided, recalculate everything
    if (lignes !== undefined && Array.isArray(lignes)) {
      if (lignes.length === 0) {
        return NextResponse.json(
          { error: 'Au moins une ligne de devis est requise.' },
          { status: 400 }
        )
      }

      // Validate each line
      for (const ligne of lignes) {
        if (!ligne.designation || ligne.designation.trim() === '') {
          return NextResponse.json(
            { error: 'La désignation est requise pour chaque ligne.' },
            { status: 400 }
          )
        }
        if (ligne.quantite == null || ligne.quantite <= 0) {
          return NextResponse.json(
            { error: 'La quantité doit être supérieure à 0 pour chaque ligne.' },
            { status: 400 }
          )
        }
        if (ligne.prixUnitaire == null || ligne.prixUnitaire < 0) {
          return NextResponse.json(
            { error: 'Le prix unitaire est requis pour chaque ligne.' },
            { status: 400 }
          )
        }
      }

      // Delete existing lignes
      await db.ligneDevis.deleteMany({ where: { devisId: id } })

      // Prepare new lignes
      const lignesData = lignes.map((ligne: Record<string, unknown>, index: number) => {
        const quantite = Number(ligne.quantite) || 0
        const prixUnitaire = Number(ligne.prixUnitaire) || 0
        return {
          designation: String(ligne.designation).trim(),
          description: ligne.description ? String(ligne.description).trim() : null,
          quantite,
          unite: String(ligne.unite || 'u').trim(),
          prixUnitaire,
          totalHT: quantite * prixUnitaire,
          ordre: ligne.ordre ?? index + 1,
        }
      })

      const effectiveTauxTVA = updateData.tauxTVA !== undefined ? updateData.tauxTVA as number : existing.tauxTVA
      const effectiveRemiseGlobale = updateData.remiseGlobale !== undefined ? updateData.remiseGlobale as number : existing.remiseGlobale

      const totalHT = lignesData.reduce((sum, l) => sum + l.totalHT, 0)
      const remiseMontant = totalHT * (effectiveRemiseGlobale / 100)
      const montantApresRemise = totalHT - remiseMontant
      const montantTVA = montantApresRemise * (effectiveTauxTVA / 100)
      const totalTTC = montantApresRemise + montantTVA

      updateData.totalHT = totalHT
      updateData.montantTVA = montantTVA
      updateData.totalTTC = totalTTC
      updateData.lignes = {
        create: lignesData,
      }
    } else if (remiseGlobale !== undefined || tauxTVA !== undefined) {
      // Recalculate totals if remise or TVA changed but lignes didn't
      const existingLignes = await db.ligneDevis.findMany({
        where: { devisId: id },
      })
      const effectiveTauxTVA = updateData.tauxTVA !== undefined ? updateData.tauxTVA as number : existing.tauxTVA
      const effectiveRemiseGlobale = updateData.remiseGlobale !== undefined ? updateData.remiseGlobale as number : existing.remiseGlobale

      const totalHT = existingLignes.reduce((sum, l) => sum + l.totalHT, 0)
      const remiseMontant = totalHT * (effectiveRemiseGlobale / 100)
      const montantApresRemise = totalHT - remiseMontant
      const montantTVA = montantApresRemise * (effectiveTauxTVA / 100)
      const totalTTC = montantApresRemise + montantTVA

      updateData.totalHT = totalHT
      updateData.montantTVA = montantTVA
      updateData.totalTTC = totalTTC
    }

    const devis = await db.devis.update({
      where: { id },
      data: updateData,
      include: {
        lignes: {
          orderBy: { ordre: 'asc' },
        },
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
        details: `Mise à jour du devis "${existing.numero}"`,
      },
    })

    return NextResponse.json(devis)
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/devis/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du devis' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/devis/[id] — Delete devis (only if BROUILLON)
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

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

    // Only allow deletion if status is BROUILLON
    if (existing.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les devis en statut BROUILLON peuvent être supprimés.' },
        { status: 400 }
      )
    }

    // Delete lignes first (cascade should handle this, but explicit is safer)
    await db.ligneDevis.deleteMany({ where: { devisId: id } })
    await db.devis.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: existing.entrepriseId,
        action: 'DELETE',
        module: 'devis',
        entityType: 'Devis',
        entityId: id,
        details: `Suppression du devis "${existing.numero}"`,
      },
    })

    return NextResponse.json({ success: true, message: 'Devis supprimé avec succès.' })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/devis/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du devis' },
      { status: 500 }
    )
  }
}
