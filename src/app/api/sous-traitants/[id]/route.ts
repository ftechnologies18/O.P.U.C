import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sousTraitant = await db.sousTraitant.findUnique({
      where: { id },
      include: {
        contrats: {
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!sousTraitant) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(sousTraitant)
  } catch (error) {
    console.error('GET /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du sous-traitant' },
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
    const {
      type,
      raisonSociale,
      nom,
      prenom,
      rccm,
      nif,
      typePieceIdentite,
      numeroPieceIdentite,
      contact,
      email,
      adresse,
      specialite,
      rib,
    } = body

    // Validate based on type
    if (type === 'ENTREPRISE' && (!raisonSociale || raisonSociale.trim() === '')) {
      return NextResponse.json(
        { error: 'La raison sociale est requise pour une entreprise' },
        { status: 400 }
      )
    }

    if (type === 'PARTICULIER' && (!nom || nom.trim() === '')) {
      return NextResponse.json(
        { error: 'Le nom est requis pour un particulier' },
        { status: 400 }
      )
    }

    const existing = await db.sousTraitant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    const sousTraitant = await db.sousTraitant.update({
      where: { id },
      data: {
        type: type || existing.type,
        raisonSociale: raisonSociale !== undefined ? (raisonSociale?.trim() || null) : existing.raisonSociale,
        nom: nom !== undefined ? (nom?.trim() || null) : existing.nom,
        prenom: prenom !== undefined ? (prenom?.trim() || null) : existing.prenom,
        rccm: rccm !== undefined ? (rccm?.trim() || null) : existing.rccm,
        nif: nif !== undefined ? (nif?.trim() || null) : existing.nif,
        typePieceIdentite: typePieceIdentite !== undefined ? (typePieceIdentite?.trim() || null) : existing.typePieceIdentite,
        numeroPieceIdentite: numeroPieceIdentite !== undefined ? (numeroPieceIdentite?.trim() || null) : existing.numeroPieceIdentite,
        contact: contact !== undefined ? (contact?.trim() || null) : existing.contact,
        email: email !== undefined ? (email?.trim() || null) : existing.email,
        adresse: adresse !== undefined ? (adresse?.trim() || null) : existing.adresse,
        specialite: specialite !== undefined ? (specialite?.trim() || null) : existing.specialite,
        rib: rib !== undefined ? (rib?.trim() || null) : existing.rib,
      },
    })

    return NextResponse.json(sousTraitant)
  } catch (error) {
    console.error('PUT /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du sous-traitant' },
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

    const existing = await db.sousTraitant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    // Delete contrats first, then sous-traitant
    await db.contratST.deleteMany({ where: { sousTraitantId: id } })
    await db.sousTraitant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du sous-traitant' },
      { status: 500 }
    )
  }
}
