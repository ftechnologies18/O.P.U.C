import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const statut = searchParams.get('statut')

    // Verify sous-traitant exists
    const sousTraitant = await db.sousTraitant.findUnique({ where: { id } })
    if (!sousTraitant) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    const where: Record<string, unknown> = { sousTraitantId: id }

    if (chantierId && chantierId.trim()) {
      where.chantierId = chantierId.trim()
    }

    if (statut && statut.trim() && statut !== 'TOUS') {
      where.statut = statut.trim()
    }

    const contrats = await db.contratST.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    return NextResponse.json(contrats)
  } catch (error) {
    console.error('GET /api/sous-traitants/[id]/contrats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des contrats' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { chantierId, objetTravaux, montantHT, dateDebut, dateFin, conditions } = body

    // Verify sous-traitant exists
    const sousTraitant = await db.sousTraitant.findUnique({ where: { id } })
    if (!sousTraitant) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    if (!chantierId || !chantierId.trim()) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (!objetTravaux || objetTravaux.trim() === '') {
      return NextResponse.json(
        { error: "L'objet des travaux est requis" },
        { status: 400 }
      )
    }

    if (montantHT === undefined || montantHT === null || montantHT < 0) {
      return NextResponse.json(
        { error: 'Le montant HT est requis et doit être positif' },
        { status: 400 }
      )
    }

    const contrat = await db.contratST.create({
      data: {
        sousTraitantId: id,
        chantierId: chantierId.trim(),
        objetTravaux: objetTravaux.trim(),
        montantHT: parseFloat(montantHT),
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        conditions: conditions?.trim() || null,
      },
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    return NextResponse.json(contrat, { status: 201 })
  } catch (error) {
    console.error('POST /api/sous-traitants/[id]/contrats error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création du contrat" },
      { status: 500 }
    )
  }
}
