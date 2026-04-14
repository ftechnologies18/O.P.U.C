import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const mois = parseInt(searchParams.get('mois') || String(now.getMonth() + 1), 10)
    const annee = parseInt(searchParams.get('annee') || String(now.getFullYear()), 10)
    const statut = searchParams.get('statut')
    const typeContrat = searchParams.get('typeContrat')
    const search = searchParams.get('search')
    const chantierId = searchParams.get('chantierId')

    // Validate mois and annee
    if (mois < 1 || mois > 12) {
      return NextResponse.json(
        { error: 'Le mois doit être compris entre 1 et 12' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = {
      mois,
      annee,
      journalier: {
        typeContrat: { in: ['CDD', 'CDI', 'STAGIAIRE'] },
        statutContrat: { in: ['ACTIF', 'ESSAI'] },
      },
    }

    // Filter by statut
    if (statut && statut.trim() && statut !== 'TOUS') {
      where.statut = statut.trim()
    }

    // Filter by typeContrat on journalier
    if (typeContrat && typeContrat.trim() && typeContrat !== 'TOUS') {
      ;(where.journalier as Record<string, unknown>).typeContrat = typeContrat.trim()
    }

    // Search by journalier nom/prenom
    if (search && search.trim()) {
      ;(where.journalier as Record<string, unknown>).OR = [
        { nom: { contains: search.trim() } },
        { prenom: { contains: search.trim() } },
      ]
    }

    // Filter by chantierId (journalier must have active affectation to that chantier)
    if (chantierId && chantierId.trim()) {
      where.journalier = {
        ...(where.journalier as Record<string, unknown>),
        affectations: {
          some: {
            chantierId: chantierId.trim(),
            actif: true,
          },
        },
      }
    }

    const salaires = await db.salaireMensuel.findMany({
      where,
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            typeContrat: true,
            poste: true,
            departement: true,
          },
        },
        validePar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        journalier: {
          nom: 'asc',
        },
      },
    })

    // KPI calculations
    const kpiWhere: Record<string, unknown> = {
      mois,
      annee,
      journalier: {
        typeContrat: { in: ['CDD', 'CDI', 'STAGIAIRE'] },
        statutContrat: { in: ['ACTIF', 'ESSAI'] },
      },
    }

    // Apply chantierId filter to KPI as well
    if (chantierId && chantierId.trim()) {
      kpiWhere.journalier = {
        ...(kpiWhere.journalier as Record<string, unknown>),
        affectations: {
          some: {
            chantierId: chantierId.trim(),
            actif: true,
          },
        },
      }
    }

    const [totalSalaires, enAttente, payes, partiel, masseTotale, massePayee] = await Promise.all([
      db.salaireMensuel.count({ where: kpiWhere }),
      db.salaireMensuel.count({ where: { ...kpiWhere, statut: 'EN_ATTENTE' } }),
      db.salaireMensuel.count({ where: { ...kpiWhere, statut: 'PAYE' } }),
      db.salaireMensuel.count({ where: { ...kpiWhere, statut: 'PARTIEL' } }),
      db.salaireMensuel.aggregate({
        where: kpiWhere,
        _sum: { netAPayer: true },
      }),
      db.salaireMensuel.aggregate({
        where: { ...kpiWhere, statut: 'PAYE' },
        _sum: { netAPayer: true },
      }),
    ])

    const kpi = {
      totalSalaires,
      enAttente,
      payes,
      partiel,
      masseTotale: masseTotale._sum.netAPayer || 0,
      massePayee: massePayee._sum.netAPayer || 0,
    }

    return NextResponse.json({
      salaires,
      kpi,
      mois,
      annee,
    })
  } catch (error) {
    console.error('GET /api/salaires error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des salaires' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      journalierId,
      mois,
      annee,
      salaireBase,
      primes,
      heuresSupp,
      montantHeuresSupp,
      retenuesCNPS,
      retenuesIR,
      avances,
      absences,
      retenueAbsences,
      statut,
      datePaiement,
      modePaiement,
      observation,
      valideParId,
    } = body

    // Validate required fields
    if (!journalierId) {
      return NextResponse.json(
        { error: 'Le journalier est requis' },
        { status: 400 }
      )
    }

    if (mois === undefined || mois === null || mois < 1 || mois > 12) {
      return NextResponse.json(
        { error: 'Le mois doit être compris entre 1 et 12' },
        { status: 400 }
      )
    }

    if (!annee || annee < 2000 || annee > 2100) {
      return NextResponse.json(
        { error: "L'année est invalide" },
        { status: 400 }
      )
    }

    if (salaireBase === undefined || salaireBase === null || salaireBase < 0) {
      return NextResponse.json(
        { error: 'Le salaire de base est requis et doit être positif' },
        { status: 400 }
      )
    }

    // Verify journalier exists and is of the right type
    const journalier = await db.journalier.findUnique({
      where: { id: journalierId },
    })

    if (!journalier) {
      return NextResponse.json(
        { error: 'Journalier non trouvé' },
        { status: 404 }
      )
    }

    if (!['CDD', 'CDI', 'STAGIAIRE'].includes(journalier.typeContrat)) {
      return NextResponse.json(
        { error: 'Les salaires mensuels ne sont disponibles que pour les CDD, CDI et stagiaires' },
        { status: 400 }
      )
    }

    // Check uniqueness constraint
    const existing = await db.salaireMensuel.findUnique({
      where: {
        journalierId_mois_annee: {
          journalierId,
          mois,
          annee,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Un salaire existe déjà pour ce journalier ce mois-ci' },
        { status: 409 }
      )
    }

    // Auto-calculate netAPayer
    const netAPayer =
      salaireBase +
      (primes || 0) +
      (montantHeuresSupp || 0) -
      (retenuesCNPS || 0) -
      (retenuesIR || 0) -
      (avances || 0) -
      (retenueAbsences || 0)

    const salaire = await db.salaireMensuel.create({
      data: {
        journalierId,
        mois,
        annee,
        salaireBase,
        primes: primes || 0,
        heuresSupp: heuresSupp || 0,
        montantHeuresSupp: montantHeuresSupp || 0,
        retenuesCNPS: retenuesCNPS || 0,
        retenuesIR: retenuesIR || 0,
        avances: avances || 0,
        absences: absences || 0,
        retenueAbsences: retenueAbsences || 0,
        netAPayer,
        statut: statut || 'EN_ATTENTE',
        datePaiement: datePaiement ? new Date(datePaiement) : null,
        modePaiement: modePaiement || null,
        observation: observation || null,
        valideParId: valideParId || null,
      },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            typeContrat: true,
            poste: true,
            departement: true,
          },
        },
        validePar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(salaire, { status: 201 })
  } catch (error) {
    console.error('POST /api/salaires error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du salaire' },
      { status: 500 }
    )
  }
}
