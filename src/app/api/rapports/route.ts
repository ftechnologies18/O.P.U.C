import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (chantierId) {
      where.chantierId = chantierId
    }

    // Date range filter on dateRapport
    if (dateDebut || dateFin) {
      const dateFilter: Record<string, unknown> = {}
      if (dateDebut) {
        const start = new Date(dateDebut)
        start.setHours(0, 0, 0, 0)
        dateFilter.gte = start
      }
      if (dateFin) {
        const end = new Date(dateFin)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      where.dateRapport = dateFilter
    }

    // Text search across travauxRealises, incidents, observations
    if (search && search.trim()) {
      where.OR = [
        { travauxRealises: { contains: search.trim() } },
        { incidents: { contains: search.trim() } },
        { observations: { contains: search.trim() } },
      ]
    }

    const rapports = await db.rapportJournalier.findMany({
      where,
      orderBy: { dateRapport: 'desc' },
      include: {
        auteur: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
          },
        },
        photos: {
          select: {
            id: true,
          },
        },
      },
    })

    // Add photo count and format
    const rapportsWithCount = rapports.map((r) => ({
      ...r,
      photoCount: r.photos.length,
      photos: undefined,
    }))

    // Summary KPIs
    const totalRapports = rapports.length
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rapportsToday = rapports.filter((r) => {
      const d = new Date(r.dateRapport)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === today.getTime()
    }).length

    return NextResponse.json({
      rapports: rapportsWithCount,
      total: totalRapports,
      rapportsToday,
    })
  } catch (error) {
    console.error('GET /api/rapports error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des rapports' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      chantierId,
      auteurId,
      dateRapport,
      meteo,
      effectifPresent,
      travauxRealises,
      incidents,
      observations,
    } = body

    if (!chantierId || !auteurId || !dateRapport || !travauxRealises?.trim()) {
      return NextResponse.json(
        {
          error:
            'Le chantier, l\'auteur, la date et les travaux réalisés sont requis',
        },
        { status: 400 }
      )
    }

    const rapport = await db.rapportJournalier.create({
      data: {
        chantierId,
        auteurId,
        dateRapport: new Date(dateRapport),
        meteo: meteo || null,
        effectifPresent: effectifPresent ? Number(effectifPresent) : null,
        travauxRealises: travauxRealises.trim(),
        incidents: incidents?.trim() || null,
        observations: observations?.trim() || null,
      },
      include: {
        auteur: {
          select: { id: true, name: true },
        },
        chantier: {
          select: { id: true, nom: true },
        },
      },
    })

    return NextResponse.json({ rapport }, { status: 201 })
  } catch (error) {
    console.error('POST /api/rapports error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du rapport' },
      { status: 500 }
    )
  }
}
