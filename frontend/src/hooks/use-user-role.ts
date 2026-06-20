'use client'
import { useSession } from '@/lib/auth-session'
import { type UserRole, canAccessPage, canAccessFeature, getAccessiblePages, getDefaultPage, getRoleLabel } from '@/lib/rbac'

export function useUserRole() {
  const { data: session, status } = useSession()
  // `role` is typed as the canonical UserRole union, but legacy sessions may
  // still carry the pre-Phase-1 'SOUS_TRAITANT' value until the backend
  // migration completes. We widen to string for the legacy comparisons below.
  const role = (session?.user as any)?.role as UserRole | undefined
  const roleStr = (session?.user as any)?.role as string | undefined

  return {
    role: role ?? ('CHEF_PROJET' as UserRole),
    isLoggedIn: status === 'authenticated',
    isLoading: status === 'loading',
    canAccess: (page: Parameters<typeof canAccessPage>[1]) => role ? canAccessPage(role, page) : false,
    canFeature: (feature: Parameters<typeof canAccessFeature>[1]) => role ? canAccessFeature(role, feature) : false,
    accessiblePages: role ? getAccessiblePages(role) : [],
    defaultPage: role ? getDefaultPage(role) : 'dashboard',
    roleLabel: role ? getRoleLabel(role) : '',
    isSuperAdmin: role === 'SUPER_ADMIN',
    isGerant: role === 'GERANT',
    isAdmin: role === 'GERANT' || role === 'SUPER_ADMIN',
    isChefProjet: role === 'CHEF_PROJET',
    // deprecated alias, use isEmploye — kept for legacy sessions still carrying SOUS_TRAITANT
    isSousTraitant: roleStr === 'SOUS_TRAITANT' || role === 'EMPLOYE',
    isEmploye: roleStr === 'SOUS_TRAITANT' || role === 'EMPLOYE',
    isOperationnel: role === 'CHEF_PROJET' || roleStr === 'SOUS_TRAITANT' || role === 'EMPLOYE',
  }
}
