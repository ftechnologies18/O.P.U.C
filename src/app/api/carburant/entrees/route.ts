import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const stockId = searchParams.get('stockId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')

    const where: Prisma.EntreeCarburantWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (stockId) where.stockCarburantId = stockId

    if (dateDebut || dateFin) {
      where.dateEntree = {}
      if (dateDebut) {
        where.dateEntree.gte = new Date(dateDebut)
      }
      if (dateFin) {
        const endDate = new Date(dateFin)
        endDate.setHours(23, 59, 59, 999)
        where.dateEntree.lte = endDate
      }
    }

    const entrees = await db.entreeCarburant.findMany({
      where,
      orderBy: { dateEntree: 'desc' },
      include: {
        stock: {
          select: {
            id: true,
            typeCarburant: true,
            capacite: true,
          },
        },
      },
    })

    return NextResponse.json({ entrees })
  } catch (error) {
    console.error('GET /api/carburant/entrees error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des entrées carburant' },
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
      dateEntree,
      quantite,
      prixUnitaire,
      prixTotal,
      fournisseur,
      numeroBL,
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

    if (prixUnitaire === undefined || prixUnitaire < 0) {
      return NextResponse.json(
        { error: 'Le prix unitaire est requis' },
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

    const entree = await db.entreeCarburant.create({
      data: {
        stockCarburantId,
        chantierId,
        dateEntree: dateEntree ? new Date(dateEntree) : new Date(),
        quantite: parseFloat(quantite),
        prixUnitaire: parseFloat(prixUnitaire),
        prixTotal: parseFloat(prixTotal ?? (quantite * prixUnitaire)),
        fournisseur: fournisseur?.trim() || null,
        numeroBL: numeroBL?.trim() || null,
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
      },
    })

    return NextResponse.json(entree, { status: 201 })
  } catch (error) {
    console.error('POST /api/carburant/entrees error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'entrée carburant" },
      { status: 500 }
    )
  }
}
