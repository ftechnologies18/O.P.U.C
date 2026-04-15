import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    const stocks = await db.stockCarburant.findMany({
      where: { chantierId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { entrees: true, sorties: true } },
        entrees: { select: { quantite: true } },
        sorties: { select: { quantite: true } },
      },
    })

    const stockItems = stocks.map((stock) => {
      const totalEntrees = stock.entrees.reduce((sum, e) => sum + e.quantite, 0)
      const totalSorties = stock.sorties.reduce((sum, s) => sum + s.quantite, 0)
      const quantiteDisponible = totalEntrees - totalSorties

      return {
        id: stock.id,
        chantierId: stock.chantierId,
        typeCarburant: stock.typeCarburant,
        capacite: stock.capacite,
        seuilAlerte: stock.seuilAlerte,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
        quantiteDisponible,
        enAlerte: quantiteDisponible <= stock.seuilAlerte,
        _count: stock._count,
      }
    })

    return NextResponse.json({ stocks: stockItems })
  } catch (error) {
    console.error('GET /api/carburant/stock error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stocks carburant' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chantierId, typeCarburant, capacite, seuilAlerte } = body

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (!typeCarburant || !['GASOIL', 'ESSENCE'].includes(typeCarburant)) {
      return NextResponse.json(
        { error: 'Le type de carburant doit être GASOIL ou ESSENCE' },
        { status: 400 }
      )
    }

    const stock = await db.stockCarburant.create({
      data: {
        chantierId,
        typeCarburant,
        capacite: parseFloat(capacite) || 5000,
        seuilAlerte: parseFloat(seuilAlerte) || 500,
      },
    })

    return NextResponse.json(stock, { status: 201 })
  } catch (error) {
    console.error('POST /api/carburant/stock error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du stock carburant' },
      { status: 500 }
    )
  }
}
