import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireTenantContext, AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/facturation/stats — Invoice statistics dashboard
// Returns aggregate stats for the tenant's factures
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const entrepriseId = ctx.entrepriseId!

    // ─── 1. Overall totals ───────────────────────────────────
    // Total facturé = sum totalTTC of all non-ANNULEE factures
    const totalFactureAgg = await db.facture.aggregate({
      where: {
        entrepriseId,
        statut: { not: 'ANNULEE' },
      },
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
    })

    const totalFacture = totalFactureAgg._sum.totalTTC ?? 0
    const totalEncaisse = totalFactureAgg._sum.montantPaye ?? 0
    const totalRestant = totalFacture - totalEncaisse
    const nombreFactures = totalFactureAgg._count

    // ─── 2. Factures en retard ──────────────────────────────
    const enRetardAgg = await db.facture.aggregate({
      where: {
        entrepriseId,
        statut: 'EN_RETARD',
      },
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
    })

    const facturesEnRetard = {
      nombre: enRetardAgg._count,
      montantTotal: enRetardAgg._sum.totalTTC ?? 0,
      montantPaye: enRetardAgg._sum.montantPaye ?? 0,
      montantImpaye: (enRetardAgg._sum.totalTTC ?? 0) - (enRetardAgg._sum.montantPaye ?? 0),
    }

    // ─── 3. By status breakdown ─────────────────────────────
    const byStatus = await db.facture.groupBy({
      by: ['statut'],
      where: { entrepriseId },
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
    })

    const repartitionStatut = byStatus.map((item) => ({
      statut: item.statut,
      nombre: item._count,
      montantTotal: item._sum.totalTTC ?? 0,
      montantPaye: item._sum.montantPaye ?? 0,
    }))

    // ─── 4. By type breakdown ───────────────────────────────
    const byType = await db.facture.groupBy({
      by: ['typeFacture'],
      where: {
        entrepriseId,
        statut: { not: 'ANNULEE' },
      },
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
    })

    const repartitionType = byType.map((item) => ({
      type: item.typeFacture,
      nombre: item._count,
      montantTotal: item._sum.totalTTC ?? 0,
      montantPaye: item._sum.montantPaye ?? 0,
    }))

    // ─── 5. Top 5 clients by facture amount ─────────────────
    const topClients = await db.facture.groupBy({
      by: ['clientId'],
      where: {
        entrepriseId,
        statut: { not: 'ANNULEE' },
      },
      _sum: { totalTTC: true, montantPaye: true },
      _count: true,
      orderBy: { _sum: { totalTTC: 'desc' } },
      take: 5,
    })

    const topClientsData = await Promise.all(
      topClients.map(async (item) => {
        const client = await db.client.findUnique({
          where: { id: item.clientId },
          select: { id: true, raisonSociale: true },
        })
        return {
          client: client ? { id: client.id, raisonSociale: client.raisonSociale } : null,
          nombreFactures: item._count,
          montantTotal: item._sum.totalTTC ?? 0,
          montantPaye: item._sum.montantPaye ?? 0,
        }
      })
    )

    // ─── 6. Monthly breakdown for last 6 months ─────────────
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthlyFactures = await db.facture.findMany({
      where: {
        entrepriseId,
        dateEmission: {
          gte: sixMonthsAgo,
          lt: new Date(currentMonthStart.getTime() + 32 * 24 * 60 * 60 * 1000), // include current month
        },
        statut: { not: 'ANNULEE' },
      },
      select: {
        dateEmission: true,
        totalTTC: true,
        montantPaye: true,
        statut: true,
      },
      orderBy: { dateEmission: 'asc' },
    })

    // Group by month
    const monthlyMap = new Map<string, {
      mois: string
      nombre: number
      facture: number
      encaisse: number
      impaye: number
    }>()

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      monthlyMap.set(key, {
        mois: monthLabel,
        nombre: 0,
        facture: 0,
        encaisse: 0,
        impaye: 0,
      })
    }

    // Aggregate factures into months
    for (const f of monthlyFactures) {
      const key = `${f.dateEmission.getFullYear()}-${String(f.dateEmission.getMonth() + 1).padStart(2, '0')}`
      const entry = monthlyMap.get(key)
      if (entry) {
        entry.nombre += 1
        entry.facture += f.totalTTC
        entry.encaisse += f.montantPaye
        entry.impaye += f.totalTTC - f.montantPaye
      }
    }

    const mensuel = Array.from(monthlyMap.values())

    return NextResponse.json({
      general: {
        totalFacture,
        totalEncaisse,
        totalRestant,
        nombreFactures,
        tauxRecouvrement: totalFacture > 0 ? Math.round((totalEncaisse / totalFacture) * 100) : 0,
      },
      facturesEnRetard,
      repartitionStatut,
      repartitionType,
      topClients: topClientsData,
      mensuel,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/facturation/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
