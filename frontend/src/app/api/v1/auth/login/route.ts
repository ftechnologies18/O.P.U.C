/**
 * Next.js API Route — POST /api/v1/auth/login
 *
 * Proxy vers le backend Go (Render) qui gère le Set-Cookie.
 * Vercel rewrites ne forward pas les Set-Cookie du backend vers le navigateur,
 * donc on doit manuellement extraire et re-set le cookie.
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Forward vers le backend Go
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await backendRes.json()

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status })
    }

    // Extraire le Set-Cookie du backend et le re-set sur la réponse Vercel
    const setCookie = backendRes.headers.get('set-cookie')
    const response = NextResponse.json(data, { status: 200 })

    if (setCookie) {
      // Extraire la valeur du cookie opuc_session
      const cookieMatch = setCookie.match(/opuc_session=([^;]+)/)
      if (cookieMatch) {
        response.cookies.set('opuc_session', cookieMatch[1], {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 86400, // 24h
        })
      }
    }

    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
