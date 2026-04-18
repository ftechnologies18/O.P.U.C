import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import {
  verifyTOTPCode,
  decryptSecret,
  encryptSecret,
} from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)
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
        twoFactorBackupCodes: true,
      },
    })

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Aucun secret 2FA configuré. Veuillez d\'abord configurer la 2FA.' },
        { status: 400 }
      )
    }

    // Decrypt the TOTP secret
    let decryptedSecret: string
    try {
      decryptedSecret = decryptSecret(user.twoFactorSecret)
    } catch {
      return NextResponse.json(
        { error: 'Erreur lors du déchiffrement du secret. Veuillez reconfigurer la 2FA.' },
        { status: 400 }
      )
    }

    // Check if it's a 6-digit TOTP code
    if (code.length === 6 && /^\d+$/.test(code)) {
      // Verify TOTP code
      const isValid = verifyTOTPCode(decryptedSecret, code)

      if (isValid) {
        await db.user.update({
          where: { id: ctx.userId },
          data: { twoFactorEnabled: true },
        })

        return NextResponse.json({
          message: 'Authentification à deux facteurs activée avec succès.',
        })
      }
    }

    // Check if it's an 8-digit backup code
    if (code.length === 8) {
      if (user.twoFactorBackupCodes) {
        let backupCodes: string[]
        try {
          backupCodes = JSON.parse(decryptSecret(user.twoFactorBackupCodes))
        } catch {
          return NextResponse.json(
            { error: 'Erreur lors du déchiffrement des codes de secours.' },
            { status: 400 }
          )
        }

        const codeIndex = backupCodes.indexOf(code.toUpperCase())
        if (codeIndex !== -1) {
          // Mark backup code as used by removing it from the list
          backupCodes.splice(codeIndex, 1)

          // Re-encrypt the updated backup codes
          const reEncryptedCodes = encryptSecret(JSON.stringify(backupCodes))

          await db.user.update({
            where: { id: ctx.userId },
            data: {
              twoFactorBackupCodes: reEncryptedCodes,
              twoFactorEnabled: true,
            },
          })

          return NextResponse.json({
            message: 'Code de secours utilisé. Authentification à deux facteurs activée.',
            remainingBackupCodes: backupCodes.length,
          })
        }
      }
    }

    return NextResponse.json(
      { error: 'Code invalide. Veuillez réessayer.' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status
      return NextResponse.json(
        { error: error.message },
        { status }
      )
    }
    console.error('[2FA_VERIFY] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la vérification 2FA.' },
      { status: 500 }
    )
  }
}
