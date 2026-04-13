import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const chantier = await db.chantier.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { ordre: 'asc' },
          include: {
            taches: {
              orderBy: { ordre: 'asc' },
              include: {
                responsable: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            phases: true,
            journaliers: true,
            pointages: true,
          },
        },
      },
    })

    if (!chantier) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(chantier)
  } catch (error) {
    console.error('GET /api/chantiers/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du chantier' },
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
    const { nom, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, description, statut } = body

    const existing = await db.chantier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    const chantier = await db.chantier.update({
      where: { id },
      data: {
        nom: nom?.trim() || undefined,
        adresse: adresse !== undefined ? (adresse?.trim() || null) : undefined,
        maitreOuvrage: maitreOuvrage !== undefined ? (maitreOuvrage?.trim() || null) : undefined,
        dateDebut: dateDebut ? new Date(dateDebut) : (dateDebut === null ? null : undefined),
        dateFinPrevue: dateFinPrevue ? new Date(dateFinPrevue) : (dateFinPrevue === null ? null : undefined),
        budgetPrevisionnel: budgetPrevisionnel !== undefined ? Number(budgetPrevisionnel) : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        statut: statut || undefined,
      },
    })

    return NextResponse.json(chantier)
  } catch (error) {
    console.error('PUT /api/chantiers/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du chantier' },
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
    const existing = await db.chantier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    await db.chantier.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/chantiers/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du chantier' },
      { status: 500 }
    )
  }
}
