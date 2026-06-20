'use client'
import { useSession } from '@/lib/auth-session'
import { type UserRole, canAccessPage, canAccessFeature, getAccessiblePages, getDefaultPage, getRoleLabel } from '@/lib/rbac'

export function useUserRole() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role as UserRole | undefined

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
    isSousTraitant: role === 'SOUS_TRAITANT',
    // Alias forward-compat (Phase 1: SOUS_TRAITANT interne sera renommé EMPLOYE)
    isEmploye: role === 'SOUS_TRAITANT',
    isOperationnel: role === 'CHEF_PROJET' || role === 'SOUS_TRAITANT',
  }
}
