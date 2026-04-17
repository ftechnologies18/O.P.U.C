import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/audit-logs/stats
 * Returns aggregated statistics for the audit log dashboard.
 * Query params:
 *   - days: number of days to look back (default 30)
 *   - userId, module, action (optional filters matching main endpoint)
 *   - dateFrom, dateTo (optional date range)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30', 10) || 30))
    const userId = searchParams.get('userId')?.trim() || null
    const module_ = searchParams.get('module')?.trim() || null
    const action = searchParams.get('action')?.trim() || null
    const dateFrom = searchParams.get('dateFrom')?.trim() || null
    const dateTo = searchParams.get('dateTo')?.trim() || null

    // Build base where clause
    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId
    if (module_) where.module = module_
    if (action) where.action = action

    // Date range
    const now = new Date()
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const endDate = dateTo ? new Date(dateTo) : now
    if (dateTo) endDate.setHours(23, 59, 59, 999)

    where.createdAt = {
      gte: startDate,
      lte: endDate,
    }

    // Today start for today count
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Total count
    const totalLogs = await db.auditLog.count({ where })

    // Today count (override date range for this specific stat)
    const todayWhere: Record<string, unknown> = { createdAt: { gte: todayStart } }
    if (userId) todayWhere.userId = userId
    const todayLogs = await db.auditLog.count({ where: todayWhere })

    // Active users in last 24h
    const active24hWhere: Record<string, unknown> = { createdAt: { gte: h24ago } }
    if (userId) active24hWhere.userId = userId
    const activeLogs24h = await db.auditLog.findMany({
      where: active24hWhere,
      select: { userId: true },
      distinct: ['userId'],
    })

    // Actions per module
    const moduleStats = await db.auditLog.groupBy({
      by: ['module'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // Actions per day (last N days)
    const dayStats = await db.auditLog.groupBy({
      by: ['createdAt'],
      where,
      _count: { id: true },
      orderBy: { createdAt: 'desc' },
    })

    // Group day stats by date string
    const actionsPerDay: { date: string; count: number }[] = []
    const dayMap = new Map<string, number>()
    for (const stat of dayStats) {
      const dateStr = new Date(stat.createdAt).toISOString().split('T')[0]
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + stat._count.id)
    }
    // Fill missing days
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0]
      actionsPerDay.push({
        date: dateStr,
        count: dayMap.get(dateStr) || 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    // Top users
    const userStats = await db.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    // Fetch user names for top users
    const userIds = userStats.map((s) => s.userId)
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const topUsers = userStats.map((s) => ({
      userId: s.userId,
      name: userMap.get(s.userId)?.name || 'Utilisateur supprimé',
      role: userMap.get(s.userId)?.role || null,
      count: s._count.id,
    }))

    // Actions by type
    const actionStats = await db.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    // Most recent log
    const latestLog = await db.auditLog.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true, module: true, userId: true },
    })

    return NextResponse.json({
      totalLogs,
      todayLogs,
      activeUsers24h: activeLogs24h.length,
      lastAction: latestLog?.createdAt || null,
      lastActionInfo: latestLog
        ? {
            action: latestLog.action,
            module: latestLog.module,
            userId: latestLog.userId,
          }
        : null,
      actionsPerModule: moduleStats.map((m) => ({
        module: m.module,
        count: m._count.id,
      })),
      actionsPerDay,
      topUsers,
      actionsByType: actionStats.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
    })
  } catch (error) {
    console.error('GET /api/audit-logs/stats error:', error)
    return NextResponse.json(
      { error: "Erreur lors du chargement des statistiques" },
      { status: 500 }
    )
  }
}
