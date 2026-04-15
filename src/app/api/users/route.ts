import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// GET /api/users — List all users with chantier access count
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const users = await db.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        entreprise: {
          select: { id: true, nom: true },
        },
        _count: {
          select: {
            chantierAccess: true,
          },
        },
      },
    })

    // Remove password from response
    const usersWithoutPassword = users.map((user) => {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    })

    return NextResponse.json({ users: usersWithoutPassword })
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}

// POST /api/users — Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, password, role, telephone, entrepriseId } = body

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom est requis' },
        { status: 400 }
      )
    }

    if (!email || email.trim() === '') {
      return NextResponse.json(
        { error: "L'email est requis" },
        { status: 400 }
      )
    }

    if (!password || password.trim() === '') {
      return NextResponse.json(
        { error: 'Le mot de passe est requis' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    if (!role || role.trim() === '') {
      return NextResponse.json(
        { error: 'Le rôle est requis' },
        { status: 400 }
      )
    }

    const validRoles = ['ADMIN', 'CHEF_ENTREPRISE', 'CONDUCTEUR', 'CHEF_CHANTIER', 'SOUS_TRAITANT']
    if (!validRoles.includes(role)) {
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
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password.trim(), 10)

    // Create user
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role.trim(),
        telephone: telephone?.trim() || null,
        entrepriseId: entrepriseId?.trim() || null,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action: 'CREATE',
        module: 'users',
        entityType: 'User',
        entityId: user.id,
        details: `Création de l'utilisateur "${user.name}" (${user.email}) avec le rôle ${user.role}`,
      },
    })

    // Return without password
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword, { status: 201 })
  } catch (error) {
    console.error('POST /api/users error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'utilisateur" },
      { status: 500 }
    )
  }
}
