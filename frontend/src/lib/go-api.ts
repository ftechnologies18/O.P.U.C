/**
 * Client API Go — remplace NextAuth + Prisma côté frontend.
 *
 * Tous les appels passent par /api/v1/* qui est proxyé vers le backend Go.
 * En dev : next.config.ts rewrites → localhost:8080
 * En prod (Vercel) : next.config.ts rewrites → Render (opuc-api.onrender.com)
 *
 * Auth (login/logout) passe par des Next.js API routes qui gèrent le Set-Cookie
 * (Vercel rewrites ne forward pas les Set-Cookie du backend vers le navigateur).
 *
 * Le cookie httpOnly `opuc_session` (JWT) est envoyé automatiquement (credentials: same-origin).
 */

const API_BASE = '/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin', // envoie le cookie opuc_session
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  // Parse JSON (même pour les erreurs)
  const text = await res.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Erreur ${res.status}`
    throw new ApiError(res.status, message)
  }

  return data as T
}

// ── Types ──────────────────────────────────────────────────────

export interface GoUser {
  id: string
  email: string
  name: string
  role: 'SUPER_ADMIN' | 'GERANT' | 'CHEF_PROJET' | 'SOUS_TRAITANT'
  telephone?: string
  active: boolean
  entrepriseId?: string
  twoFactorEnabled: boolean
  /** true si l'utilisateur est co-gérant (CHEF_PROJET promu). */
  isCoGerant?: boolean
}

export interface LoginResponse {
  user: GoUser
  twoFARequired: boolean
  twoFAVerified: boolean
  expiresIn: number
}

// ── Auth endpoints ─────────────────────────────────────────────

export const goApi = {
  /** POST /api/v1/auth/login — connexion (set cookie httpOnly) */
  async login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  /** POST /api/v1/auth/logout — déconnexion (clear cookie) */
  async logout(): Promise<void> {
    await request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
  },

  /** GET /api/v1/auth/me — user courant (valide le JWT cookie) */
  async me(): Promise<GoUser | null> {
    try {
      return await request<GoUser>('/auth/me')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        return null
      }
      throw e
    }
  },

  /** POST /api/v1/auth/2fa/verify — valide un code TOTP */
  async verify2FA(code: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  /** POST /api/v1/auth/2fa/setup — génère secret + QR URL */
  async setup2FA(): Promise<{ secret: string; qrUrl: string }> {
    return request<{ secret: string; qrUrl: string }>('/auth/2fa/setup', {
      method: 'POST',
    })
  },

  /** POST /api/v1/auth/2fa/disable — désactive 2FA (nécessite password) */
  async disable2FA(password: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  },

  // ── Generic helpers pour les autres endpoints ────────────────

  /** GET générique */
  async get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  /** POST générique */
  async post<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /** PUT générique */
  async put<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  /** DELETE générique */
  async delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },

  /** Upload fichier (multipart, pas JSON) */
  async upload(
    file: File | Blob,
    prefix = 'uploads',
    filename = 'file',
  ): Promise<{
    key: string
    url: string
    size: number
    contentType: string
    etag: string
    storageClass: string
  }> {
    const fd = new FormData()
    fd.append('file', file, filename)
    fd.append('prefix', prefix)
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'upload failed' }))
      throw new ApiError(res.status, err.error || 'upload failed')
    }
    return res.json()
  },
}
