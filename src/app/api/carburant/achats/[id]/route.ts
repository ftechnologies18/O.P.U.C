import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.bonAchatCarburant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Bon d'achat carburant non trouvé" },
        { status: 404 }
      )
    }

    await db.bonAchatCarburant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/carburant/achats/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression du bon d'achat carburant" },
      { status: 500 }
    )
  }
}
