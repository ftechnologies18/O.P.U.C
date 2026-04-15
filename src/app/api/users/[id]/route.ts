import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/users/[id] — Get single user by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      include: {
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
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('GET /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] — Update user fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const sessionUserId = (session.user as { id: string }).id
    const sessionUserRole = (session.user as { role: string }).role

    // Check user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, role, telephone, email } = body

    // Cannot update own role unless ADMIN
    if (role && id === sessionUserId && sessionUserRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle' },
        { status: 403 }
      )
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['ADMIN', 'CHEF_ENTREPRISE', 'CONDUCTEUR', 'CHEF_CHANTIER', 'SOUS_TRAITANT']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Rôle invalide. Valeurs acceptées : ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate email uniqueness if changed
    if (email && email.trim() !== existingUser.email) {
      const emailExists = await db.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 409 }
        )
      }
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (role !== undefined) updateData.role = role.trim()
    if (telephone !== undefined) updateData.telephone = telephone?.trim() || null
    if (email !== undefined) updateData.email = email.trim().toLowerCase()

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        entreprise: {
          select: { id: true, nom: true },
        },
      },
    })

    // Create audit log
    const changes: string[] = []
    if (name && name.trim() !== existingUser.name) changes.push(`nom: "${existingUser.name}" → "${name.trim()}"`)
    if (role && role.trim() !== existingUser.role) changes.push(`rôle: "${existingUser.role}" → "${role.trim()}"`)
    if (email && email.trim().toLowerCase() !== existingUser.email) changes.push(`email: "${existingUser.email}" → "${email.trim().toLowerCase()}"`)
    if (telephone !== undefined) changes.push('téléphone mis à jour')

    await db.auditLog.create({
      data: {
        userId: sessionUserId,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action: 'UPDATE',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Mise à jour de l'utilisateur "${existingUser.name}" (${existingUser.email}): ${changes.join(', ')}`,
      },
    })

    // Return without password
    const { password, ...userWithoutPassword } = updatedUser

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'utilisateur" },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] — Delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const sessionUserId = (session.user as { id: string }).id

    // Cannot delete self
    if (id === sessionUserId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 403 }
      )
    }

    // Check user exists
    const user = await db.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Delete related UserChantierAccess entries
    await db.userChantierAccess.deleteMany({
      where: { userId: id },
    })

    // Delete user
    await db.user.delete({
      where: { id },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: sessionUserId,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action: 'DELETE',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Suppression de l'utilisateur "${user.name}" (${user.email}) avec le rôle ${user.role}`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    )
  }
}
