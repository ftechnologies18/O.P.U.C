import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/users/[id] — Get single user by ID
// Any authenticated user can view their own profile
// GERANT+ can view users in their entreprise
// SUPER_ADMIN can view any user
// ═══════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    // Access control: own profile, same entreprise (GERANT+), or SUPER_ADMIN
    if (
      ctx.userId !== id &&
      !ctx.isSuperAdmin &&
      ctx.entrepriseId !== null
    ) {
      // Check if target user belongs to same entreprise
      const targetUser = await db.user.findUnique({
        where: { id },
        select: { entrepriseId: true },
      })
      if (
        !targetUser ||
        targetUser.entrepriseId !== ctx.entrepriseId
      ) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous ne pouvez voir que votre profil ou ceux de votre entreprise.' },
          { status: 403 }
        )
      }
    }

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telephone: true,
        active: true,
        entrepriseId: true,
        twoFactorEnabled: true,
        premiereConnexion: true,
        lastLoginAt: true,
        lastLoginIp: true,
        lockedUntil: true,
        loginAttempts: true,
        invitedById: true,
        invitationAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        entreprise: {
          select: { id: true, nom: true },
        },
        chantierAccess: {
          include: {
            chantier: {
              select: {
                id: true,
                nom: true,
                statut: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/users/[id] — Update user (GERANT+)
// SUPER_ADMIN can update any user
// GERANT+ can update users in their entreprise
// Users can update their own name and telephone
// Body: { name?, role?, active?, telephone?, email? }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    // Check target user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, role, active, telephone, email } = body

    // Determine what fields can be updated based on who is making the request
    const isSelfUpdate = ctx.userId === id
    const canUpdateRole = ctx.isSuperAdmin || (!isSelfUpdate && ctx.role === 'GERANT')
    const canUpdateActive = ctx.isSuperAdmin || (!isSelfUpdate && ctx.role === 'GERANT')
    const canUpdateEmail = ctx.isSuperAdmin || (!isSelfUpdate && ctx.role === 'GERANT')

    // For non-self updates, check entreprise membership (unless SUPER_ADMIN)
    if (!isSelfUpdate && !ctx.isSuperAdmin) {
      if (!existingUser.entrepriseId || existingUser.entrepriseId !== ctx.entrepriseId) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous ne pouvez modifier que les utilisateurs de votre entreprise.' },
          { status: 403 }
        )
      }
    }

    // Cannot update own role or active status
    if (isSelfUpdate && (role !== undefined || active !== undefined)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle ou statut.' },
        { status: 403 }
      )
    }

    // Validate role if provided
    if (role !== undefined) {
      if (!canUpdateRole) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous n\'avez pas les permissions pour modifier les rôles.' },
          { status: 403 }
        )
      }

      const validRoles = ['GERANT', 'CHEF_PROJET', 'SOUS_TRAITANT']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Rôle invalide. Valeurs acceptées : ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate active if provided
    if (active !== undefined) {
      if (!canUpdateActive) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous n\'avez pas les permissions pour modifier le statut.' },
          { status: 403 }
        )
      }
    }

    // Validate email uniqueness if changed
    if (email !== undefined && email !== null && email.trim() !== existingUser.email) {
      if (!canUpdateEmail) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous n\'avez pas les permissions pour modifier l\'email.' },
          { status: 403 }
        )
      }
      const emailExists = await db.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà.' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (role !== undefined) updateData.role = role.trim()
    if (active !== undefined) updateData.active = Boolean(active)
    if (telephone !== undefined) updateData.telephone = telephone?.trim() || null
    if (email !== undefined) updateData.email = email?.trim().toLowerCase() || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ à modifier.' },
        { status: 400 }
      )
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telephone: true,
        active: true,
        entrepriseId: true,
        twoFactorEnabled: true,
        premiereConnexion: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        entreprise: {
          select: { id: true, nom: true },
        },
      },
    })

    // Audit log
    const changes: string[] = []
    if (name && name.trim() !== existingUser.name) changes.push(`nom: "${existingUser.name}" → "${name.trim()}"`)
    if (role && role.trim() !== existingUser.role) changes.push(`rôle: "${existingUser.role}" → "${role.trim()}"`)
    if (active !== undefined && Boolean(active) !== existingUser.active) {
      changes.push(`statut: ${existingUser.active ? 'actif' : 'inactif'} → ${active ? 'actif' : 'inactif'}`)
    }
    if (email && email.trim().toLowerCase() !== existingUser.email) changes.push(`email: "${existingUser.email}" → "${email.trim().toLowerCase()}"`)
    if (telephone !== undefined) changes.push('téléphone mis à jour')

    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: existingUser.entrepriseId || ctx.entrepriseId,
        action: active === false ? 'BLOCK' : active === true ? 'UNBLOCK' : 'UPDATE',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Mise à jour de l'utilisateur "${existingUser.name}" (${existingUser.email}): ${changes.join(', ')}`,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'utilisateur" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/users/[id] — Deactivate user (soft delete)
// GERANT+ can deactivate users in their entreprise
// SUPER_ADMIN can deactivate any user
// Cannot deactivate self
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdmin(request)
    const { id } = await params

    // Cannot deactivate self
    if (id === ctx.userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas désactiver votre propre compte.' },
        { status: 403 }
      )
    }

    // Check user exists
    const user = await db.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé.' },
        { status: 404 }
      )
    }

    // Check entreprise membership (unless SUPER_ADMIN)
    if (!ctx.isSuperAdmin) {
      if (!user.entrepriseId || user.entrepriseId !== ctx.entrepriseId) {
        return NextResponse.json(
          { error: 'Accès refusé. Vous ne pouvez désactiver que les utilisateurs de votre entreprise.' },
          { status: 403 }
        )
      }
    }

    // Check if target user is a SUPER_ADMIN (cannot be deactivated by non-super-admin)
    const { getRoleLevel } = await import('@/lib/rbac')
    const targetRoleLevel = getRoleLevel((user.role as 'SUPER_ADMIN') || 'CHEF_CHANTIER')
    const requestorRoleLevel = getRoleLevel(ctx.role)

    if (targetRoleLevel >= getRoleLevel('SUPER_ADMIN') && !ctx.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Accès refusé. Vous ne pouvez pas désactiver un administrateur de niveau supérieur.' },
        { status: 403 }
      )
    }

    // Soft delete: deactivate the user
    const deactivatedUser = await db.user.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: user.entrepriseId || ctx.entrepriseId,
        action: 'BLOCK',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Désactivation de l'utilisateur "${user.name}" (${user.email}) avec le rôle ${user.role}`,
      },
    })

    return NextResponse.json({
      success: true,
      user: deactivatedUser,
      message: `Utilisateur "${user.name}" désactivé avec succès.`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la désactivation de l'utilisateur" },
      { status: 500 }
    )
  }
}
