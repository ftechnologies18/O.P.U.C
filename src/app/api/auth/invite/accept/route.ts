import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password, name } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token et mot de passe requis.' },
        { status: 400 }
      )
    }

    // Find the invitation token
    const invitation = await db.invitationToken.findUnique({
      where: { token },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Token d\'invitation invalide.' },
        { status: 400 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Cette invitation a déjà été utilisée.' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'L\'invitation a expiré. Veuillez demander une nouvelle invitation.' },
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

    // Check if user already exists (token might have been used via another path)
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte avec cette adresse email existe déjà.' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Determine the user's display name
    const displayName = name || [invitation.prenom, invitation.nom].filter(Boolean).join(' ') || invitation.email.split('@')[0]

    // Create new user
    const newUser = await db.user.create({
      data: {
        email: invitation.email,
        name: displayName,
        password: hashedPassword,
        role: invitation.role,
        entrepriseId: invitation.entrepriseId,
        premiereConnexion: true,
        invitedById: invitation.invitedBy,
        invitationAcceptedAt: new Date(),
        active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        entrepriseId: true,
      },
    })

    // Mark invitation as accepted and link to user
    await db.invitationToken.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        userId: newUser.id,
      },
    })

    return NextResponse.json({
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    })
  } catch (error) {
    console.error('[INVITE_ACCEPT] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de l\'acceptation de l\'invitation.' },
      { status: 500 }
    )
  }
}
