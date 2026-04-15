import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/audit-logs
 * List audit logs with optional filters and pagination.
 * Query params: userId, module, action, page (default 1), limit (default 20)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

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
          }
        : {
            id: log.userId,
            name: 'Utilisateur supprimé',
            email: null,
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
      { error: 'Erreur lors de la récupération des journaux d\'audit' },
      { status: 500 }
    )
  }
}
