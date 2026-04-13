import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const specialite = searchParams.get('specialite')
    const chantierId = searchParams.get('chantierId')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { nom: { contains: search.trim() } },
        { prenom: { contains: search.trim() } },
        { telephone: { contains: search.trim() } },
      ]
    }

    if (specialite && specialite.trim() && specialite !== 'TOUS') {
      where.specialite = specialite.trim()
    }

    // Filter by chantier assignment
    if (chantierId && chantierId.trim()) {
      where.affectations = {
        some: {
          chantierId: chantierId.trim(),
          actif: true,
        },
      }
    }

    const journaliers = await db.journalier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        affectations: {
          where: { actif: true },
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
              },
            },
          },
          orderBy: { dateDebut: 'desc' },
        },
      },
    })

    // KPI stats
    const allJournaliers = await db.journalier.findMany()

    const specialiteCounts: Record<string, number> = {}
    for (const j of allJournaliers) {
      const spec = j.specialite?.trim().toLowerCase() || 'autre'
      specialiteCounts[spec] = (specialiteCounts[spec] || 0) + 1
    }

    const kpi = {
      total: allJournaliers.length,
      macons: specialiteCounts['macon'] || specialiteCounts['maçon'] || 0,
      ferrailleurs: specialiteCounts['ferrailleur'] || 0,
      electriciens: specialiteCounts['electricien'] || specialiteCounts['électricien'] || 0,
      autres: allJournaliers.length - (
        (specialiteCounts['macon'] || specialiteCounts['maçon'] || 0) +
        (specialiteCounts['ferrailleur'] || 0) +
        (specialiteCounts['electricien'] || specialiteCounts['électricien'] || 0)
      ),
    }

    return NextResponse.json({
      journaliers,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/personnel error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du personnel' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nom, prenom, telephone, specialite } = body

    if (!nom || nom.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom est requis' },
        { status: 400 }
      )
    }

    if (!prenom || prenom.trim() === '') {
      return NextResponse.json(
        { error: 'Le prénom est requis' },
        { status: 400 }
      )
    }

    const journalier = await db.journalier.create({
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone?.trim() || null,
        specialite: specialite?.trim() || null,
      },
    })

    return NextResponse.json(journalier, { status: 201 })
  } catch (error) {
    console.error('POST /api/personnel error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du journalier' },
      { status: 500 }
    )
  }
}
