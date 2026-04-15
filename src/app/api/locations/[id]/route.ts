import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const location = await db.locationEngin.findUnique({
      where: { id },
      include: {
        equipement: {
          select: {
            id: true,
            designation: true,
            typeEquipement: true,
          },
        },
        fournisseur: {
          select: {
            id: true,
            raisonSociale: true,
            nom: true,
            prenom: true,
            contact: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Location non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error('GET /api/locations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la location' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.locationEngin.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Location non trouvée' },
        { status: 404 }
      )
    }

    // If only statut is provided (statut change from card)
    if (body.statut && Object.keys(body).length === 1) {
      const location = await db.locationEngin.update({
        where: { id },
        data: { statut: body.statut },
        include: {
          equipement: {
            select: { id: true, designation: true, typeEquipement: true },
          },
          fournisseur: {
            select: {
              id: true,
              raisonSociale: true,
              nom: true,
              prenom: true,
              contact: true,
            },
          },
          chantier: {
            select: { id: true, nom: true, statut: true },
          },
        },
      })
      return NextResponse.json(location)
    }

    const {
      equipementId,
      fournisseurId,
      fournisseurNom,
      fournisseurTel,
      numeroContrat,
      chantierId,
      coutJournalier,
      coutTransport,
      coutOperateur,
      caution,
      dateDebut,
      dateFin,
      statut,
      conditions,
    } = body

    if (!equipementId) {
      return NextResponse.json(
        { error: "L'équipement est requis" },
        { status: 400 }
      )
    }

    const location = await db.locationEngin.update({
      where: { id },
      data: {
        equipementId,
        fournisseurId: fournisseurId || null,
        fournisseurNom: fournisseurNom !== undefined ? (fournisseurNom?.trim() || null) : existing.fournisseurNom,
        fournisseurTel: fournisseurTel !== undefined ? (fournisseurTel?.trim() || null) : existing.fournisseurTel,
        numeroContrat: numeroContrat !== undefined ? (numeroContrat?.trim() || null) : existing.numeroContrat,
        chantierId: chantierId || null,
        coutJournalier: coutJournalier !== undefined ? (parseFloat(coutJournalier) || 0) : existing.coutJournalier,
        coutTransport: coutTransport !== undefined ? (parseFloat(coutTransport) || 0) : existing.coutTransport,
        coutOperateur: coutOperateur !== undefined ? (parseFloat(coutOperateur) || 0) : existing.coutOperateur,
        caution: caution !== undefined ? (parseFloat(caution) || 0) : existing.caution,
        dateDebut: dateDebut ? new Date(dateDebut) : existing.dateDebut,
        dateFin: dateFin ? new Date(dateFin) : null,
        statut: statut || existing.statut,
        conditions: conditions !== undefined ? (conditions?.trim() || null) : existing.conditions,
      },
      include: {
        equipement: {
          select: { id: true, designation: true, typeEquipement: true },
        },
        fournisseur: {
          select: {
            id: true,
            raisonSociale: true,
            nom: true,
            prenom: true,
            contact: true,
          },
        },
        chantier: {
          select: { id: true, nom: true, statut: true },
        },
      },
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('PUT /api/locations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la location' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.locationEngin.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Location non trouvée' },
        { status: 404 }
      )
    }

    await db.locationEngin.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/locations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la location' },
      { status: 500 }
    )
  }
}
