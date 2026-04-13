import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const statut = searchParams.get('statut')
    const semaineDebut = searchParams.get('semaineDebut')

    const where: Record<string, unknown> = {}

    if (chantierId) {
      where.chantierId = chantierId
    }

    if (statut && statut !== 'TOUS') {
      where.statut = statut
    }

    if (semaineDebut) {
      const start = new Date(semaineDebut)
      start.setHours(0, 0, 0, 0)
      where.semaineDebut = start
    }

    const paiements = await db.paiementHebdo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
          },
        },
        validePar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ paiements })
  } catch (error) {
    console.error('GET /api/paie error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paiements' },
      { status: 500 }
    )
  }
}
