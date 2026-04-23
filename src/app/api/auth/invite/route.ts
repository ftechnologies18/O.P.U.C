import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/tenant'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request)
    const body = await request.json()
    const { email, role, nom, prenom } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email requis.' },
        { status: 400 }
      )
    }

    if (!role || typeof role !== 'string') {
      return NextResponse.json(
        { error: 'Rôle requis.' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = [
      'SUPER_ADMIN',
      'GERANT',
      'CHEF_PROJET',
      'SOUS_TRAITANT',
    ]

    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide.' },
        { status: 400 }
      )
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cette adresse email existe déjà.' },
        { status: 409 }
      )
    }

    // Generate invitation token (48 bytes hex)
    const token = randomBytes(48).toString('hex')

    // Set expiration to 48 hours from now
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    // Create invitation token record
    const invitation = await db.invitationToken.create({
      data: {
        token,
        email: email.toLowerCase().trim(),
        role,
        nom: nom || null,
        prenom: prenom || null,
        entrepriseId: ctx.entrepriseId,
        invitedBy: ctx.userId,
        expiresAt,
      },
    })

    // In production, send email with invitation link containing token
    console.log(`[DEV] Invitation token for ${email}: ${token}`)

    return NextResponse.json({
      message: 'Invitation envoyée.',
      token: invitation.token,
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status
      return NextResponse.json(
        { error: error.message },
        { status }
      )
    }
    console.error('[INVITE] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de l\'envoi de l\'invitation.' },
      { status: 500 }
    )
  }
}
