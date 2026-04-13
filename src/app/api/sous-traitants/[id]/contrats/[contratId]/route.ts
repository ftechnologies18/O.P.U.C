import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contratId: string }> }
) {
  try {
    const { contratId } = await params
    const body = await request.json()
    const { statut, montantHT, dateDebut, dateFin, conditions, objetTravaux } = body

    const existing = await db.contratST.findUnique({ where: { id: contratId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Contrat non trouvé' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (statut !== undefined) {
      const validStatuts = ['EN_COURS', 'RECEPTIONNE', 'SOLDE', 'ANNULE']
      if (!validStatuts.includes(statut)) {
        return NextResponse.json(
          { error: 'Statut invalide. Valeurs acceptées: EN_COURS, RECEPTIONNE, SOLDE, ANNULE' },
          { status: 400 }
        )
      }
      updateData.statut = statut
    }

    if (montantHT !== undefined && montantHT !== null) {
      if (montantHT < 0) {
        return NextResponse.json(
          { error: 'Le montant HT doit être positif' },
          { status: 400 }
        )
      }
      updateData.montantHT = parseFloat(montantHT)
    }

    if (objetTravaux !== undefined) {
      updateData.objetTravaux = objetTravaux.trim()
    }

    if (dateDebut !== undefined) {
      updateData.dateDebut = dateDebut ? new Date(dateDebut) : null
    }

    if (dateFin !== undefined) {
      updateData.dateFin = dateFin ? new Date(dateFin) : null
    }

    if (conditions !== undefined) {
      updateData.conditions = conditions?.trim() || null
    }

    const contrat = await db.contratST.update({
      where: { id: contratId },
      data: updateData,
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    return NextResponse.json(contrat)
  } catch (error) {
    console.error('PUT /api/sous-traitants/[id]/contrats/[contratId] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du contrat' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contratId: string }> }
) {
  try {
    const { contratId } = await params

    const existing = await db.contratST.findUnique({ where: { id: contratId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Contrat non trouvé' },
        { status: 404 }
      )
    }

    await db.contratST.delete({ where: { id: contratId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sous-traitants/[id]/contrats/[contratId] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du contrat' },
      { status: 500 }
    )
  }
}
