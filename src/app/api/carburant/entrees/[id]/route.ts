import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.entreeCarburant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Entrée carburant non trouvée' },
        { status: 404 }
      )
    }

    await db.entreeCarburant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/carburant/entrees/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'entrée carburant" },
      { status: 500 }
    )
  }
}
