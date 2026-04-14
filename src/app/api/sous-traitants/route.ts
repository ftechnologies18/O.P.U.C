import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const specialite = searchParams.get('specialite')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { raisonSociale: { contains: search.trim() } },
        { nom: { contains: search.trim() } },
        { prenom: { contains: search.trim() } },
        { specialite: { contains: search.trim() } },
        { contact: { contains: search.trim() } },
        { email: { contains: search.trim() } },
      ]
    }

    if (specialite && specialite.trim() && specialite !== 'TOUS') {
      where.specialite = specialite.trim()
    }

    if (type && type.trim() && type !== 'TOUS') {
      where.type = type.trim()
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
    const [totalSousTraitants, entreprises, particuliers, contratsEnCours] = await Promise.all([
      db.sousTraitant.count(),
      db.sousTraitant.count({ where: { type: 'ENTREPRISE' } }),
      db.sousTraitant.count({ where: { type: 'PARTICULIER' } }),
      db.contratST.count({ where: { statut: 'EN_COURS' } }),
    ])

    const allContrats = await db.contratST.findMany({
      where: { statut: { not: 'ANNULE' } },
    })

    const montantTotalEngage = allContrats.reduce(
      (sum, c) => sum + (c.montantHT || 0),
      0
    )

    const kpi = {
      totalSousTraitants,
      entreprises,
      particuliers,
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
    const {
      type,
      raisonSociale,
      nom,
      prenom,
      rccm,
      nif,
      typePieceIdentite,
      numeroPieceIdentite,
      contact,
      email,
      adresse,
      specialite,
      rib,
    } = body

    // Validate based on type
    if (type === 'ENTREPRISE') {
      if (!raisonSociale || raisonSociale.trim() === '') {
        return NextResponse.json(
          { error: 'La raison sociale est requise pour une entreprise' },
          { status: 400 }
        )
      }
    } else if (type === 'PARTICULIER') {
      if (!nom || nom.trim() === '') {
        return NextResponse.json(
          { error: 'Le nom est requis pour un particulier' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Le type doit être ENTREPRISE ou PARTICULIER' },
        { status: 400 }
      )
    }

    const sousTraitant = await db.sousTraitant.create({
      data: {
        type: type || 'ENTREPRISE',
        raisonSociale: raisonSociale?.trim() || null,
        nom: nom?.trim() || null,
        prenom: prenom?.trim() || null,
        rccm: rccm?.trim() || null,
        nif: nif?.trim() || null,
        typePieceIdentite: typePieceIdentite?.trim() || null,
        numeroPieceIdentite: numeroPieceIdentite?.trim() || null,
        contact: contact?.trim() || null,
        email: email?.trim() || null,
        adresse: adresse?.trim() || null,
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
