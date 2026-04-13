import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const phaseId = searchParams.get('phaseId')
    const tacheId = searchParams.get('tacheId')
    const categorie = searchParams.get('categorie')
    const auteurId = searchParams.get('auteurId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const search = searchParams.get('search')
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = {}

    if (chantierId) {
      where.chantierId = chantierId
    }
    if (phaseId) {
      where.phaseId = phaseId
    }
    if (tacheId) {
      where.tacheId = tacheId
    }
    if (categorie) {
      where.categorie = categorie
    }
    if (auteurId) {
      where.priseParId = auteurId
    }

    // Date range filter on datePrise
    if (dateDebut || dateFin) {
      const dateFilter: Record<string, unknown> = {}
      if (dateDebut) {
        const start = new Date(dateDebut)
        start.setHours(0, 0, 0, 0)
        dateFilter.gte = start
      }
      if (dateFin) {
        const end = new Date(dateFin)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      where.datePrise = dateFilter
    }

    // Text search in legende
    if (search && search.trim()) {
      where.legende = { contains: search.trim() }
    }

    // Cursor-based pagination
    const cursorClause = cursor ? { id: cursor } : undefined

    const photos = await db.photo.findMany({
      where,
      orderBy: { datePrise: 'desc' },
      take: limit + 1,
      ...(cursorClause ? { cursor: cursorClause, skip: 1 } : {}),
      include: {
        prisePar: {
          select: { id: true, name: true },
        },
        phase: {
          select: { id: true, nom: true },
        },
        tache: {
          select: { id: true, nom: true },
        },
      },
    })

    const hasMore = photos.length > limit
    const items = hasMore ? photos.slice(0, limit) : photos
    const nextCursor = hasMore ? items[items.length - 1].id : null

    // Stats by category
    const statsWhere: Record<string, unknown> = {}
    if (chantierId) statsWhere.chantierId = chantierId
    if (dateDebut || dateFin) {
      const dateFilter: Record<string, unknown> = {}
      if (dateDebut) {
        const start = new Date(dateDebut)
        start.setHours(0, 0, 0, 0)
        dateFilter.gte = start
      }
      if (dateFin) {
        const end = new Date(dateFin)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      statsWhere.datePrise = dateFilter
    }
    if (categorie) statsWhere.categorie = categorie

    const totalPhotos = await db.photo.count({ where: statsWhere })
    const avancementCount = await db.photo.count({
      where: { ...statsWhere, categorie: 'avancement' },
    })
    const incidentCount = await db.photo.count({
      where: { ...statsWhere, categorie: 'incident' },
    })
    const receptionCount = await db.photo.count({
      where: { ...statsWhere, categorie: 'reception' },
    })
    const materiauCount = await db.photo.count({
      where: { ...statsWhere, categorie: 'materiau' },
    })
    const documentCount = await db.photo.count({
      where: { ...statsWhere, categorie: 'document' },
    })

    return NextResponse.json({
      photos: items,
      nextCursor,
      stats: {
        total: totalPhotos,
        avancement: avancementCount,
        incident: incidentCount,
        reception: receptionCount,
        materiau: materiauCount,
        document: documentCount,
      },
    })
  } catch (error) {
    console.error('GET /api/photos error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des photos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      chantierId,
      phaseId,
      tacheId,
      rapportId,
      priseParId,
      datePrise,
      legende,
      categorie,
      urlOriginale,
      urlThumbnail,
    } = body

    if (!chantierId || !priseParId || !datePrise || !urlOriginale) {
      return NextResponse.json(
        {
          error:
            'Le chantier, l\'auteur, la date de prise et l\'URL sont requis',
        },
        { status: 400 }
      )
    }

    const photo = await db.photo.create({
      data: {
        chantierId,
        phaseId: phaseId || null,
        tacheId: tacheId || null,
        rapportId: rapportId || null,
        priseParId,
        datePrise: new Date(datePrise),
        legende: legende?.trim() || null,
        categorie: categorie || 'avancement',
        urlOriginale: urlOriginale,
        urlThumbnail: urlThumbnail || null,
      },
      include: {
        prisePar: {
          select: { id: true, name: true },
        },
        phase: {
          select: { id: true, nom: true },
        },
        tache: {
          select: { id: true, nom: true },
        },
      },
    })

    return NextResponse.json({ photo }, { status: 201 })
  } catch (error) {
    console.error('POST /api/photos error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la photo' },
      { status: 500 }
    )
  }
}
