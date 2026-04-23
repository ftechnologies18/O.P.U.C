import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTenantContext } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/support/stats — Support ticket statistics
// Multi-tenant: all stats scoped to entrepriseId from session
//
// Returns:
//   - total: total ticket count
//   - byStatut: { OUVERT, EN_COURS, RESOLU, FERME }
//   - byPriorite: { BASSE, MOYENNE, HAUTE, URGENTE }
//   - avgResolutionTimeMs: average resolution time in milliseconds
//   - avgResolutionTimeHours: same in hours (float)
//   - topAssignee: { id, name, resolvedCount } — user with most resolved tickets
//   - openTickets: count of tickets with statut = OUVERT
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantContext(request)

    const where = { entrepriseId: ctx.entrepriseId }

    // Run all independent queries in parallel
    const [
      total,
      ouvertCount,
      enCoursCount,
      resoluCount,
      fermeCount,
      basseCount,
      moyenneCount,
      hauteCount,
      urgenteCount,
      resolvedTickets,
      topAssigneeResult,
    ] = await Promise.all([
      // Total tickets
      db.ticketSupport.count({ where }),

      // By status
      db.ticketSupport.count({ where: { ...where, statut: 'OUVERT' } }),
      db.ticketSupport.count({ where: { ...where, statut: 'EN_COURS' } }),
      db.ticketSupport.count({ where: { ...where, statut: 'RESOLU' } }),
      db.ticketSupport.count({ where: { ...where, statut: 'FERME' } }),

      // By priority
      db.ticketSupport.count({ where: { ...where, priorite: 'BASSE' } }),
      db.ticketSupport.count({ where: { ...where, priorite: 'MOYENNE' } }),
      db.ticketSupport.count({ where: { ...where, priorite: 'HAUTE' } }),
      db.ticketSupport.count({ where: { ...where, priorite: 'URGENTE' } }),

      // Resolved tickets with resolution time data
      db.ticketSupport.findMany({
        where: {
          ...where,
          statut: 'RESOLU',
          resoluLe: { not: null },
        },
        select: {
          createdAt: true,
          resoluLe: true,
          resoluParId: true,
        },
      }),

      // Top assignee by resolved tickets
      db.ticketSupport.groupBy({
        by: ['assigneAId'],
        where: {
          ...where,
          statut: 'RESOLU',
          assigneAId: { not: null },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      }),
    ])

    // Calculate average resolution time
    let avgResolutionTimeMs = 0
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime()
        const resolved = new Date(t.resoluLe!).getTime()
        return sum + (resolved - created)
      }, 0)
      avgResolutionTimeMs = Math.round(totalMs / resolvedTickets.length)
    }

    const avgResolutionTimeHours = Math.round(
      (avgResolutionTimeMs / (1000 * 60 * 60)) * 100
    ) / 100

    // Get top assignee details
    let topAssignee = null
    if (topAssigneeResult.length > 0 && topAssigneeResult[0].assigneAId) {
      const assignee = await db.user.findUnique({
        where: { id: topAssigneeResult[0].assigneAId },
        select: { id: true, name: true },
      })
      if (assignee) {
        topAssignee = {
          id: assignee.id,
          name: assignee.name,
          resolvedCount: topAssigneeResult[0]._count.id,
        }
      }
    }

    return NextResponse.json({
      total,
      byStatut: {
        OUVERT: ouvertCount,
        EN_COURS: enCoursCount,
        RESOLU: resoluCount,
        FERME: fermeCount,
      },
      byPriorite: {
        BASSE: basseCount,
        MOYENNE: moyenneCount,
        HAUTE: hauteCount,
        URGENTE: urgenteCount,
      },
      avgResolutionTimeMs,
      avgResolutionTimeHours,
      topAssignee,
      openTickets: ouvertCount,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/support/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
