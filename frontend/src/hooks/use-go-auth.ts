'use client'

/**
 * Hook useGoAuth — remplace useSession de NextAuth.
 *
 * Gère l'état d'authentification via l'API Go :
 *   - `user` : user courant (ou null si non authentifié)
 *   - `loading` : true pendant la vérification initiale
 *   - `login(email, password)` : connexion
 *   - `logout()` : déconnexion
 *   - `refresh()` : recharge le user depuis /api/v1/auth/me
 *
 * Le cookie httpOnly `opuc_session` est géré par le backend Go.
 */

import { useState, useEffect, useCallback } from 'react'
import { goApi, GoUser, ApiError } from '@/lib/go-api'

interface UseGoAuthReturn {
  user: GoUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<{ twoFARequired: boolean }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export function useGoAuth(): UseGoAuthReturn {
  const [user, setUser] = useState<GoUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Vérifie la session au montage
  const refresh = useCallback(async () => {
    try {
      const u = await goApi.me()
      setUser(u)
      setError(null)
    } catch (e) {
      setUser(null)
      if (e instanceof ApiError && e.status !== 401) {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      try {
        const res = await goApi.login(email, password)
        if (!res.twoFARequired) {
          setUser(res.user)
        }
        return { twoFARequired: res.twoFARequired }
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.status === 401
              ? 'Email ou mot de passe incorrect'
              : e.message
            : 'Une erreur est survenue. Veuillez réessayer.'
        setError(msg)
        throw e
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await goApi.logout()
    } catch {
      // ignore
    }
    setUser(null)
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }, [])

  return { user, loading, error, login, logout, refresh }
}
