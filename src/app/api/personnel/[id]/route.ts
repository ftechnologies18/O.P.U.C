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
    const {
      nom,
      prenom,
      telephone,
      specialite,
      typeContrat,
      tauxJournalier,
      salaireMensuel,
      dateDebutContrat,
      dateFinContrat,
      statutContrat,
      numeroCNPS,
      nbCongesRestants,
      poste,
      departement,
    } = body

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

    // Validate type de contrat if provided
    if (typeContrat) {
      const validTypes = ['JOURNALIER', 'CDD', 'CDI', 'STAGIAIRE']
      if (!validTypes.includes(typeContrat)) {
        return NextResponse.json(
          { error: 'Type de contrat invalide. Valeurs acceptées : JOURNALIER, CDD, CDI, STAGIAIRE' },
          { status: 400 }
        )
      }
    }

    // Validate tauxJournalier for JOURNALIER type
    if (typeContrat === 'JOURNALIER' && (tauxJournalier === undefined || tauxJournalier === null || tauxJournalier <= 0)) {
      return NextResponse.json(
        { error: 'Le taux journalier est requis pour un journalier' },
        { status: 400 }
      )
    }

    // Validate salaireMensuel for CDD/CDI/STAGIAIRE
    if ((typeContrat === 'CDD' || typeContrat === 'CDI' || typeContrat === 'STAGIAIRE') && (salaireMensuel === undefined || salaireMensuel === null || salaireMensuel <= 0)) {
      return NextResponse.json(
        { error: 'Le salaire mensuel est requis pour ce type de contrat' },
        { status: 400 }
      )
    }

    // Validate statut contrat if provided
    if (statutContrat) {
      const validStatuts = ['ACTIF', 'ESSAI', 'TERMINE', 'SUSPENDU']
      if (!validStatuts.includes(statutContrat)) {
        return NextResponse.json(
          { error: 'Statut de contrat invalide. Valeurs acceptées : ACTIF, ESSAI, TERMINE, SUSPENDU' },
          { status: 400 }
        )
      }
    }

    const journalier = await db.journalier.update({
      where: { id },
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone !== undefined ? (telephone?.trim() || null) : undefined,
        specialite: specialite !== undefined ? (specialite?.trim() || null) : undefined,
        typeContrat: typeContrat || undefined,
        tauxJournalier: tauxJournalier !== undefined ? (tauxJournalier ? Number(tauxJournalier) : null) : undefined,
        salaireMensuel: salaireMensuel !== undefined ? (salaireMensuel ? Number(salaireMensuel) : null) : undefined,
        dateDebutContrat: dateDebutContrat ? new Date(dateDebutContrat) : (dateDebutContrat === null ? null : undefined),
        dateFinContrat: dateFinContrat ? new Date(dateFinContrat) : (dateFinContrat === null ? null : undefined),
        statutContrat: statutContrat || undefined,
        numeroCNPS: numeroCNPS !== undefined ? (numeroCNPS?.trim() || null) : undefined,
        nbCongesRestants: nbCongesRestants !== undefined ? Number(nbCongesRestants) : undefined,
        poste: poste !== undefined ? (poste?.trim() || null) : undefined,
        departement: departement !== undefined ? (departement?.trim() || null) : undefined,
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
