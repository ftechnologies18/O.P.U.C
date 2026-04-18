import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/entreprises/[id]/stats — Enterprise Statistics
// SUPER_ADMIN or GERANT of that entreprise
// Returns: userCount, chantierCount, journalierCount,
//           pointagesThisMonth, budgetTotal, etc.
// ═══════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    // Only SUPER_ADMIN or GERANT of the entreprise can view stats
    if (!ctx.isSuperAdmin && ctx.entrepriseId !== id) {
      return NextResponse.json(
        { error: 'Accès refusé.' },
        { status: 403 }
      )
    }

    const entreprise = await db.entreprise.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        status: true,
        createdAt: true,
      },
    })

    if (!entreprise) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée.' },
        { status: 404 }
      )
    }

    // Current month boundaries
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Run all stats queries in parallel
    const [
      userCount,
      activeUserCount,
      chantierCount,
      activeChantierCount,
      journalierCount,
      activeJournalierCount,
      pointagesThisMonth,
      totalBudget,
      equipementCount,
      sousTraitantCount,
      rapportsThisMonth,
      documentsCount,
    ] = await Promise.all([
      // Total users
      db.user.count({
        where: { entrepriseId: id },
      }),

      // Active users
      db.user.count({
        where: { entrepriseId: id, active: true },
      }),

      // Total chantiers
      db.chantier.count({
        where: { entrepriseId: id },
      }),

      // Active chantiers (not TERMINE or RECEPTIONNE)
      db.chantier.count({
        where: {
          entrepriseId: id,
          statut: { in: ['EN_PREPARATION', 'EN_COURS', 'EN_PAUSE'] },
        },
      }),

      // Total journaliers
      db.journalier.count({
        where: { entrepriseId: id },
      }),

      // Active journaliers
      db.journalier.count({
        where: { entrepriseId: id, statutContrat: 'ACTIF' },
      }),

      // Pointages this month
      db.pointage.count({
        where: {
          chantier: { entrepriseId: id },
          dateTravail: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),

      // Total budget across all chantiers
      db.chantier.aggregate({
        where: { entrepriseId: id },
        _sum: { budgetPrevisionnel: true },
      }),

      // Equipement count
      db.equipement.count({
        where: { entrepriseId: id },
      }),

      // Sous-traitant count
      db.sousTraitant.count({
        where: { entrepriseId: id },
      }),

      // Rapports this month
      db.rapportJournalier.count({
        where: {
          chantier: { entrepriseId: id },
          dateRapport: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),

      // Total documents
      db.documentChantier.count({
        where: {
          chantier: { entrepriseId: id },
        },
      }),
    ])

    // Calculate pointages amount this month
    const pointagesAmountThisMonth = await db.pointage.aggregate({
      where: {
        chantier: { entrepriseId: id },
        dateTravail: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        present: true,
      },
      _sum: { tauxJournalier: true },
    })

    return NextResponse.json({
      entreprise: {
        id: entreprise.id,
        nom: entreprise.nom,
        status: entreprise.status,
        createdAt: entreprise.createdAt,
      },
      stats: {
        users: {
          total: userCount,
          active: activeUserCount,
          inactive: userCount - activeUserCount,
        },
        chantiers: {
          total: chantierCount,
          active: activeChantierCount,
          completed: chantierCount - activeChantierCount,
        },
        journaliers: {
          total: journalierCount,
          active: activeJournalierCount,
        },
        equipements: {
          total: equipementCount,
        },
        sousTraitants: {
          total: sousTraitantCount,
        },
        documents: {
          total: documentsCount,
        },
        thisMonth: {
          pointages: pointagesThisMonth,
          pointagesAmount: pointagesAmountThisMonth._sum.tauxJournalier || 0,
          rapports: rapportsThisMonth,
        },
        budget: {
          total: totalBudget._sum.budgetPrevisionnel || 0,
        },
      },
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/entreprises/[id]/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
