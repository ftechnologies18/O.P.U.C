import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { verifyTOTPCode, decryptSecret } from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    if (!ctx.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'L\'authentification à deux facteurs n\'est pas activée.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code de vérification requis.' },
        { status: 400 }
      )
    }

    // Get user's encrypted secret
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        twoFactorSecret: true,
      },
    })

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Secret 2FA introuvable.' },
        { status: 400 }
      )
    }

    // Decrypt the TOTP secret
    let decryptedSecret: string
    try {
      decryptedSecret = decryptSecret(user.twoFactorSecret)
    } catch {
      return NextResponse.json(
        { error: 'Erreur lors du déchiffrement du secret.' },
        { status: 400 }
      )
    }

    // Verify TOTP code
    const isValid = verifyTOTPCode(decryptedSecret, code)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Code invalide. Veuillez réessayer.' },
        { status: 400 }
      )
    }

    // Disable 2FA and clear secret
    await db.user.update({
      where: { id: ctx.userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    })

    return NextResponse.json({
      message: 'Authentification à deux facteurs désactivée avec succès.',
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status
      return NextResponse.json(
        { error: error.message },
        { status }
      )
    }
    console.error('[2FA_DISABLE] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la désactivation 2FA.' },
      { status: 500 }
    )
  }
}
