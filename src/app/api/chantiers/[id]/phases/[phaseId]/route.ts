import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT /api/chantiers/[id]/phases/[phaseId] — Update a phase
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { phaseId } = await params
    const body = await req.json()

    const phase = await db.phase.update({
      where: { id: phaseId },
      data: {
        ...(body.nom !== undefined && { nom: body.nom.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.ordre !== undefined && { ordre: body.ordre }),
        ...(body.avancement !== undefined && { avancement: parseFloat(body.avancement) || 0 }),
        ...(body.dateDebut !== undefined && { dateDebut: body.dateDebut ? new Date(body.dateDebut) : null }),
        ...(body.dateFin !== undefined && { dateFin: body.dateFin ? new Date(body.dateFin) : null }),
      },
    })

    return NextResponse.json(phase)
  } catch (error) {
    console.error('PUT phase error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chantiers/[id]/phases/[phaseId] — Delete a phase
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { phaseId } = await params

    await db.tache.deleteMany({ where: { phaseId } })
    await db.photo.deleteMany({ where: { phaseId } })
    await db.phase.delete({ where: { id: phaseId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE phase error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
