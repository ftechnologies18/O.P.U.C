import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword,
  validatePasswordStrength,
  isResetTokenExpired,
} from '@/lib/password'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token et mot de passe requis.' },
        { status: 400 }
      )
    }

    // Find the reset token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Token de réinitialisation invalide.' },
        { status: 400 }
      )
    }

    // Check if token has been used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'Ce token a déjà été utilisé. Veuillez demander un nouveau lien.' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (isResetTokenExpired(resetToken.expiresAt)) {
      return NextResponse.json(
        { error: 'Le lien de réinitialisation a expiré. Veuillez demander un nouveau lien.' },
        { status: 400 }
      )
    }

    // Validate password strength
    const validation = validatePasswordStrength(password)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Mot de passe trop faible.', details: validation.errors },
        { status: 400 }
      )
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { email: resetToken.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable.' },
        { status: 404 }
      )
    }

    // Hash new password and update user
    const hashedPassword = await hashPassword(password)

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        premiereConnexion: false,
        loginAttempts: 0,
        lockedUntil: null,
      },
    })

    // Mark token as used
    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    })

    return NextResponse.json({
      message: 'Mot de passe réinitialisé avec succès.',
    })
  } catch (error) {
    console.error('[RESET_PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
