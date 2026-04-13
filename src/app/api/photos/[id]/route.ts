import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const photo = await db.photo.findUnique({
      where: { id },
      include: {
        prisePar: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        phase: {
          select: {
            id: true,
            nom: true,
          },
        },
        tache: {
          select: {
            id: true,
            nom: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
          },
        },
        rapport: {
          select: {
            id: true,
            dateRapport: true,
          },
        },
      },
    })

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ photo })
  } catch (error) {
    console.error('GET /api/photos/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la photo' },
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
    const { legende, categorie, phaseId, tacheId } = body

    const existing = await db.photo.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Photo non trouvée' },
        { status: 404 }
      )
    }

    // Validate phaseId belongs to the same chantier
    if (phaseId && phaseId !== existing.phaseId) {
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
        select: { chantierId: true },
      })
      if (phase && phase.chantierId !== existing.chantierId) {
        return NextResponse.json(
          { error: 'La phase n\'appartient pas au même chantier' },
          { status: 400 }
        )
      }
    }

    // Validate tacheId belongs to the same chantier via its phase
    if (tacheId && tacheId !== existing.tacheId) {
      const tache = await db.tache.findUnique({
        where: { id: tacheId },
        include: { phase: { select: { chantierId: true } } },
      })
      if (tache && tache.phase.chantierId !== existing.chantierId) {
        return NextResponse.json(
          { error: 'La tâche n\'appartient pas au même chantier' },
          { status: 400 }
        )
      }
    }

    const photo = await db.photo.update({
      where: { id },
      data: {
        ...(legende !== undefined ? { legende: legende?.trim() || null } : {}),
        ...(categorie !== undefined ? { categorie } : {}),
        ...(phaseId !== undefined ? { phaseId: phaseId || null } : {}),
        ...(tacheId !== undefined ? { tacheId: tacheId || null } : {}),
      },
      include: {
        prisePar: {
          select: { id: true, name: true },
        },
        phase: {
          select: { id: true, nom: true },
        },
        tache: {
          select: { id: true, nom: true },
        },
      },
    })

    return NextResponse.json({ photo })
  } catch (error) {
    console.error('PUT /api/photos/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la photo' },
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

    const existing = await db.photo.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Photo non trouvée' },
        { status: 404 }
      )
    }

    await db.photo.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/photos/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la photo' },
      { status: 500 }
    )
  }
}
