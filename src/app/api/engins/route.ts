import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const typeLocation = searchParams.get('typeLocation')
    const etat = searchParams.get('etat')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { designation: { contains: search.trim() } },
        { typeEquipement: { contains: search.trim() } },
        { marque: { contains: search.trim() } },
        { modele: { contains: search.trim() } },
        { immatriculation: { contains: search.trim() } },
      ]
    }

    if (typeLocation && typeLocation.trim() && typeLocation !== 'TOUS') {
      where.typeLocation = typeLocation.trim()
    }

    if (etat && etat.trim()) {
      where.etat = etat.trim()
    }

    const engins = await db.equipement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { locations: true },
        },
      },
    })

    // KPI stats
    const [totalEngins, enginsPropres, enginsLoues] = await Promise.all([
      db.equipement.count(),
      db.equipement.count({ where: { typeLocation: 'PROPRE' } }),
      db.equipement.count({ where: { typeLocation: 'LOUE' } }),
    ])

    const kpi = {
      totalEngins,
      enginsPropres,
      enginsLoues,
    }

    return NextResponse.json({
      engins,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/engins error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des engins' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      designation,
      typeEquipement,
      marque,
      modele,
      immatriculation,
      etat,
      typeLocation,
    } = body

    if (!designation || designation.trim() === '') {
      return NextResponse.json(
        { error: 'La désignation est requise' },
        { status: 400 }
      )
    }

    const engin = await db.equipement.create({
      data: {
        designation: designation.trim(),
        typeEquipement: typeEquipement?.trim() || null,
        marque: marque?.trim() || null,
        modele: modele?.trim() || null,
        immatriculation: immatriculation?.trim() || null,
        etat: etat || 'BON',
        typeLocation: typeLocation || 'PROPRE',
      },
    })

    return NextResponse.json(engin, { status: 201 })
  } catch (error) {
    console.error('POST /api/engins error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'engin" },
      { status: 500 }
    )
  }
}
