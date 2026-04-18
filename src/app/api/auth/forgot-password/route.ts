import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateResetToken } from '@/lib/password'
import { rateLimitByRequest } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  // ── Rate limiting: 5 requests per 15 minutes per IP ──
  const rateResult = rateLimitByRequest(request, 'forgot-password', {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  })

  if (!rateResult.success) {
    const retryAfterSeconds = Math.ceil(rateResult.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Trop de requêtes. Veuillez réessayer plus tard.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email requis.' },
        { status: 400 }
      )
    }

    // Always return the same message regardless of whether the email exists
    const genericMessage = 'Si un compte existe avec cette adresse email, un lien de réinitialisation a été envoyé.'

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (user) {
      // Delete any existing tokens for this user
      await db.passwordResetToken.deleteMany({
        where: { userId: user.id },
      })

      // Generate new reset token
      const token = generateResetToken()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1)

      await db.passwordResetToken.create({
        data: {
          email: user.email,
          token,
          expiresAt,
          userId: user.id,
        },
      })

      // Log the token only in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Password reset token for ${user.email}: ${token}`)
      }
    }

    return NextResponse.json({ message: genericMessage })
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
