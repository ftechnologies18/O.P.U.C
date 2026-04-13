import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Count active chantiers
    const chantiersActifs = await db.chantier.count({
      where: { statut: 'EN_COURS' },
    })

    // Count workers currently assigned
    const journaliersSurSite = await db.journalierAffectation.count({
      where: { actif: true },
    })

    // Count today's pointages
    const pointagesAujourdhui = await db.pointage.count({
      where: {
        dateTravail: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // Count tasks en retard
    const tachesEnRetard = await db.tache.count({
      where: { statut: 'EN_RETARD' },
    })

    // Count unread notifications for this user
    const unreadNotifications = await db.notification.count({
      where: { userId, lu: false },
    })

    // Count stock alerts (materials below seuilAlerte)
    const allStockItems = await db.stockMateriel.findMany({
      select: {
        id: true,
        reference: true,
        designation: true,
        categorie: true,
        unite: true,
        seuilAlerte: true,
        chantierId: true,
        chantier: { select: { nom: true } },
        entrees: { select: { quantite: true } },
        sorties: { select: { quantite: true } },
      },
    })

    const stockAlerts = allStockItems
      .map((item) => {
        const totalEntrees = item.entrees.reduce((sum, e) => sum + e.quantite, 0)
        const totalSorties = item.sorties.reduce((sum, s) => sum + s.quantite, 0)
        const quantiteDisponible = totalEntrees - totalSorties
        return {
          ...item,
          quantiteDisponible,
          entrees: undefined,
          sorties: undefined,
        }
      })
      .filter((item) => item.quantiteDisponible <= item.seuilAlerte && item.seuilAlerte > 0)

    const alertesActives = unreadNotifications + stockAlerts.length

    // Budget data for chart — for each chantier, calculate real budget
    const chantiers = await db.chantier.findMany({
      select: {
        id: true,
        nom: true,
        budgetPrevisionnel: true,
        statut: true,
      },
    })

    const budgetData = await Promise.all(
      chantiers.map(async (c) => {
        // Personnel cost: sum of tauxJournalier from validated pointages where present=true
        const personnelResult = await db.pointage.aggregate({
          _sum: { tauxJournalier: true },
          where: {
            chantierId: c.id,
            present: true,
            valide: true,
          },
        })
        const personnelCost = personnelResult._sum.tauxJournalier || 0

        // Matériaux cost: sum of sorties with weighted average prix from entrees
        const sorties = await db.sortieStock.findMany({
          where: { chantierId: c.id },
          select: { stockId: true, quantite: true },
        })

        let materiauxCost = 0
        if (sorties.length > 0) {
          const stockIds = [...new Set(sorties.map((s) => s.stockId))]
          const entreesByStock = await db.entreeStock.groupBy({
            by: ['stockId'],
            where: { stockId: { in: stockIds } },
            _sum: { quantite: true, prixUnitaire: true },
          })

          const weightedAvgMap = new Map<string, number>()
          for (const entry of entreesByStock) {
            const totalEntreesForStock = await db.entreeStock.aggregate({
              _sum: { quantite: true },
              where: { stockId: entry.stockId },
            })
            const totalQty = totalEntreesForStock._sum.quantite || 0
            if (totalQty > 0) {
              // Weighted average: Σ(qty * price) / Σ(qty)
              const allEntrees = await db.entreeStock.findMany({
                where: { stockId: entry.stockId },
                select: { quantite: true, prixUnitaire: true },
              })
              const weightedSum = allEntrees.reduce((s, e) => s + e.quantite * e.prixUnitaire, 0)
              weightedAvgMap.set(entry.stockId, weightedSum / totalQty)
            }
          }

          for (const sortie of sorties) {
            const avgPrice = weightedAvgMap.get(sortie.stockId) || 0
            materiauxCost += sortie.quantite * avgPrice
          }
        }

        // Sous-traitants cost: sum of montantHT from non-cancelled contrats
        const stResult = await db.contratST.aggregate({
          _sum: { montantHT: true },
          where: {
            chantierId: c.id,
            statut: { not: 'ANNULE' },
          },
        })
        const stCost = stResult._sum.montantHT || 0

        const budgetReel = personnelCost + materiauxCost + stCost

        return {
          chantierId: c.id,
          nom: c.nom,
          budgetPrevisionnel: c.budgetPrevisionnel,
          budgetReel,
          personnelCost,
          materiauxCost,
          stCost,
        }
      })
    )

    // Phase progress data — for the first active chantier
    const activeChantier = chantiers.find((c) => c.statut === 'EN_COURS') || chantiers[0]
    const phasesProgress = activeChantier
      ? await db.phase.findMany({
          where: { chantierId: activeChantier.id },
          select: { nom: true, avancement: true, ordre: true },
          orderBy: { ordre: 'asc' },
          take: 6,
        })
      : []

    const activeChantierNom = activeChantier?.nom || ''

    // Recent notifications
    const recentNotifications = await db.notification.findMany({
      where: { userId },
      select: { id: true, titre: true, message: true, type: true, lu: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Tasks en retard details (latest 5)
    const tachesEnRetardDetails = await db.tache.findMany({
      where: { statut: 'EN_RETARD' },
      select: {
        id: true,
        nom: true,
        dateFin: true,
        avancement: true,
        phase: { select: { nom: true, chantier: { select: { nom: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      chantiersActifs,
      journaliersSurSite,
      pointagesAujourdhui,
      alertesActives,
      tachesEnRetard,
      chantiers,
      budgetData,
      phasesProgress,
      activeChantierNom,
      recentNotifications,
      stockAlerts,
      tachesEnRetardDetails,
      userName: session.user.name,
      userRole: (session.user as { role: string }).role,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
