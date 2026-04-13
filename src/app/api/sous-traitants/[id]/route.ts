import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sousTraitant = await db.sousTraitant.findUnique({
      where: { id },
      include: {
        contrats: {
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!sousTraitant) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(sousTraitant)
  } catch (error) {
    console.error('GET /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du sous-traitant' },
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
    const { raisonSociale, rccm, contact, specialite, rib } = body

    if (!raisonSociale || raisonSociale.trim() === '') {
      return NextResponse.json(
        { error: 'La raison sociale est requise' },
        { status: 400 }
      )
    }

    const existing = await db.sousTraitant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    const sousTraitant = await db.sousTraitant.update({
      where: { id },
      data: {
        raisonSociale: raisonSociale.trim(),
        rccm: rccm?.trim() || null,
        contact: contact?.trim() || null,
        specialite: specialite?.trim() || null,
        rib: rib?.trim() || null,
      },
    })

    return NextResponse.json(sousTraitant)
  } catch (error) {
    console.error('PUT /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du sous-traitant' },
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

    const existing = await db.sousTraitant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Sous-traitant non trouvé' },
        { status: 404 }
      )
    }

    // Delete contrats first, then sous-traitant
    await db.contratST.deleteMany({ where: { sousTraitantId: id } })
    await db.sousTraitant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sous-traitants/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du sous-traitant' },
      { status: 500 }
    )
  }
}
