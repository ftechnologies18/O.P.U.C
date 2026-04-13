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

    const where: Prisma.SortieStockWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (stockId) where.stockId = stockId

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

    const sorties = await db.sortieStock.findMany({
      where,
      orderBy: { dateSortie: 'desc' },
      include: {
        stock: {
          select: {
            id: true,
            reference: true,
            designation: true,
            unite: true,
          },
        },
        tache: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    return NextResponse.json({ sorties })
  } catch (error) {
    console.error('GET /api/stocks/sorties error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sorties' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stockId, chantierId, quantite, tacheId, operateur, motif, dateSortie } =
      body

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

    // Calculate available stock
    const totalEntrees = await db.entreeStock.aggregate({
      where: { stockId },
      _sum: { quantite: true },
    })

    const totalSorties = await db.sortieStock.aggregate({
      where: { stockId },
      _sum: { quantite: true },
    })

    const available =
      (totalEntrees._sum.quantite || 0) - (totalSorties._sum.quantite || 0)

    if (quantite > available) {
      return NextResponse.json(
        {
          error: `Quantité insuffisante. Stock disponible : ${available}`,
          quantiteDisponible: available,
        },
        { status: 400 }
      )
    }

    const sortie = await db.sortieStock.create({
      data: {
        stockId,
        chantierId,
        quantite: parseFloat(quantite),
        tacheId: tacheId?.trim() || null,
        operateur: operateur?.trim() || null,
        motif: motif?.trim() || null,
        dateSortie: dateSortie ? new Date(dateSortie) : new Date(),
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
        tache: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    return NextResponse.json(sortie, { status: 201 })
  } catch (error) {
    console.error('POST /api/stocks/sorties error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la sortie" },
      { status: 500 }
    )
  }
}
