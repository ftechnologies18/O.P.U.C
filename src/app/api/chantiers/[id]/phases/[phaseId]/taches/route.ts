import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/chantiers/[id]/phases/[phaseId]/taches — Create a task
export async function POST(
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
    const { nom, description, ordre, dateDebut, dateFin, responsableId, tachePrecedenteId } = body

    if (!nom || nom.trim().length < 2) {
      return NextResponse.json({ error: 'Le nom de la tâche est requis' }, { status: 400 })
    }

    let taskOrdre = ordre
    if (!taskOrdre) {
      const maxTask = await db.tache.findFirst({
        where: { phaseId },
        orderBy: { ordre: 'desc' },
        select: { ordre: true },
      })
      taskOrdre = (maxTask?.ordre || 0) + 1
    }

    const tache = await db.tache.create({
      data: {
        nom: nom.trim(),
        description: description?.trim() || null,
        ordre: taskOrdre,
        avancement: 0,
        statut: 'PLANIFIEE',
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        responsableId: responsableId || null,
        tachePrecedenteId: tachePrecedenteId || null,
        phaseId,
      },
      include: {
        responsable: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(tache, { status: 201 })
  } catch (error) {
    console.error('POST tache error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
