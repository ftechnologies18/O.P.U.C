import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId] — Update a task
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string; tacheId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { tacheId } = await params
    const body = await req.json()

    // Auto-determine statut from avancement
    let statut = body.statut
    if (body.avancement !== undefined) {
      const avancement = parseFloat(body.avancement) || 0
      if (avancement >= 100) {
        statut = 'TERMINEE'
      } else if (avancement > 0) {
        statut = 'EN_COURS'
      } else if (body.statut === undefined) {
        statut = 'PLANIFIEE'
      }
    }

    // Check for delay
    if (body.dateFin && body.statut !== 'TERMINEE' && statut !== 'TERMINEE') {
      const now = new Date()
      const dateFin = new Date(body.dateFin)
      if (now > dateFin && statut !== 'TERMINEE') {
        if (!body.avancement || parseFloat(body.avancement) < 100) {
          statut = 'EN_RETARD'
        }
      }
    }

    const tache = await db.tache.update({
      where: { id: tacheId },
      data: {
        ...(body.nom !== undefined && { nom: body.nom.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.ordre !== undefined && { ordre: body.ordre }),
        ...(body.avancement !== undefined && { avancement: parseFloat(body.avancement) || 0 }),
        ...(body.dateDebut !== undefined && { dateDebut: body.dateDebut ? new Date(body.dateDebut) : null }),
        ...(body.dateFin !== undefined && { dateFin: body.dateFin ? new Date(body.dateFin) : null }),
        ...(body.responsableId !== undefined && { responsableId: body.responsableId || null }),
        ...(body.tachePrecedenteId !== undefined && { tachePrecedenteId: body.tachePrecedenteId || null }),
        ...(statut !== undefined && { statut }),
      },
      include: {
        responsable: { select: { id: true, name: true } },
      },
    })

    // Recalculate phase avancement
    const phaseId = tache.phaseId
    const allTasks = await db.tache.findMany({
      where: { phaseId },
      select: { avancement: true },
    })
    const phaseAvancement = allTasks.length > 0
      ? allTasks.reduce((sum, t) => sum + t.avancement, 0) / allTasks.length
      : 0
    await db.phase.update({
      where: { id: phaseId },
      data: { avancement: Math.round(phaseAvancement * 10) / 10 },
    })

    return NextResponse.json(tache)
  } catch (error) {
    console.error('PUT tache error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string; tacheId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { tacheId, phaseId } = await params

    await db.photo.deleteMany({ where: { tacheId } })
    await db.sortieStock.updateMany({ where: { tacheId }, data: { tacheId: null } })
    await db.tache.updateMany({ where: { tachePrecedenteId: tacheId }, data: { tachePrecedenteId: null } })
    await db.tache.delete({ where: { id: tacheId } })

    // Recalculate phase avancement
    const allTasks = await db.tache.findMany({
      where: { phaseId },
      select: { avancement: true },
    })
    const phaseAvancement = allTasks.length > 0
      ? allTasks.reduce((sum, t) => sum + t.avancement, 0) / allTasks.length
      : 0
    await db.phase.update({
      where: { id: phaseId },
      data: { avancement: Math.round(phaseAvancement * 10) / 10 },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE tache error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
