import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (statut && statut !== 'TOUS') {
      where.statut = statut
    }

    if (search && search.trim()) {
      where.OR = [
        { nom: { contains: search.trim() } },
        { adresse: { contains: search.trim() } },
        { maitreOuvrage: { contains: search.trim() } },
      ]
    }

    const chantiers = await db.chantier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            phases: true,
            journaliers: true,
          },
        },
      },
    })

    // Calculate global avancement (average of all phases)
    const chantiersWithProgress = await Promise.all(
      chantiers.map(async (chantier) => {
        let avancement = 0
        if (chantier._count.phases > 0) {
          const phases = await db.phase.findMany({
            where: { chantierId: chantier.id },
            select: { avancement: true },
          })
          avancement =
            phases.reduce((sum, p) => sum + p.avancement, 0) / phases.length
        }
        return {
          ...chantier,
          avancementGlobal: Math.round(avancement),
        }
      })
    )

    // KPI data
    const allChantiers = await db.chantier.findMany()
    const kpi = {
      total: allChantiers.length,
      actifs: allChantiers.filter((c) => c.statut === 'EN_COURS').length,
      enPreparation: allChantiers.filter(
        (c) => c.statut === 'EN_PREPARATION'
      ).length,
      termines: allChantiers.filter(
        (c) => c.statut === 'TERMINE' || c.statut === 'RECEPTIONNE'
      ).length,
    }

    return NextResponse.json({
      chantiers: chantiersWithProgress,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/chantiers error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des chantiers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nom, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, description } = body

    if (!nom || nom.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom du chantier est requis' },
        { status: 400 }
      )
    }

    const chantier = await db.chantier.create({
      data: {
        nom: nom.trim(),
        adresse: adresse?.trim() || null,
        maitreOuvrage: maitreOuvrage?.trim() || null,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : null,
        budgetPrevisionnel: budgetPrevisionnel || 0,
        description: description?.trim() || null,
      },
    })

    return NextResponse.json(chantier, { status: 201 })
  } catch (error) {
    console.error('POST /api/chantiers error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du chantier' },
      { status: 500 }
    )
  }
}
