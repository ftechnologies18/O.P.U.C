import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'

/**
 * GET /api/audit-logs
 * List audit logs with optional filters and pagination.
 * Query params:
 *   - userId, module, action, entityType
 *   - dateFrom, dateTo (ISO date strings)
 *   - search (text search in details)
 *   - page (default 1), limit (default 20, max 500 for CSV export)
 *   - export = 'csv' to return all matching logs without pagination
 * Includes utilisateur name. Ordered by createdAt desc.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')?.trim() || null
    const module_ = searchParams.get('module')?.trim() || null
    const action = searchParams.get('action')?.trim() || null
    const entityType = searchParams.get('entityType')?.trim() || null
    const dateFrom = searchParams.get('dateFrom')?.trim() || null
    const dateTo = searchParams.get('dateTo')?.trim() || null
    const search = searchParams.get('search')?.trim() || null
    const isExport = searchParams.get('export') === 'csv'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(isExport ? 500 : 100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    // Build the where clause
    const where: Record<string, unknown> = {}

    if (userId) {
      where.userId = userId
    }

    if (module_) {
      where.module = module_
    }

    if (action) {
      where.action = action
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom)
      }
      if (dateTo) {
        // Set end of day for dateTo
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        dateFilter.lte = endDate
      }
      where.createdAt = dateFilter
    }

    if (search) {
      where.details = { contains: search }
    }

    // CSV Export mode — return all matching logs (no pagination)
    if (isExport) {
      const logs = await db.auditLog.findMany({
        where,
        include: {
          utilisateur: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      const mappedLogs = logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        utilisateur: log.utilisateur
          ? {
              id: log.utilisateur.id,
              name: log.utilisateur.name,
              email: log.utilisateur.email,
              role: log.utilisateur.role,
            }
          : {
              id: log.userId,
              name: 'Utilisateur supprimé',
              email: null,
              role: null,
            },
        entrepriseId: log.entrepriseId,
        action: log.action,
        module: log.module,
        entityId: log.entityId,
        entityType: log.entityType,
        details: log.details,
        adresseIp: log.adresseIp,
        createdAt: log.createdAt,
      }))

      return NextResponse.json({
        logs: mappedLogs,
        pagination: {
          page: 1,
          limit: mappedLogs.length,
          total: mappedLogs.length,
          totalPages: 1,
        },
      })
    }

    // Get total count for pagination
    const total = await db.auditLog.count({ where })

    // Fetch paginated results with utilisateur relation
    const logs = await db.auditLog.findMany({
      where,
      include: {
        utilisateur: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Map logs to include utilisateur info safely (handle deleted users)
    const mappedLogs = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      utilisateur: log.utilisateur
        ? {
            id: log.utilisateur.id,
            name: log.utilisateur.name,
            email: log.utilisateur.email,
            role: log.utilisateur.role,
          }
        : {
            id: log.userId,
            name: 'Utilisateur supprimé',
            email: null,
            role: null,
          },
      entrepriseId: log.entrepriseId,
      action: log.action,
      module: log.module,
      entityId: log.entityId,
      entityType: log.entityType,
      details: log.details,
      adresseIp: log.adresseIp,
      createdAt: log.createdAt,
    }))

    return NextResponse.json({
      logs: mappedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/audit-logs error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des journaux d'audit" },
      { status: 500 }
    )
  }
}
