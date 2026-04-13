import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/chantiers/[id]/phases — List phases of a chantier
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const phases = await db.phase.findMany({
      where: { chantierId: id },
      include: {
        taches: {
          orderBy: { ordre: 'asc' },
          include: {
            responsable: { select: { id: true, name: true } },
          },
        },
        _count: { select: { taches: true, photos: true } },
      },
      orderBy: { ordre: 'asc' },
    })

    return NextResponse.json(phases)
  } catch (error) {
    console.error('GET /api/chantiers/[id]/phases error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/chantiers/[id]/phases — Create a phase
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { nom, description, ordre, dateDebut, dateFin } = body

    if (!nom || nom.trim().length < 2) {
      return NextResponse.json({ error: 'Le nom de la phase est requis' }, { status: 400 })
    }

    // Get the max order if not provided
    let phaseOrdre = ordre
    if (!phaseOrdre) {
      const maxPhase = await db.phase.findFirst({
        where: { chantierId: id },
        orderBy: { ordre: 'desc' },
        select: { ordre: true },
      })
      phaseOrdre = (maxPhase?.ordre || 0) + 1
    }

    const phase = await db.phase.create({
      data: {
        nom: nom.trim(),
        description: description?.trim() || null,
        ordre: phaseOrdre,
        avancement: 0,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        chantierId: id,
      },
    })

    return NextResponse.json(phase, { status: 201 })
  } catch (error) {
    console.error('POST /api/chantiers/[id]/phases error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
