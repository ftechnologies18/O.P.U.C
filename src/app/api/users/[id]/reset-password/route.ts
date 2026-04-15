import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Generate a random alphanumeric password
function generateRandomPassword(length: number = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// POST /api/users/[id]/reset-password — Reset user password
export async function POST(
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

    // Generate random 10-char password
    const plainTextPassword = generateRandomPassword(10)

    // Hash and save
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10)

    await db.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: sessionUserId,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action: 'PASSWORD_RESET',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Réinitialisation du mot de passe de l'utilisateur "${user.name}" (${user.email})`,
      },
    })

    // Return the plain text password so admin can communicate it
    return NextResponse.json({
      success: true,
      newPassword: plainTextPassword,
      message: `Le mot de passe de ${user.name} a été réinitialisé`,
    })
  } catch (error) {
    console.error('POST /api/users/[id]/reset-password error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation du mot de passe" },
      { status: 500 }
    )
  }
}
