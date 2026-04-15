import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const engin = await db.equipement.findUnique({
      where: { id },
      include: {
        locations: {
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
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!engin) {
      return NextResponse.json(
        { error: 'Engin non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(engin)
  } catch (error) {
    console.error('GET /api/engins/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'engin" },
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
      designation,
      typeEquipement,
      marque,
      modele,
      immatriculation,
      etat,
      typeLocation,
    } = body

    if (!designation || designation.trim() === '') {
      return NextResponse.json(
        { error: 'La désignation est requise' },
        { status: 400 }
      )
    }

    const existing = await db.equipement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Engin non trouvé' },
        { status: 404 }
      )
    }

    const engin = await db.equipement.update({
      where: { id },
      data: {
        designation: designation.trim(),
        typeEquipement: typeEquipement !== undefined ? (typeEquipement?.trim() || null) : existing.typeEquipement,
        marque: marque !== undefined ? (marque?.trim() || null) : existing.marque,
        modele: modele !== undefined ? (modele?.trim() || null) : existing.modele,
        immatriculation: immatriculation !== undefined ? (immatriculation?.trim() || null) : existing.immatriculation,
        etat: etat || existing.etat,
        typeLocation: typeLocation || existing.typeLocation,
      },
    })

    return NextResponse.json(engin)
  } catch (error) {
    console.error('PUT /api/engins/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'engin" },
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

    const existing = await db.equipement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Engin non trouvé' },
        { status: 404 }
      )
    }

    // Delete locations first, then engin
    await db.locationEngin.deleteMany({ where: { equipementId: id } })
    await db.equipement.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/engins/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'engin" },
      { status: 500 }
    )
  }
}
