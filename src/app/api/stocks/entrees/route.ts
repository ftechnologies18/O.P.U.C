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

    const where: Prisma.EntreeStockWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (stockId) where.stockId = stockId

    if (dateDebut || dateFin) {
      where.dateEntree = {}
      if (dateDebut) {
        where.dateEntree.gte = new Date(dateDebut)
      }
      if (dateFin) {
        // End of day for dateFin
        const endDate = new Date(dateFin)
        endDate.setHours(23, 59, 59, 999)
        where.dateEntree.lte = endDate
      }
    }

    const entrees = await db.entreeStock.findMany({
      where,
      orderBy: { dateEntree: 'desc' },
      include: {
        stock: {
          select: {
            id: true,
            reference: true,
            designation: true,
            unite: true,
          },
        },
      },
    })

    return NextResponse.json({ entrees })
  } catch (error) {
    console.error('GET /api/stocks/entrees error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des entrées' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      stockId,
      chantierId,
      quantite,
      prixUnitaire,
      fournisseur,
      numeroBL,
      dateEntree,
    } = body

    if (!stockId) {
      return NextResponse.json(
        { error: 'Le matériau est requis' },
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

    const entree = await db.entreeStock.create({
      data: {
        stockId,
        chantierId,
        quantite: parseFloat(quantite),
        prixUnitaire: parseFloat(prixUnitaire),
        fournisseur: fournisseur?.trim() || null,
        numeroBL: numeroBL?.trim() || null,
        dateEntree: dateEntree ? new Date(dateEntree) : new Date(),
      },
      include: {
        stock: {
          select: {
            id: true,
            reference: true,
            designation: true,
            unite: true,
          },
        },
      },
    })

    return NextResponse.json(entree, { status: 201 })
  } catch (error) {
    console.error('POST /api/stocks/entrees error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'entrée" },
      { status: 500 }
    )
  }
}
