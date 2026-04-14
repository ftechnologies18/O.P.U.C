import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Specialty phase groups
const GROS_OEUVRE_SPECIALTIES = [
  'Terrassier',
  'Canalisateur VRD',
  'Maçon',
  'Coffreur-bancheur',
  'Ferrailleur',
  "Monteur d'échafaudages",
  'Grutier',
]

const ENVELOPPE_SPECIALTIES = [
  'Charpentier',
  'Couvreur / Zingueur',
  'Étancheur',
  'Étancheur',
  'Menuisier extérieur',
  'Façadier / Bardeur',
]

const SECOND_OEUVRE_SPECIALTIES = [
  'Isolation',
  'Plâtrier',
  'Plombier',
  'CVC',
  'Électricien',
  'Electricien',
  'Menuisier intérieur',
  'Carreleur',
  'Peintre',
  'Agenceur',
]

function isSpecialtyInGroup(specialty: string | null, group: string[]): boolean {
  if (!specialty) return false
  const trimmed = specialty.trim()
  return group.some(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const specialite = searchParams.get('specialite')
    const phaseFilter = searchParams.get('phase')
    const chantierId = searchParams.get('chantierId')
    const specialites = searchParams.getAll('specialites') // array of specialty values for phase filter
    const typeContrat = searchParams.get('typeContrat')

    const where: Record<string, unknown> = {}

    if (search && search.trim()) {
      where.OR = [
        { nom: { contains: search.trim() } },
        { prenom: { contains: search.trim() } },
        { telephone: { contains: search.trim() } },
      ]
    }

    // Single specialty filter
    if (specialite && specialite.trim() && specialite !== 'TOUS') {
      where.specialite = specialite.trim()
    }
    // Phase-based specialty filter (multiple specialties via specialites param)
    else if (specialites && specialites.length > 0) {
      where.specialite = { in: specialites }
    }

    // Filter by type de contrat
    if (typeContrat && typeContrat.trim() && typeContrat.trim() !== 'TOUS') {
      where.typeContrat = typeContrat.trim()
    }

    // Filter by chantier assignment
    if (chantierId && chantierId.trim()) {
      where.affectations = {
        some: {
          chantierId: chantierId.trim(),
          actif: true,
        },
      }
    }

    const journaliers = await db.journalier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        affectations: {
          where: { actif: true },
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
              },
            },
          },
          orderBy: { dateDebut: 'desc' },
        },
      },
    })

    // KPI stats
    const allJournaliers = await db.journalier.findMany()

    let grosOeuvre = 0
    let enveloppe = 0
    let secondOeuvre = 0
    let nonAffecte = 0

    for (const j of allJournaliers) {
      if (isSpecialtyInGroup(j.specialite, GROS_OEUVRE_SPECIALTIES)) {
        grosOeuvre++
      } else if (isSpecialtyInGroup(j.specialite, ENVELOPPE_SPECIALTIES)) {
        enveloppe++
      } else if (isSpecialtyInGroup(j.specialite, SECOND_OEUVRE_SPECIALTIES)) {
        secondOeuvre++
      } else {
        nonAffecte++
      }
    }

    // Counts by type de contrat
    let countJournaliers = 0
    let countCdd = 0
    let countCdi = 0
    let countStagiaires = 0

    for (const j of allJournaliers) {
      switch (j.typeContrat) {
        case 'CDD':
          countCdd++
          break
        case 'CDI':
          countCdi++
          break
        case 'STAGIAIRE':
          countStagiaires++
          break
        default:
          countJournaliers++
          break
      }
    }

    const kpi = {
      total: allJournaliers.length,
      grosOeuvre,
      enveloppe,
      secondOeuvre,
      nonAffecte,
      journaliers: countJournaliers,
      cdd: countCdd,
      cdi: countCdi,
      stagiaires: countStagiaires,
    }

    return NextResponse.json({
      journaliers,
      kpi,
    })
  } catch (error) {
    console.error('GET /api/personnel error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du personnel' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Validate type de contrat
    const contratType = typeContrat || 'JOURNALIER'
    const validTypes = ['JOURNALIER', 'CDD', 'CDI', 'STAGIAIRE']
    if (!validTypes.includes(contratType)) {
      return NextResponse.json(
        { error: 'Type de contrat invalide. Valeurs acceptées : JOURNALIER, CDD, CDI, STAGIAIRE' },
        { status: 400 }
      )
    }

    // JOURNALIER must have tauxJournalier
    if (contratType === 'JOURNALIER' && (tauxJournalier === undefined || tauxJournalier === null || tauxJournalier <= 0)) {
      return NextResponse.json(
        { error: 'Le taux journalier est requis pour un journalier' },
        { status: 400 }
      )
    }

    // CDD/CDI/STAGIAIRE must have salaireMensuel
    if ((contratType === 'CDD' || contratType === 'CDI' || contratType === 'STAGIAIRE') && (salaireMensuel === undefined || salaireMensuel === null || salaireMensuel <= 0)) {
      return NextResponse.json(
        { error: 'Le salaire mensuel est requis pour ce type de contrat' },
        { status: 400 }
      )
    }

    // Validate statut contrat
    const validStatuts = ['ACTIF', 'ESSAI', 'TERMINE', 'SUSPENDU']
    if (statutContrat && !validStatuts.includes(statutContrat)) {
      return NextResponse.json(
        { error: 'Statut de contrat invalide. Valeurs acceptées : ACTIF, ESSAI, TERMINE, SUSPENDU' },
        { status: 400 }
      )
    }

    const journalier = await db.journalier.create({
      data: {
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone?.trim() || null,
        specialite: specialite?.trim() || null,
        typeContrat: contratType,
        tauxJournalier: tauxJournalier ? Number(tauxJournalier) : null,
        salaireMensuel: salaireMensuel ? Number(salaireMensuel) : null,
        dateDebutContrat: dateDebutContrat ? new Date(dateDebutContrat) : null,
        dateFinContrat: dateFinContrat ? new Date(dateFinContrat) : null,
        statutContrat: statutContrat || 'ACTIF',
        numeroCNPS: numeroCNPS?.trim() || null,
        nbCongesRestants: nbCongesRestants !== undefined ? Number(nbCongesRestants) : 0,
        poste: poste?.trim() || null,
        departement: departement?.trim() || null,
      },
    })

    return NextResponse.json(journalier, { status: 201 })
  } catch (error) {
    console.error('POST /api/personnel error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du journalier' },
      { status: 500 }
    )
  }
}
