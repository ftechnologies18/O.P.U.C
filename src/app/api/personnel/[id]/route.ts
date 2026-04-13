import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const journalier = await db.journalier.findUnique({
      where: { id },
      include: {
        affectations: {
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
                adresse: true,
              },
            },
          },
          orderBy: { dateDebut: 'desc' },
        },
        pointages: {
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
          orderBy: { dateTravail: 'desc' },
          take: 50,
        },
      },
    })

    if (!journalier) {
      return NextResponse.json(
        { error: 'Journalier non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(journalier)
  } catch (error) {
    console.error('GET /api/personnel/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du journalier' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const journalier = await db.journalier.update({
      where: { id },
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone?.trim() || null,
        specialite: specialite?.trim() || null,
      },
    })

    return NextResponse.json(journalier)
  } catch (error) {
    console.error('PUT /api/personnel/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du journalier' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if journalier exists
    const journalier = await db.journalier.findUnique({
      where: { id },
    })

    if (!journalier) {
      return NextResponse.json(
        { error: 'Journalier non trouvé' },
        { status: 404 }
      )
    }

    // Delete in order: pointages, affectations, then journalier
    await db.pointage.deleteMany({ where: { journalierId: id } })
    await db.journalierAffectation.deleteMany({ where: { journalierId: id } })
    await db.journalier.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/personnel/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du journalier' },
      { status: 500 }
    )
  }
}
