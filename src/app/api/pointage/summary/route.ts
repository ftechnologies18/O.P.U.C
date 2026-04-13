import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const semaine = searchParams.get('semaine') // ISO week date string e.g. "2026-W15"

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    // Parse the week to get start (Monday) and end (Sunday)
    let weekStart: Date
    let weekEnd: Date

    if (semaine) {
      // Parse ISO week date format: "2026-W15"
      const match = semaine.match(/^(\d{4})-W(\d{1,2})$/)
      if (match) {
        const year = parseInt(match[1], 10)
        const week = parseInt(match[2], 10)
        // Get the first day of the ISO week
        const jan4 = new Date(year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7 // ISO: Monday = 1
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
        monday.setHours(0, 0, 0, 0)
        weekStart = monday
        weekEnd = new Date(monday)
        weekEnd.setDate(monday.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)
      } else {
        // Try parsing as a regular date and use its week
        const refDate = new Date(semaine)
        if (isNaN(refDate.getTime())) {
          return NextResponse.json(
            { error: 'Format de semaine invalide. Utilisez YYYY-WNN' },
            { status: 400 }
          )
        }
        const result = getISOWeekBounds(refDate)
        weekStart = result.start
        weekEnd = result.end
      }
    } else {
      // Default to current week
      const result = getISOWeekBounds(new Date())
      weekStart = result.start
      weekEnd = result.end
    }

    // Fetch all pointages for this chantier within the week
    const pointages = await db.pointage.findMany({
      where: {
        chantierId,
        dateTravail: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
      },
      orderBy: { dateTravail: 'asc' },
    })

    // Group by journalier
    const journalierMap = new Map<string, {
      journalier: { id: string; nom: string; prenom: string; specialite: string | null }
      days: number
      totalAmount: number
      details: Array<{
        dateTravail: Date
        present: boolean
        tauxJournalier: number
        observation: string | null
        valide: boolean
      }>
    }>()

    for (const p of pointages) {
      const key = p.journalierId
      if (!journalierMap.has(key)) {
        journalierMap.set(key, {
          journalier: p.journalier,
          days: 0,
          totalAmount: 0,
          details: [],
        })
      }
      const entry = journalierMap.get(key)!
      entry.details.push({
        dateTravail: p.dateTravail,
        present: p.present,
        tauxJournalier: p.tauxJournalier,
        observation: p.observation,
        valide: p.valide,
      })
      if (p.present) {
        entry.days += 1
        entry.totalAmount += p.tauxJournalier
      }
    }

    const summary = Array.from(journalierMap.values()).sort((a, b) =>
      `${a.journalier.nom} ${a.journalier.prenom}`.localeCompare(`${b.journalier.nom} ${b.journalier.prenom}`)
    )

    const grandTotal = summary.reduce((sum, s) => sum + s.totalAmount, 0)
    const totalDays = summary.reduce((sum, s) => sum + s.days, 0)

    return NextResponse.json({
      weekStart,
      weekEnd,
      summary,
      grandTotal,
      totalDays,
    })
  } catch (error) {
    console.error('GET /api/pointage/summary error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du résumé hebdomadaire' },
      { status: 500 }
    )
  }
}

function getISOWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()
  // Adjust to Monday (ISO week starts on Monday)
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { start: monday, end: sunday }
}
