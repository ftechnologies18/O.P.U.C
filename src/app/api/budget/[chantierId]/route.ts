import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { format, startOfMonth, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chantierId: string }> }
) {
  try {
    const { chantierId } = await params

    // ─── Fetch chantier ──────────────────────────────────────────────
    const chantier = await db.chantier.findUnique({
      where: { id: chantierId },
    })

    if (!chantier) {
      return NextResponse.json({ error: 'Chantier non trouvé' }, { status: 404 })
    }

    const budgetPrevisionnel = chantier.budgetPrevisionnel || 0

    // ─── 1. Personnel cost ───────────────────────────────────────────
    // SUM(tauxJournalier) from validated pointages where present=true
    const personnelRaw = await db.pointage.aggregate({
      _sum: { tauxJournalier: true },
      where: {
        chantierId,
        present: true,
        valide: true,
      },
    })
    const coutPersonnel = personnelRaw._sum.tauxJournalier || 0

    // ─── 2. Matériaux cost ───────────────────────────────────────────
    // SUM(sorties.quantite × average prixUnitaire from entrees) per material
    const sorties = await db.sortieStock.findMany({
      where: { chantierId },
      select: {
        stockId: true,
        quantite: true,
        dateSortie: true,
      },
    })

    // Pre-fetch ALL entrees for this chantier and build weighted average per stockId
    const allEntrees = await db.entreeStock.findMany({
      where: { chantierId },
      select: { stockId: true, quantite: true, prixUnitaire: true },
    })

    const avgPriceByStock = new Map<string, number>()
    const entreesByStock = new Map<string, typeof allEntrees>()

    for (const e of allEntrees) {
      if (!entreesByStock.has(e.stockId)) {
        entreesByStock.set(e.stockId, [])
      }
      entreesByStock.get(e.stockId)!.push(e)
    }

    for (const [stockId, entries] of entreesByStock) {
      const totalQty = entries.reduce((acc, e) => acc + e.quantite, 0)
      if (totalQty > 0) {
        const weightedAvg =
          entries.reduce((acc, e) => acc + e.quantite * e.prixUnitaire, 0) /
          totalQty
        avgPriceByStock.set(stockId, weightedAvg)
      }
    }

    let coutMateriaux = 0
    const materiauxCostsByDate: { date: Date; montant: number }[] = []

    for (const sortie of sorties) {
      const avgPrice = avgPriceByStock.get(sortie.stockId) || 0
      const cost = sortie.quantite * avgPrice
      coutMateriaux += cost
      materiauxCostsByDate.push({ date: sortie.dateSortie, montant: cost })
    }

    // ─── 3. Sous-traitants cost ──────────────────────────────────────
    // SUM(montantHT) from contrats where statut != 'ANNULE'
    const contrats = await db.contratST.findMany({
      where: { chantierId, statut: { not: 'ANNULE' } },
      select: { createdAt: true, montantHT: true },
      orderBy: { createdAt: 'asc' },
    })

    const coutSousTraitants =
      contrats.reduce((acc, c) => acc + c.montantHT, 0)

    // ─── Totals & ecart ──────────────────────────────────────────────
    const coutTotal = coutPersonnel + coutMateriaux + coutSousTraitants
    const ecart = budgetPrevisionnel - coutTotal
    const ecartPourcentage =
      budgetPrevisionnel > 0 ? (coutTotal / budgetPrevisionnel) * 100 : 0

    // ─── Niveau d'alerte ─────────────────────────────────────────────
    let niveauAlerte: 'OK' | 'ATTENTION' | 'CRITIQUE' = 'OK'
    if (ecartPourcentage >= 100) {
      niveauAlerte = 'CRITIQUE'
    } else if (ecartPourcentage >= 80) {
      niveauAlerte = 'ATTENTION'
    }

    // ─── Historical spending (monthly cumulative) ────────────────────
    const allCosts: { date: Date; montant: number }[] = []

    // Personnel costs by date
    const pointages = await db.pointage.findMany({
      where: { chantierId, present: true, valide: true },
      select: { dateTravail: true, tauxJournalier: true },
      orderBy: { dateTravail: 'asc' },
    })
    for (const p of pointages) {
      allCosts.push({ date: p.dateTravail, montant: p.tauxJournalier })
    }

    // Matériaux costs by date (already computed above)
    allCosts.push(...materiauxCostsByDate)

    // Sous-traitants costs by date
    for (const c of contrats) {
      allCosts.push({ date: c.createdAt, montant: c.montantHT })
    }

    // Sort all costs by date
    allCosts.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Group by month
    const monthlyMap = new Map<string, number>()
    for (const cost of allCosts) {
      const key = format(startOfMonth(cost.date), 'yyyy-MM')
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + cost.montant)
    }

    // Build cumulative history
    const sortedMonths = Array.from(monthlyMap.keys()).sort()
    let cumulative = 0
    const historique = sortedMonths.map((monthKey) => {
      cumulative += monthlyMap.get(monthKey) || 0
      const monthLabel = format(parseISO(monthKey + '-01'), 'MMM yyyy', {
        locale: fr,
      })
      return {
        mois: monthLabel,
        cout: Math.round(cumulative),
      }
    })

    // ─── Repartition for chart & table ───────────────────────────────
    const repartition = [
      {
        categorie: 'Personnel',
        reel: coutPersonnel,
        pourcentage: coutTotal > 0 ? (coutPersonnel / coutTotal) * 100 : 0,
      },
      {
        categorie: 'Matériaux',
        reel: coutMateriaux,
        pourcentage: coutTotal > 0 ? (coutMateriaux / coutTotal) * 100 : 0,
      },
      {
        categorie: 'Sous-traitants',
        reel: coutSousTraitants,
        pourcentage:
          coutTotal > 0 ? (coutSousTraitants / coutTotal) * 100 : 0,
      },
    ]

    return NextResponse.json({
      budgetPrevisionnel,
      coutPersonnel,
      coutMateriaux,
      coutSousTraitants,
      coutTotal,
      ecart,
      ecartPourcentage: Math.round(ecartPourcentage * 10) / 10,
      niveauAlerte,
      historique,
      repartition,
    })
  } catch (error) {
    console.error('Budget API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
