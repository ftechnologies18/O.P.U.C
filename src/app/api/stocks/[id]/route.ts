import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { reference, designation, categorie, unite, seuilAlerte } = body

    const existing = await db.stockMateriel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Matériau non trouvé' },
        { status: 404 }
      )
    }

    const stock = await db.stockMateriel.update({
      where: { id },
      data: {
        reference: reference !== undefined ? reference.trim() : undefined,
        designation: designation !== undefined ? designation.trim() : undefined,
        categorie:
          categorie !== undefined
            ? categorie.trim() || null
            : undefined,
        unite: unite !== undefined ? unite.trim() : undefined,
        seuilAlerte: seuilAlerte !== undefined ? seuilAlerte : undefined,
      },
    })

    return NextResponse.json(stock)
  } catch (error) {
    console.error('PUT /api/stocks/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du matériau' },
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

    const existing = await db.stockMateriel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Matériau non trouvé' },
        { status: 404 }
      )
    }

    // Delete related sorties first, then entrees, then stock
    await db.sortieStock.deleteMany({ where: { stockId: id } })
    await db.entreeStock.deleteMany({ where: { stockId: id } })
    await db.stockMateriel.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/stocks/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du matériau' },
      { status: 500 }
    )
  }
}
