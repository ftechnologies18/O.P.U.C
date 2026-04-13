import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rapport = await db.rapportJournalier.findUnique({
      where: { id },
      include: {
        auteur: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
            adresse: true,
          },
        },
        photos: {
          select: {
            id: true,
            legende: true,
            categorie: true,
            urlOriginale: true,
            urlThumbnail: true,
            datePrise: true,
          },
          orderBy: { datePrise: 'asc' },
        },
      },
    })

    if (!rapport) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ rapport })
  } catch (error) {
    console.error('GET /api/rapports/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du rapport' },
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
    const {
      dateRapport,
      meteo,
      effectifPresent,
      travauxRealises,
      incidents,
      observations,
    } = body

    const existing = await db.rapportJournalier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      )
    }

    if (travauxRealises !== undefined && !travauxRealises.trim()) {
      return NextResponse.json(
        { error: 'Les travaux réalisés sont requis' },
        { status: 400 }
      )
    }

    const rapport = await db.rapportJournalier.update({
      where: { id },
      data: {
        ...(dateRapport ? { dateRapport: new Date(dateRapport) } : {}),
        ...(meteo !== undefined ? { meteo: meteo || null } : {}),
        ...(effectifPresent !== undefined
          ? { effectifPresent: effectifPresent ? Number(effectifPresent) : null }
          : {}),
        ...(travauxRealises !== undefined
          ? { travauxRealises: travauxRealises.trim() }
          : {}),
        ...(incidents !== undefined
          ? { incidents: incidents?.trim() || null }
          : {}),
        ...(observations !== undefined
          ? { observations: observations?.trim() || null }
          : {}),
      },
      include: {
        auteur: {
          select: { id: true, name: true },
        },
        chantier: {
          select: { id: true, nom: true },
        },
      },
    })

    return NextResponse.json({ rapport })
  } catch (error) {
    console.error('PUT /api/rapports/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du rapport' },
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

    const existing = await db.rapportJournalier.findUnique({
      where: { id },
      include: { photos: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      )
    }

    // Delete linked photos first (clear rapportId)
    if (existing.photos.length > 0) {
      await db.photo.updateMany({
        where: { rapportId: id },
        data: { rapportId: null },
      })
    }

    await db.rapportJournalier.delete({ where: { id } })

    return NextResponse.json({ success: true, photosDetached: existing.photos.length })
  } catch (error) {
    console.error('DELETE /api/rapports/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du rapport' },
      { status: 500 }
    )
  }
}
