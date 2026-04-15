import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.sortieCarburant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Sortie carburant non trouvée' },
        { status: 404 }
      )
    }

    await db.sortieCarburant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/carburant/sorties/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la sortie carburant' },
      { status: 500 }
    )
  }
}
