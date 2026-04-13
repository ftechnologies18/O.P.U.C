import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const specialite = searchParams.get('specialite')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { raisonSociale: { contains: search.trim() } },
        { specialite: { contains: search.trim() } },
      ]
    }

    if (specialite && specialite.trim() && specialite !== 'TOUS') {
      where.specialite = specialite.trim()
    }

    const sousTraitants = await db.sousTraitant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contrats: true },
        },
      },
    })

    // KPI stats
    const allSousTraitants = await db.sousTraitant.findMany()
    const allContrats = await db.contratST.findMany({
      where: { statut: { not: 'ANNULE' } },
    })

    const contratsEnCours = await db.contratST.count({
      where: { statut: 'EN_COURS' },
    })

    const montantTotalEngage = allContrats.reduce(
      (sum, c) => sum + (c.montantHT || 0),
      0
    )

    const kpi = {
      totalSousTraitants: allSousTraitants.length,
      contratsEnCours,
      montantTotalEngage,
    }

    return NextResponse.json({
      sousTraitants,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/sous-traitants error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sous-traitants' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { raisonSociale, rccm, contact, specialite, rib } = body

    if (!raisonSociale || raisonSociale.trim() === '') {
      return NextResponse.json(
        { error: 'La raison sociale est requise' },
        { status: 400 }
      )
    }

    const sousTraitant = await db.sousTraitant.create({
      data: {
        raisonSociale: raisonSociale.trim(),
        rccm: rccm?.trim() || null,
        contact: contact?.trim() || null,
        specialite: specialite?.trim() || null,
        rib: rib?.trim() || null,
      },
    })

    return NextResponse.json(sousTraitant, { status: 201 })
  } catch (error) {
    console.error('POST /api/sous-traitants error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du sous-traitant' },
      { status: 500 }
    )
  }
}
