import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const equipementId = searchParams.get('equipementId')

    const where: Prisma.ReleveCompteurEnginWhereInput = {}

    if (chantierId) where.chantierId = chantierId
    if (equipementId) where.equipementId = equipementId

    const releves = await db.releveCompteurEngin.findMany({
      where,
      orderBy: { dateReleve: 'desc' },
      include: {
        equipement: {
          select: {
            id: true,
            designation: true,
            immatriculation: true,
            typeEquipement: true,
            compteurHeuresActuel: true,
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

    return NextResponse.json({ releves })
  } catch (error) {
    console.error('GET /api/carburant/releves error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des relevés compteur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { equipementId, chantierId, dateReleve, heuresKm, observation } = body

    if (!equipementId) {
      return NextResponse.json(
        { error: "L'équipement est requis" },
        { status: 400 }
      )
    }

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (heuresKm === undefined || heuresKm < 0) {
      return NextResponse.json(
        { error: 'La valeur du compteur est requise' },
        { status: 400 }
      )
    }

    const releve = await db.releveCompteurEngin.create({
      data: {
        equipementId,
        chantierId,
        dateReleve: dateReleve ? new Date(dateReleve) : new Date(),
        heuresKm: parseFloat(heuresKm),
        observation: observation?.trim() || null,
      },
      include: {
        equipement: {
          select: {
            id: true,
            designation: true,
            immatriculation: true,
            typeEquipement: true,
            compteurHeuresActuel: true,
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

    // Update equipment hour meter
    await db.equipement.update({
      where: { id: equipementId },
      data: { compteurHeuresActuel: parseFloat(heuresKm) },
    })

    return NextResponse.json(releve, { status: 201 })
  } catch (error) {
    console.error('POST /api/carburant/releves error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement du relevé compteur' },
      { status: 500 }
    )
  }
}
