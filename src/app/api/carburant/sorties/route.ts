import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const stockId = searchParams.get('stockId')
    const equipementId = searchParams.get('equipementId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')

    const where: Prisma.SortieCarburantWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (stockId) where.stockCarburantId = stockId
    if (equipementId) where.equipementId = equipementId

    if (dateDebut || dateFin) {
      where.dateSortie = {}
      if (dateDebut) {
        where.dateSortie.gte = new Date(dateDebut)
      }
      if (dateFin) {
        const endDate = new Date(dateFin)
        endDate.setHours(23, 59, 59, 999)
        where.dateSortie.lte = endDate
      }
    }

    const sorties = await db.sortieCarburant.findMany({
      where,
      orderBy: { dateSortie: 'desc' },
      include: {
        stock: {
          select: {
            id: true,
            typeCarburant: true,
            capacite: true,
          },
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

    return NextResponse.json({ sorties })
  } catch (error) {
    console.error('GET /api/carburant/sorties error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sorties carburant' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      stockCarburantId,
      chantierId,
      equipementId,
      dateSortie,
      quantite,
      operateur,
      compteurHeuresAvant,
      compteurHeuresApres,
      observation,
    } = body

    if (!stockCarburantId) {
      return NextResponse.json(
        { error: 'Le stock carburant est requis' },
        { status: 400 }
      )
    }

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

    // Verify stock exists
    const stockExists = await db.stockCarburant.findUnique({
      where: { id: stockCarburantId },
    })
    if (!stockExists) {
      return NextResponse.json(
        { error: 'Stock carburant non trouvé' },
        { status: 404 }
      )
    }

    const sortie = await db.sortieCarburant.create({
      data: {
        stockCarburantId,
        chantierId,
        equipementId: equipementId || null,
        dateSortie: dateSortie ? new Date(dateSortie) : new Date(),
        quantite: parseFloat(quantite),
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
        stock: {
          select: {
            id: true,
            typeCarburant: true,
            capacite: true,
          },
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

    return NextResponse.json(sortie, { status: 201 })
  } catch (error) {
    console.error('POST /api/carburant/sorties error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la sortie carburant" },
      { status: 500 }
    )
  }
}
