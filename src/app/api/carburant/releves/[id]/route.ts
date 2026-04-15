import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.releveCompteurEngin.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Relevé compteur non trouvé' },
        { status: 404 }
      )
    }

    await db.releveCompteurEngin.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/carburant/releves/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du relevé compteur' },
      { status: 500 }
    )
  }
}
