import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Valid permission levels
const VALID_LEVELS = ['AUCUN', 'LECTURE', 'ECRITURE', 'GESTION'] as const

// Valid roles in the system (4-role architecture)
const VALID_ROLES = ['SUPER_ADMIN', 'GERANT', 'CHEF_PROJET', 'SOUS_TRAITANT'] as const

/**
 * GET /api/permissions
 * Get all permission configs. Returns an object keyed by role.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const configs = await db.permissionConfig.findMany({
      orderBy: { role: 'asc' },
    })

    // Build the result keyed by role, parsing the JSON permissions field
    const result: Record<string, Record<string, string>> = {}

    for (const config of configs) {
      try {
        const parsed = JSON.parse(config.permissions || '{}')
        result[config.role] = parsed
      } catch {
        result[config.role] = {}
      }
    }

    return NextResponse.json({ permissions: result })
  } catch (error) {
    console.error('GET /api/permissions error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des permissions' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/permissions
 * Save permission configs. Only ADMIN can modify.
 * Body: { permissions: Record<string, Record<string, string>> }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Only GERANT+ can modify permissions
    const userRole = (session.user as { role: string }).role
    if (userRole !== 'GERANT' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Accès refusé. Seul un administrateur peut modifier les permissions.' },
        { status: 403 }
      )
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { permissions } = body

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Le champ "permissions" est requis et doit être un objet' },
        { status: 400 }
      )
    }

    // Validate roles and permission levels
    const roles = Object.keys(permissions)
    if (roles.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un rôle doit être spécifié' },
        { status: 400 }
      )
    }

    for (const role of roles) {
      if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
        return NextResponse.json(
          { error: `Rôle invalide: "${role}". Rôles acceptés: ${VALID_ROLES.join(', ')}` },
          { status: 400 }
        )
      }

      const modules = permissions[role]
      if (typeof modules !== 'object' || modules === null || Array.isArray(modules)) {
        return NextResponse.json(
          { error: `Les permissions pour le rôle "${role}" doivent être un objet` },
          { status: 400 }
        )
      }

      for (const [module, level] of Object.entries(modules)) {
        if (typeof level !== 'string' || !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
          return NextResponse.json(
            { error: `Niveau de permission invalide "${level}" pour le module "${module}" du rôle "${role}". Niveaux acceptés: ${VALID_LEVELS.join(', ')}` },
            { status: 400 }
          )
        }
      }
    }

    // Upsert each role's permission config
    const entrepriseId = (session.user as { entrepriseId?: string }).entrepriseId || null

    for (const [role, modules] of Object.entries(permissions)) {
      const permissionsJson = JSON.stringify(modules)

      // Delete existing config for this role and create new one (upsert pattern)
      await db.permissionConfig.deleteMany({
        where: { role },
      })

      await db.permissionConfig.create({
        data: {
          role,
          permissions: permissionsJson,
          entrepriseId,
        },
      })
    }

    // Create audit log entry
    await db.auditLog.create({
      data: {
        userId,
        entrepriseId,
        action: 'UPDATE',
        module: 'permissions',
        details: `Mise à jour des permissions pour ${roles.length} rôle(s): ${roles.join(', ')}`,
      },
    })

    // Fetch and return the updated configs
    const updatedConfigs = await db.permissionConfig.findMany({
      orderBy: { role: 'asc' },
    })

    const result: Record<string, Record<string, string>> = {}
    for (const config of updatedConfigs) {
      try {
        const parsed = JSON.parse(config.permissions || '{}')
        result[config.role] = parsed
      } catch {
        result[config.role] = {}
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Permissions mises à jour avec succès',
      permissions: result,
    })
  } catch (error) {
    console.error('PUT /api/permissions error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des permissions' },
      { status: 500 }
    )
  }
}
