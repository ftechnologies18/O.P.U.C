// ─────────────────────────────────────────────────────────────
// O.P.U.C — Tenant Context Utilities
// Server-only module — provides authenticated tenant context
// for API route handlers and server-side logic.
// Inspired by CATS repository pattern.
// ─────────────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import type { UserRole } from '@/lib/rbac'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════
// CUSTOM ERROR CLASSES
// ═══════════════════════════════════════════════════════════

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string, public status: number = 403) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// ═══════════════════════════════════════════════════════════
// TENANT CONTEXT INTERFACE
// ═══════════════════════════════════════════════════════════

export interface TenantContext {
  userId: string
  email: string
  name: string
  role: UserRole
  entrepriseId: string | null
  isSuperAdmin: boolean
  twoFactorEnabled: boolean
  premiereConnexion: boolean
}

// ═══════════════════════════════════════════════════════════
// VALID ROLE LIST
// ═══════════════════════════════════════════════════════════

const VALID_ROLES: string[] = [
  'SUPER_ADMIN',
  'GERANT',
  'CHEF_PROJET',
  'SOUS_TRAITANT',
]

// ═══════════════════════════════════════════════════════════
// LEGACY ROLE MAPPING
// Maps old role names from previous versions to new 4-role system.
// Only used for backward compatibility with existing DB records.
// ═══════════════════════════════════════════════════════════

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  // New roles (identity mapping)
  SUPER_ADMIN: 'SUPER_ADMIN',
  GERANT: 'GERANT',
  CHEF_PROJET: 'CHEF_PROJET',
  SOUS_TRAITANT: 'SOUS_TRAITANT',
  // Old roles → merged into new system
  ADMIN_ENTREPRISE: 'GERANT',    // Merged into GERANT
  ADMIN: 'GERANT',                // Merged into GERANT
  CHEF_ENTREPRISE: 'GERANT',     // Was alias for GERANT
  CONDUCTEUR: 'CHEF_PROJET',     // Merged into CHEF_PROJET
  CHEF_CHANTIER: 'CHEF_PROJET',  // Merged into CHEF_PROJET
}

function mapRole(rawRole: string): UserRole {
  return LEGACY_ROLE_MAP[rawRole] ?? 'CHEF_PROJET'
}

// ═══════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Validates the current user's session and returns a typed TenantContext.
 * This is the base authentication check — use the more specific helpers below.
 *
 * Checks performed:
 *  - Session exists (user is logged in)
 *  - User exists in DB and is active
 *  - User account is not locked
 *  - Role is valid (or mapped from legacy role)
 *
 * @throws AuthError (401) if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<TenantContext> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    throw new AuthError('Non authentifié. Veuillez vous connecter.', 401)
  }

  // Fetch fresh user data from DB
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      entrepriseId: true,
      active: true,
      twoFactorEnabled: true,
      premiereConnexion: true,
      lockedUntil: true,
    },
  })

  if (!user) {
    throw new AuthError('Utilisateur introuvable.', 401)
  }

  if (!user.active) {
    throw new AuthError('Compte désactivé. Contactez votre administrateur.', 403)
  }

  // Check if account is locked (lockedUntil > now)
  const lockedUntil = user.lockedUntil as Date | null
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    const remaining = Math.ceil(
      (new Date(lockedUntil).getTime() - Date.now()) / 60000
    )
    throw new AuthError(
      `Compte verrouillé. Réessayez dans ${remaining} minute(s).`,
      423
    )
  }

  // Map and validate role
  const role = mapRole(user.role)

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    entrepriseId: user.entrepriseId,
    isSuperAdmin: role === 'SUPER_ADMIN',
    twoFactorEnabled: (user.twoFactorEnabled as boolean) ?? false,
    premiereConnexion: (user.premiereConnexion as boolean) ?? false,
  }
}

/**
 * Same as requireAuth, but additionally ensures the user has an entrepriseId.
 * Use this for any tenant-scoped operations (e.g. accessing entreprise resources).
 *
 * @throws AuthError (401) if not authenticated
 * @throws ForbiddenError (403) if user has no enterprise assigned
 */
export async function requireTenantContext(request: NextRequest): Promise<TenantContext> {
  const ctx = await requireAuth(request)

  if (!ctx.entrepriseId) {
    throw new ForbiddenError(
      'Aucune entreprise assignée. Contactez votre administrateur.',
      403
    )
  }

  return ctx
}

/**
 * Auth + minimum role check.
 * Ensures the authenticated user has at least the specified role level.
 *
 * @throws AuthError (401) if not authenticated
 * @throws ForbiddenError (403) if role is insufficient
 */
export async function requireMinimumRole(
  request: NextRequest,
  minimumRole: UserRole
): Promise<TenantContext> {
  const ctx = await requireAuth(request)

  // Import getRoleLevel to avoid circular dependency
  const { getRoleLevel } = await import('@/lib/rbac')
  const currentLevel = getRoleLevel(ctx.role)
  const requiredLevel = getRoleLevel(minimumRole)

  if (currentLevel < requiredLevel) {
    throw new ForbiddenError(
      `Accès refusé. Rôle minimum requis : ${minimumRole}.`,
      403
    )
  }

  return ctx
}

/**
 * Requires GERANT or SUPER_ADMIN role.
 * Use for administrative operations within the platform.
 *
 * @throws AuthError (401) if not authenticated
 * @throws ForbiddenError (403) if admin
 */
export async function requireAdmin(request: NextRequest): Promise<TenantContext> {
  return requireMinimumRole(request, 'GERANT')
}

/**
 * Requires SUPER_ADMIN role only.
 * Use for platform-level administration operations.
 *
 * @throws AuthError (401) if not authenticated
 * @throws ForbiddenError (403) if not super admin
 */
export async function requireSuperAdmin(request: NextRequest): Promise<TenantContext> {
  return requireMinimumRole(request, 'SUPER_ADMIN')
}
