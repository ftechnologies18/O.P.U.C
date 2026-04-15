import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const stock = await db.stockCarburant.findUnique({
      where: { id },
      include: {
        _count: { select: { entrees: true, sorties: true } },
        entrees: { select: { quantite: true } },
        sorties: { select: { quantite: true } },
        chantier: {
          select: { id: true, nom: true },
        },
      },
    })

    if (!stock) {
      return NextResponse.json(
        { error: 'Stock carburant non trouvé' },
        { status: 404 }
      )
    }

    const totalEntrees = stock.entrees.reduce((sum, e) => sum + e.quantite, 0)
    const totalSorties = stock.sorties.reduce((sum, s) => sum + s.quantite, 0)
    const quantiteDisponible = totalEntrees - totalSorties

    return NextResponse.json({
      ...stock,
      quantiteDisponible,
      enAlerte: quantiteDisponible <= stock.seuilAlerte,
    })
  } catch (error) {
    console.error('GET /api/carburant/stock/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du stock carburant' },
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
    const { capacite, seuilAlerte } = body

    const existing = await db.stockCarburant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Stock carburant non trouvé' },
        { status: 404 }
      )
    }

    const stock = await db.stockCarburant.update({
      where: { id },
      data: {
        ...(capacite !== undefined && { capacite: parseFloat(capacite) }),
        ...(seuilAlerte !== undefined && { seuilAlerte: parseFloat(seuilAlerte) }),
      },
    })

    return NextResponse.json(stock)
  } catch (error) {
    console.error('PUT /api/carburant/stock/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du stock carburant' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.stockCarburant.findUnique({
      where: { id },
      include: {
        _count: { select: { entrees: true, sorties: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Stock carburant non trouvé' },
        { status: 404 }
      )
    }

    if (existing._count.entrees > 0 || existing._count.sorties > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un stock ayant des entrées ou sorties' },
        { status: 400 }
      )
    }

    await db.stockCarburant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/carburant/stock/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du stock carburant' },
      { status: 500 }
    )
  }
}
