import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const date = searchParams.get('date')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const journalierId = searchParams.get('journalierId')
    const valide = searchParams.get('valide')

    const where: Record<string, unknown> = {}

    if (chantierId) {
      where.chantierId = chantierId
    }

    if (date) {
      // Match date only (no time component)
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)
      where.dateTravail = { gte: startDate, lte: endDate }
    } else {
      if (dateDebut) {
        const start = new Date(dateDebut)
        start.setHours(0, 0, 0, 0)
        where.dateTravail = { ...(where.dateTravail as Record<string, unknown> | undefined), gte: start }
      }
      if (dateFin) {
        const end = new Date(dateFin)
        end.setHours(23, 59, 59, 999)
        where.dateTravail = { ...(where.dateTravail as Record<string, unknown> | undefined), lte: end }
      }
    }

    if (journalierId) {
      where.journalierId = journalierId
    }

    if (valide !== null && valide !== undefined && valide !== '') {
      where.valide = valide === 'true'
    }

    const pointages = await db.pointage.findMany({
      where,
      orderBy: { dateTravail: 'desc' },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    })

    return NextResponse.json({ pointages })
  } catch (error) {
    console.error('GET /api/pointage error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des pointages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chantierId, date, chefChantierId, pointages } = body

    if (!chantierId || !date || !chefChantierId || !Array.isArray(pointages)) {
      return NextResponse.json(
        { error: 'Chantier, date, chef de chantier et pointages sont requis' },
        { status: 400 }
      )
    }

    if (pointages.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un pointage est requis' },
        { status: 400 }
      )
    }

    const dateTravail = new Date(date)
    dateTravail.setHours(0, 0, 0, 0)

    const results = []

    for (const p of pointages) {
      if (!p.journalierId) continue

      // Check if pointage already exists for this journalier+chantier+date
      const existing = await db.pointage.findUnique({
        where: {
          journalierId_chantierId_dateTravail: {
            journalierId: p.journalierId,
            chantierId,
            dateTravail,
          },
        },
      })

      if (existing) {
        // Cannot modify validated pointage
        if (existing.valide) {
          results.push({ ...existing, skipped: true, reason: 'Pointage validé' })
          continue
        }

        const updated = await db.pointage.update({
          where: { id: existing.id },
          data: {
            present: p.present !== undefined ? p.present : existing.present,
            tauxJournalier: p.tauxJournalier !== undefined ? Number(p.tauxJournalier) : existing.tauxJournalier,
            observation: p.observation !== undefined ? (p.observation?.trim() || null) : existing.observation,
            chefChantierId,
          },
          include: {
            journalier: {
              select: { id: true, nom: true, prenom: true, specialite: true },
            },
          },
        })
        results.push({ ...updated, updated: true })
      } else {
        const created = await db.pointage.create({
          data: {
            journalierId: p.journalierId,
            chantierId,
            chefChantierId,
            dateTravail,
            present: p.present !== undefined ? p.present : true,
            tauxJournalier: p.tauxJournalier !== undefined ? Number(p.tauxJournalier) : 0,
            observation: p.observation?.trim() || null,
          },
          include: {
            journalier: {
              select: { id: true, nom: true, prenom: true, specialite: true },
            },
          },
        })
        results.push({ ...created, created: true })
      }
    }

    return NextResponse.json({ pointages: results }, { status: 201 })
  } catch (error) {
    console.error('POST /api/pointage error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement des pointages' },
      { status: 500 }
    )
  }
}
