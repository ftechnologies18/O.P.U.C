import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { present, tauxJournalier, observation } = body

    const existing = await db.pointage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Pointage non trouvé' },
        { status: 404 }
      )
    }

    if (existing.valide) {
      return NextResponse.json(
        { error: 'Ce pointage a été validé et ne peut plus être modifié' },
        { status: 403 }
      )
    }

    const pointage = await db.pointage.update({
      where: { id },
      data: {
        present: present !== undefined ? present : undefined,
        tauxJournalier: tauxJournalier !== undefined ? Number(tauxJournalier) : undefined,
        observation: observation !== undefined ? (observation?.trim() || null) : undefined,
      },
      include: {
        journalier: {
          select: { id: true, nom: true, prenom: true, specialite: true },
        },
      },
    })

    return NextResponse.json(pointage)
  } catch (error) {
    console.error('PUT /api/pointage/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du pointage' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.pointage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Pointage non trouvé' },
        { status: 404 }
      )
    }

    if (existing.valide) {
      return NextResponse.json(
        { error: 'Ce pointage a été validé et ne peut plus être supprimé' },
        { status: 403 }
      )
    }

    await db.pointage.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/pointage/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du pointage' },
      { status: 500 }
    )
  }
}
