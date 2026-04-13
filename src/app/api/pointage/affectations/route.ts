import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    const affectations = await db.journalierAffectation.findMany({
      where: {
        chantierId,
        actif: true,
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
      orderBy: { dateDebut: 'desc' },
    })

    return NextResponse.json({ affectations })
  } catch (error) {
    console.error('GET /api/pointage/affectations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des affectations' },
      { status: 500 }
    )
  }
}
