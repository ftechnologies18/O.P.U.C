import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const statut = searchParams.get('statut')
    const chantierId = searchParams.get('chantierId')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { numeroContrat: { contains: search.trim() } },
        { fournisseurNom: { contains: search.trim() } },
        { equipement: { designation: { contains: search.trim() } } },
        { equipement: { typeEquipement: { contains: search.trim() } } },
      ]
    }

    if (statut && statut.trim() && statut !== 'TOUS') {
      where.statut = statut.trim()
    }

    if (chantierId && chantierId.trim()) {
      where.chantierId = chantierId.trim()
    }

    const locations = await db.locationEngin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        equipement: {
          select: {
            id: true,
            designation: true,
            typeEquipement: true,
          },
        },
        fournisseur: {
          select: {
            id: true,
            raisonSociale: true,
            nom: true,
            prenom: true,
            contact: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    // KPI stats
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const locationsEnCours = await db.locationEngin.findMany({
      where: { statut: 'EN_COURS' },
    })

    const locationsCeMois = await db.locationEngin.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    })

    const coutTotalEnCours = locationsEnCours.reduce((sum, loc) => {
      const startDate = new Date(loc.dateDebut)
      const endDate = loc.dateFin ? new Date(loc.dateFin) : now
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      return sum + (loc.coutJournalier * days) + (loc.coutTransport || 0) + (loc.coutOperateur || 0) * days
    }, 0)

    const coutJournalierMoyen = locationsEnCours.length > 0
      ? locationsEnCours.reduce((sum, loc) => sum + (loc.coutJournalier || 0), 0) / locationsEnCours.length
      : 0

    const kpi = {
      locationsEnCours: locationsEnCours.length,
      coutTotalEnCours,
      coutJournalierMoyen,
      locationsCeMois,
    }

    return NextResponse.json({
      locations,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/locations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des locations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      equipementId,
      fournisseurId,
      fournisseurNom,
      fournisseurTel,
      numeroContrat,
      chantierId,
      coutJournalier,
      coutTransport,
      coutOperateur,
      caution,
      dateDebut,
      dateFin,
      statut,
      conditions,
    } = body

    if (!equipementId) {
      return NextResponse.json(
        { error: "L'équipement est requis" },
        { status: 400 }
      )
    }

    if (!dateDebut) {
      return NextResponse.json(
        { error: 'La date de début est requise' },
        { status: 400 }
      )
    }

    if (!coutJournalier || coutJournalier < 0) {
      return NextResponse.json(
        { error: 'Le coût journalier doit être un nombre positif' },
        { status: 400 }
      )
    }

    const location = await db.locationEngin.create({
      data: {
        equipementId,
        fournisseurId: fournisseurId || null,
        fournisseurNom: fournisseurNom?.trim() || null,
        fournisseurTel: fournisseurTel?.trim() || null,
        numeroContrat: numeroContrat?.trim() || null,
        chantierId: chantierId || null,
        coutJournalier: parseFloat(coutJournalier) || 0,
        coutTransport: parseFloat(coutTransport) || 0,
        coutOperateur: parseFloat(coutOperateur) || 0,
        caution: parseFloat(caution) || 0,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        statut: statut || 'EN_COURS',
        conditions: conditions?.trim() || null,
      },
      include: {
        equipement: {
          select: {
            id: true,
            designation: true,
            typeEquipement: true,
          },
        },
        fournisseur: {
          select: {
            id: true,
            raisonSociale: true,
            nom: true,
            prenom: true,
            contact: true,
          },
        },
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
          },
        },
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('POST /api/locations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la location' },
      { status: 500 }
    )
  }
}
