import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireSuperAdmin, requireTenantContext } from '@/lib/tenant'
import { hashPassword, generateSecurePassword, validatePasswordStrength } from '@/lib/password'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/users — List users with filters
// GERANT+ can list users of their entreprise
// SUPER_ADMIN can list all users across entreprises
// Supports: ?role=CHEF_CHANTIER&active=true&search=term&page=1&limit=20
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const role = searchParams.get('role')?.trim() || ''
    const activeParam = searchParams.get('active')?.trim() || ''
    const search = searchParams.get('search')?.trim() || ''

    // Build the where clause — tenant-scoped for non-super-admin
    const where: Record<string, unknown> = {}

    if (!ctx.isSuperAdmin && ctx.entrepriseId) {
      where.entrepriseId = ctx.entrepriseId
    }

    if (role) {
      where.role = role
    }

    if (activeParam !== '') {
      where.active = activeParam === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { telephone: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
          entreprise: {
            select: { id: true, nom: true },
          },
          _count: {
            select: {
              chantierAccess: true,
            },
          },
        },
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/users — Create a new user (GERANT+)
// GERANT+ can invite/create users for their entreprise
// SUPER_ADMIN can create users for any entreprise
// Body: { name, email, role, telephone?, password?, entrepriseId? }
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request)

    const body = await request.json()
    const { name, email, role, telephone, password, entrepriseId } = body

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom est requis.' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return NextResponse.json(
        { error: "L'email est requis." },
        { status: 400 }
      )
    }

    if (!role || typeof role !== 'string' || role.trim() === '') {
      return NextResponse.json(
        { error: 'Le rôle est requis.' },
        { status: 400 }
      )
    }

    // Valid roles (no SUPER_ADMIN creation via this endpoint)
    const validRoles = ['CHEF_ENTREPRISE', 'ADMIN', 'ADMIN_ENTREPRISE', 'CONDUCTEUR', 'CHEF_CHANTIER', 'SOUS_TRAITANT']
    if (!validRoles.includes(role.trim())) {
      return NextResponse.json(
        { error: `Rôle invalide. Valeurs acceptées : ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Check email uniqueness
    const existingUser = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà.' },
        { status: 409 }
      )
    }

    // Determine entrepriseId
    let targetEntrepriseId = entrepriseId?.trim() || null

    if (!ctx.isSuperAdmin) {
      // Non-super-admin can only create users in their own entreprise
      targetEntrepriseId = ctx.entrepriseId
    }

    if (!targetEntrepriseId && !ctx.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Aucune entreprise assignée. Impossible de créer un utilisateur.' },
        { status: 400 }
      )
    }

    // Verify entreprise exists
    if (targetEntrepriseId) {
      const entreprise = await db.entreprise.findUnique({
        where: { id: targetEntrepriseId },
        select: { id: true, nom: true, status: true },
      })

      if (!entreprise) {
        return NextResponse.json(
          { error: 'Entreprise non trouvée.' },
          { status: 404 }
        )
      }

      if (entreprise.status !== 'active') {
        return NextResponse.json(
          { error: 'Impossible de créer un utilisateur dans une entreprise non active.' },
          { status: 400 }
        )
      }
    }

    // Handle password
    let hashedPassword: string | null = null
    const providedPassword = password?.trim()

    if (providedPassword) {
      const strength = validatePasswordStrength(providedPassword)
      if (!strength.valid) {
        return NextResponse.json(
          { error: 'Mot de passe trop faible.', details: strength.errors },
          { status: 400 }
        )
      }
      hashedPassword = await hashPassword(providedPassword)
    } else {
      // Generate a secure temporary password
      const generatedPassword = generateSecurePassword()
      hashedPassword = await hashPassword(generatedPassword)
    }

    // Create user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role.trim(),
        telephone: telephone?.trim() || null,
        entrepriseId: targetEntrepriseId,
        active: true,
        premiereConnexion: !providedPassword, // Force password change if no password provided
        invitedById: ctx.userId,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: targetEntrepriseId,
        action: 'CREATE',
        module: 'users',
        entityType: 'User',
        entityId: user.id,
        details: `Création de l'utilisateur "${user.name}" (${user.email}) avec le rôle ${user.role}`,
      },
    })

    // Return without password
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        user: userWithoutPassword,
        message: providedPassword
          ? 'Utilisateur créé avec succès.'
          : 'Utilisateur créé avec un mot de passe temporaire. L\'utilisateur devra le modifier à la première connexion.',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'utilisateur" },
      { status: 500 }
    )
  }
}
