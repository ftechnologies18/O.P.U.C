import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/clients/stats — Client aggregate statistics
// Multi-tenant: filtered by entrepriseId (except SUPER_ADMIN)
// Returns: total, actifs, prospects, inactifs,
//          top clients by revenue, most chantiers, recent activity
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    // Build the base where clause — tenant-scoped for non-super-admin
    const baseWhere: Record<string, unknown> = {}
    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      baseWhere.entrepriseId = ctx.entrepriseId
    }

    // Run all stats queries in parallel
    const [
      totalClients,
      actifs,
      prospects,
      inactifs,
      topByRevenue,
      topByChantiers,
      recentClients,
      revenueByType,
    ] = await Promise.all([
      // Total clients
      db.client.count({ where: baseWhere }),

      // Active clients
      db.client.count({ where: { ...baseWhere, statut: 'ACTIF' } }),

      // Prospect clients
      db.client.count({ where: { ...baseWhere, statut: 'PROSPECT' } }),

      // Inactive clients
      db.client.count({ where: { ...baseWhere, statut: 'INACTIF' } }),

      // Top clients by revenue (sum of paid factures totalTTC)
      db.client.findMany({
        where: baseWhere,
        select: {
          id: true,
          raisonSociale: true,
          type: true,
          statut: true,
          factures: {
            where: { statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] } },
            select: { totalTTC: true, montantPaye: true },
          },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }).then((clients) =>
        clients
          .map((client) => {
            const totalRevenue = client.factures.reduce(
              (sum, f) => sum + (f.totalTTC || 0),
              0
            )
            const totalPaid = client.factures.reduce(
              (sum, f) => sum + (f.montantPaye || 0),
              0
            )
            return {
              id: client.id,
              raisonSociale: client.raisonSociale,
              type: client.type,
              statut: client.statut,
              totalRevenue,
              totalPaid,
              factureCount: client.factures.length,
            }
          })
          .sort((a, b) => b.totalPaid - a.totalPaid)
          .slice(0, 5)
      ),

      // Clients with most chantiers
      db.client.findMany({
        where: baseWhere,
        select: {
          id: true,
          raisonSociale: true,
          type: true,
          statut: true,
          _count: {
            select: { chantiers: true },
          },
        },
        take: 5,
        orderBy: { chantiers: { _count: 'desc' } },
      }),

      // Recent activity (last 5 created clients)
      db.client.findMany({
        where: baseWhere,
        select: {
          id: true,
          raisonSociale: true,
          type: true,
          statut: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Revenue breakdown by client type
      db.client.findMany({
        where: baseWhere,
        select: {
          type: true,
          factures: {
            where: { statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] } },
            select: { totalTTC: true, montantPaye: true },
          },
        },
      }).then((clients) => {
        const breakdown: Record<string, { count: number; revenue: number; paid: number }> = {
          ENTREPRISE: { count: 0, revenue: 0, paid: 0 },
          PARTICULIER: { count: 0, revenue: 0, paid: 0 },
          INSTITUTION: { count: 0, revenue: 0, paid: 0 },
        }
        for (const client of clients) {
          if (!breakdown[client.type]) continue
          breakdown[client.type].count++
          for (const f of client.factures) {
            breakdown[client.type].revenue += f.totalTTC || 0
            breakdown[client.type].paid += f.montantPaye || 0
          }
        }
        return breakdown
      }),
    ])

    // Total revenue across all clients
    const totalRevenueData = await db.facture.aggregate({
      where: {
        ...(baseWhere.entrepriseId ? { entrepriseId: baseWhere.entrepriseId as string } : {}),
        statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
      },
      _sum: { totalTTC: true, montantPaye: true },
    })

    return NextResponse.json({
      summary: {
        total: totalClients,
        actifs,
        prospects,
        inactifs,
      },
      revenue: {
        totalFactured: totalRevenueData._sum.totalTTC || 0,
        totalPaid: totalRevenueData._sum.montantPaye || 0,
        outstanding: (totalRevenueData._sum.totalTTC || 0) - (totalRevenueData._sum.montantPaye || 0),
        byType: revenueByType,
      },
      topClients: topByRevenue.map((c) => ({
        id: c.id,
        raisonSociale: c.raisonSociale,
        type: c.type,
        totalPaid: c.totalPaid,
        totalRevenue: c.totalRevenue,
        factureCount: c.factureCount,
      })),
      topByChantiers: topByChantiers.map((c) => ({
        id: c.id,
        raisonSociale: c.raisonSociale,
        type: c.type,
        chantierCount: c._count.chantiers,
      })),
      recentActivity: recentClients,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/clients/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques clients' },
      { status: 500 }
    )
  }
}
