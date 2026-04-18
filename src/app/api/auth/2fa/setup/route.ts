import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import {
  generateTOTPSecret,
  generateTOTPBackupCodes,
  getTOTPAuthURI,
  encryptSecret,
} from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth(request)

    // Check if 2FA is already enabled
    if (ctx.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'L\'authentification à deux facteurs est déjà activée.' },
        { status: 400 }
      )
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret()

    // Generate backup codes
    const backupCodes = generateTOTPBackupCodes(10)

    // Generate auth URI for QR code
    const authURI = getTOTPAuthURI(secret, ctx.email)

    // Encrypt and save secret to user
    const encryptedSecret = encryptSecret(secret)
    const encryptedBackupCodes = encryptSecret(JSON.stringify(backupCodes))

    await db.user.update({
      where: { id: ctx.userId },
      data: {
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: encryptedBackupCodes,
        twoFactorEnabled: false, // Not fully enabled until verified
      },
    })

    return NextResponse.json({
      secret,
      authURI,
      backupCodes,
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status
      return NextResponse.json(
        { error: error.message },
        { status }
      )
    }
    console.error('[2FA_SETUP] Error:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la configuration 2FA.' },
      { status: 500 }
    )
  }
}
