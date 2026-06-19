/**
 * Next.js API Route — POST /api/v1/auth/logout
 *
 * Clear le cookie opuc_session côté Vercel.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 })
  response.cookies.set('opuc_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: -1, // supprime le cookie
  })
  return response
}
