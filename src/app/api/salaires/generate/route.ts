import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mois, annee, chantierId } = body

    // Validate required fields
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

    // Find all eligible journaliers (CDD, CDI, STAGIAIRE with ACTIF or ESSAI status)
    const journalierWhere: Record<string, unknown> = {
      typeContrat: { in: ['CDD', 'CDI', 'STAGIAIRE'] },
      statutContrat: { in: ['ACTIF', 'ESSAI'] },
    }

    // Filter by chantierId if provided (journalier must have active affectation)
    if (chantierId && chantierId.trim()) {
      journalierWhere.affectations = {
        some: {
          chantierId: chantierId.trim(),
          actif: true,
        },
      }
    }

    const journaliers = await db.journalier.findMany({
      where: journalierWhere,
      select: {
        id: true,
        nom: true,
        prenom: true,
        salaireMensuel: true,
        typeContrat: true,
        specialite: true,
      },
      orderBy: { nom: 'asc' },
    })

    if (journaliers.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: 0,
        salaires: [],
        message: 'Aucun journalier éligible trouvé pour la génération',
      })
    }

    // Check which salaires already exist
    const existingSalaires = await db.salaireMensuel.findMany({
      where: {
        mois,
        annee,
        journalierId: { in: journaliers.map((j) => j.id) },
      },
      select: {
        journalierId: true,
      },
    })

    const existingIds = new Set(existingSalaires.map((s) => s.journalierId))

    // Create salaires for journaliers that don't have one yet
    const toCreate = journaliers.filter((j) => !existingIds.has(j.id))

    if (toCreate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: journaliers.length,
        salaires: [],
        message: 'Tous les salaires existent déjà pour cette période',
      })
    }

    const createdSalaires = await db.salaireMensuel.createMany({
      data: toCreate.map((j) => ({
        journalierId: j.id,
        mois,
        annee,
        salaireBase: j.salaireMensuel || 0,
        primes: 0,
        heuresSupp: 0,
        montantHeuresSupp: 0,
        retenuesCNPS: 0,
        retenuesIR: 0,
        avances: 0,
        absences: 0,
        retenueAbsences: 0,
        netAPayer: j.salaireMensuel || 0,
        statut: 'EN_ATTENTE',
      })),
    })

    // Fetch the created salaires with relations for the response
    const newSalaires = await db.salaireMensuel.findMany({
      where: {
        mois,
        annee,
        journalierId: { in: toCreate.map((j) => j.id) },
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
      },
      orderBy: {
        journalier: { nom: 'asc' },
      },
    })

    return NextResponse.json({
      created: createdSalaires.count,
      skipped: existingIds.size,
      total: journaliers.length,
      salaires: newSalaires,
    })
  } catch (error) {
    console.error('POST /api/salaires/generate error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des salaires' },
      { status: 500 }
    )
  }
}
