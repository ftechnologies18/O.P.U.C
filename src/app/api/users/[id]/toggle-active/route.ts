import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/users/[id]/toggle-active — Toggle user active/inactive status
export async function PATCH(
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

    // Cannot disable self
    if (id === sessionUserId) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas désactiver votre propre compte" },
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

    // Toggle active status
    const newActiveStatus = !user.active

    const updatedUser = await db.user.update({
      where: { id },
      data: { active: newActiveStatus },
      include: {
        entreprise: {
          select: { id: true, nom: true },
        },
      },
    })

    // Create audit log
    const action = newActiveStatus ? 'UNBLOCK' : 'BLOCK'
    const actionLabel = newActiveStatus ? 'Activation' : 'Désactivation'

    await db.auditLog.create({
      data: {
        userId: sessionUserId,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action,
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `${actionLabel} du compte utilisateur "${user.name}" (${user.email})`,
      },
    })

    // Return without password
    const { password, ...userWithoutPassword } = updatedUser

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('PATCH /api/users/[id]/toggle-active error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la modification du statut de l'utilisateur" },
      { status: 500 }
    )
  }
}
