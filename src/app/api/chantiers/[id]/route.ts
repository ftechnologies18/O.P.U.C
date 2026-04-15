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
        entreprise: {
          select: { id: true, nom: true, telephone: true, email: true },
        },
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
        journaliers: {
          where: { actif: true },
          include: {
            journalier: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                specialite: true,
                telephone: true,
              },
            },
          },
        },
        equipements: {
          include: {
            equipement: {
              select: {
                id: true,
                designation: true,
                immatriculation: true,
                etat: true,
              },
            },
          },
        },
        _count: {
          select: {
            phases: true,
            journaliers: true,
            pointages: true,
            photos: true,
            rapports: true,
            contratsST: true,
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

    // Compute avancementGlobal from phases
    const avancementGlobal =
      chantier.phases.length > 0
        ? Math.round(
            chantier.phases.reduce((sum, p) => sum + p.avancement, 0) /
              chantier.phases.length
          )
        : 0

    // Compute financial data
    const [budgetReelResult, coutPersonnelResult, coutSousTraitantsResult] =
      await Promise.all([
        // Budget réel = sum of validated pointage amounts
        db.pointage.aggregate({
          _sum: { tauxJournalier: true },
          where: {
            chantierId: id,
            present: true,
            valide: true,
          },
        }),
        // Coût personnel = same as budget reel for pointages
        db.pointage.aggregate({
          _sum: { tauxJournalier: true },
          where: {
            chantierId: id,
            present: true,
            valide: true,
          },
        }),
        // Coût sous-traitants = sum of ContratST amounts (excluding cancelled)
        db.contratST.aggregate({
          _sum: { montantHT: true },
          where: {
            chantierId: id,
            statut: { not: 'ANNULE' },
          },
        }),
      ])

    // Build response with computed fields
    const response = {
      ...chantier,
      avancementGlobal,
      budgetReel: budgetReelResult._sum.tauxJournalier || 0,
      coutPersonnel: coutPersonnelResult._sum.tauxJournalier || 0,
      coutSousTraitants: coutSousTraitantsResult._sum.montantHT || 0,
    }

    return NextResponse.json(response)
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
    const { nom, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, description, statut, modeCarburant } = body

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
        modeCarburant: modeCarburant || undefined,
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
