import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { chantierId, dateDebut, dateFin } = body

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (!dateDebut) {
      return NextResponse.json(
        { error: 'La date de début est requise' },
        { status: 400 }
      )
    }

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

    // Check if chantier exists
    const chantier = await db.chantier.findUnique({
      where: { id: chantierId },
    })

    if (!chantier) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    // Deactivate any existing active assignment to this chantier for this journalier
    await db.journalierAffectation.updateMany({
      where: {
        journalierId: id,
        chantierId: chantierId,
        actif: true,
      },
      data: { actif: false },
    })

    // Create new assignment
    const affectation = await db.journalierAffectation.create({
      data: {
        journalierId: id,
        chantierId: chantierId,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        actif: true,
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

    return NextResponse.json(affectation, { status: 201 })
  } catch (error) {
    console.error('POST /api/personnel/[id]/affectations error:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'affectation du journalier" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    // Deactivate the active assignment
    const result = await db.journalierAffectation.updateMany({
      where: {
        journalierId: id,
        chantierId: chantierId,
        actif: true,
      },
      data: { actif: false, dateFin: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Aucune affectation active trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/personnel/[id]/affectations error:', error)
    return NextResponse.json(
      { error: "Erreur lors du retrait de l'affectation" },
      { status: 500 }
    )
  }
}
