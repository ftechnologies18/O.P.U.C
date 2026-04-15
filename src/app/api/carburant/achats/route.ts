import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const equipementId = searchParams.get('equipementId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')

    const where: Prisma.BonAchatCarburantWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (equipementId) where.equipementId = equipementId

    if (dateDebut || dateFin) {
      where.dateAchat = {}
      if (dateDebut) {
        where.dateAchat.gte = new Date(dateDebut)
      }
      if (dateFin) {
        const endDate = new Date(dateFin)
        endDate.setHours(23, 59, 59, 999)
        where.dateAchat.lte = endDate
      }
    }

    const achats = await db.bonAchatCarburant.findMany({
      where,
      orderBy: { dateAchat: 'desc' },
      include: {
        chantier: {
          select: { id: true, nom: true },
        },
        equipement: {
          select: {
            id: true,
            designation: true,
            immatriculation: true,
            typeEquipement: true,
          },
        },
      },
    })

    return NextResponse.json({ achats })
  } catch (error) {
    console.error('GET /api/carburant/achats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des bons d\'achat carburant' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      chantierId,
      dateAchat,
      typeCarburant,
      quantite,
      prixUnitaire,
      prixTotal,
      stationService,
      numeroRecu,
      equipementId,
      operateur,
      compteurHeuresAvant,
      compteurHeuresApres,
      observation,
    } = body

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (!quantite || quantite <= 0) {
      return NextResponse.json(
        { error: 'La quantité doit être positive' },
        { status: 400 }
      )
    }

    if (prixUnitaire === undefined || prixUnitaire < 0) {
      return NextResponse.json(
        { error: 'Le prix unitaire est requis' },
        { status: 400 }
      )
    }

    if (!typeCarburant || !['GASOIL', 'ESSENCE'].includes(typeCarburant)) {
      return NextResponse.json(
        { error: 'Le type de carburant doit être GASOIL ou ESSENCE' },
        { status: 400 }
      )
    }

    const achat = await db.bonAchatCarburant.create({
      data: {
        chantierId,
        dateAchat: dateAchat ? new Date(dateAchat) : new Date(),
        typeCarburant,
        quantite: parseFloat(quantite),
        prixUnitaire: parseFloat(prixUnitaire),
        prixTotal: parseFloat(prixTotal ?? (quantite * prixUnitaire)),
        stationService: stationService?.trim() || null,
        numeroRecu: numeroRecu?.trim() || null,
        equipementId: equipementId || null,
        operateur: operateur?.trim() || null,
        compteurHeuresAvant: compteurHeuresAvant !== undefined
          ? parseFloat(compteurHeuresAvant)
          : null,
        compteurHeuresApres: compteurHeuresApres !== undefined
          ? parseFloat(compteurHeuresApres)
          : null,
        observation: observation?.trim() || null,
      },
      include: {
        chantier: {
          select: { id: true, nom: true },
        },
        equipement: {
          select: {
            id: true,
            designation: true,
            immatriculation: true,
            typeEquipement: true,
          },
        },
      },
    })

    // Update equipment hour meter if compteurHeuresApres is provided
    if (equipementId && compteurHeuresApres !== undefined && compteurHeuresApres !== null) {
      await db.equipement.update({
        where: { id: equipementId },
        data: { compteurHeuresActuel: parseFloat(compteurHeuresApres) },
      })
    }

    return NextResponse.json(achat, { status: 201 })
  } catch (error) {
    console.error('POST /api/carburant/achats error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement du bon d'achat carburant" },
      { status: 500 }
    )
  }
}
