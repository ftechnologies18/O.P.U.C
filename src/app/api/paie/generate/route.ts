import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chantierId, semaineDebut } = body

    if (!chantierId || !semaineDebut) {
      return NextResponse.json(
        { error: 'Le chantier et la date de début de semaine sont requis' },
        { status: 400 }
      )
    }

    // Compute Monday 00:00 and Sunday 23:59
    const weekStart = new Date(semaineDebut)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6) // Sunday
    weekEnd.setHours(23, 59, 59, 999)

    // Fetch all pointages for this chantier within the week where present=true
    const pointages = await db.pointage.findMany({
      where: {
        chantierId,
        dateTravail: {
          gte: weekStart,
          lte: weekEnd,
        },
        present: true,
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
    })

    if (pointages.length === 0) {
      return NextResponse.json({
        paiements: [],
        message: 'Aucun pointage trouvé pour cette semaine et ce chantier.',
      })
    }

    // Group by journalier
    const grouped: Record<string, typeof pointages> = {}
    for (const p of pointages) {
      if (!grouped[p.journalierId]) {
        grouped[p.journalierId] = []
      }
      grouped[p.journalierId].push(p)
    }

    const results = []

    for (const [journalierId, pts] of Object.entries(grouped)) {
      // Sum tauxJournalier for all present days
      const montantCalcule = pts.reduce((sum, p) => sum + p.tauxJournalier, 0)

      // Check if a PaiementHebdo already exists for this journalier+chantier+week
      const existing = await db.paiementHebdo.findFirst({
        where: {
          journalierId,
          chantierId,
          semaineDebut: weekStart,
        },
      })

      if (existing) {
        // Update montantCalcule if pointages changed (only if still EN_ATTENTE)
        if (existing.statut === 'EN_ATTENTE') {
          const updated = await db.paiementHebdo.update({
            where: { id: existing.id },
            data: { montantCalcule },
            include: {
              journalier: {
                select: { id: true, nom: true, prenom: true, specialite: true },
              },
              validePar: {
                select: { id: true, name: true },
              },
            },
          })
          results.push({ ...updated, updated: true })
        } else {
          results.push({ ...existing, skipped: true })
        }
      } else {
        const created = await db.paiementHebdo.create({
          data: {
            journalierId,
            chantierId,
            semaineDebut: weekStart,
            semaineFin: weekEnd,
            montantCalcule,
          },
          include: {
            journalier: {
              select: { id: true, nom: true, prenom: true, specialite: true },
            },
            validePar: {
              select: { id: true, name: true },
            },
          },
        })
        results.push({ ...created, created: true })
      }
    }

    return NextResponse.json({ paiements: results }, { status: 201 })
  } catch (error) {
    console.error('POST /api/paie/generate error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du récapitulatif hebdomadaire' },
      { status: 500 }
    )
  }
}
