'use client'

/**
 * Shim auth-session — remplace next-auth/react côté frontend.
 *
 * Exporte useSession, signOut, signIn avec la MÊME API que NextAuth,
 * mais utilise l'API Go (/api/v1/auth/*) en interne.
 *
 * Migration : remplacer `import { useSession } from '@/lib/auth-session'`
 * par `import { useSession } from '@/lib/auth-session'` dans tous les fichiers.
 *
 * Le cookie httpOnly `opuc_session` (JWT Go) est géré automatiquement
 * (credentials: same-origin dans les fetch).
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { goApi, GoUser, ApiError } from '@/lib/go-api'

// ── Types (compatibles NextAuth) ────────────────────────────────

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  telephone?: string
  entrepriseId?: string
  twoFactorEnabled?: boolean
}

export interface Session {
  user: SessionUser
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface SessionContextValue {
  data: Session | null
  status: SessionStatus
}

// ── Context ────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: 'loading',
})

// ── Provider ───────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')

  // Fetch initial session au montage du provider
  useEffect(() => {
    let cancelled = false
    goApi
      .me()
      .then((u) => {
        if (cancelled) return
        if (u) {
          setSession({
            user: {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              telephone: u.telephone,
              entrepriseId: u.entrepriseId,
              twoFactorEnabled: u.twoFactorEnabled,
            },
          })
          setStatus('authenticated')
        } else {
          setSession(null)
          setStatus('unauthenticated')
        }
      })
      .catch(() => {
        if (cancelled) return
        setSession(null)
        setStatus('unauthenticated')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SessionContext.Provider value={{ data: session, status }}>
      {children}
    </SessionContext.Provider>
  )
}

// ── Hooks (compatibles NextAuth) ────────────────────────────────

export function useSession(): { data: Session | null; status: SessionStatus } {
  return useContext(SessionContext)
}

export async function signOut(): Promise<void> {
  try {
    await goApi.logout()
  } catch {
    // ignore
  }
  // Reload pour reset l'état
  if (typeof window !== 'undefined') {
    window.location.href = '/'
  }
}

export async function signIn(
  _provider?: string,
  options?: { email?: string; password?: string; redirect?: boolean },
): Promise<{ error: string | null; ok: boolean }> {
  if (!options?.email || !options?.password) {
    return { error: 'missing credentials', ok: false }
  }
  try {
    await goApi.login(options.email, options.password)
    return { error: null, ok: true }
  } catch (e) {
    const msg =
      e instanceof ApiError
        ? e.status === 401
          ? 'CredentialsSignin'
          : e.message
        : 'unknown error'
    return { error: msg, ok: false }
  }
}
