// ─────────────────────────────────────────────────────────────
// O.P.U.C — RBAC (Role-Based Access Control) Permission System
// Inspired by CATS repository pattern
// Pure logic — can be used on both server and client
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type UserRole =
  | 'SUPER_ADMIN'
  | 'GERANT'
  | 'ADMIN_ENTREPRISE'
  | 'CONDUCTEUR'
  | 'CHEF_CHANTIER'
  | 'SOUS_TRAITANT'

export type PermissionLevel = 'AUCUN' | 'LECTURE' | 'ECRITURE' | 'GESTION'

export type AppPage =
  | 'dashboard'
  | 'chantiers'
  | 'planning'
  | 'pointage'
  | 'personnel'
  | 'paie'
  | 'sous-traitants'
  | 'budget'
  | 'stocks'
  | 'engins'
  | 'carburant'
  | 'rapports'
  | 'photos'
  | 'documents'
  | 'parametres'
  | 'gestion-acces'
  | 'admin-plateforme'

export type SettingsCategory = 'general' | 'securite' | 'notifications' | 'apparence'

export type AppFeature =
  | 'notifications'
  | 'search'
  | 'profile'
  | 'export-csv'
  | 'audit-log'
  | 'permission-management'
  | 'user-management'
  | 'enterprise-settings'
  | 'platform-admin'
  | '2fa-setup'
  | 'invitation'

// ═══════════════════════════════════════════════════════════
// ROLE HIERARCHY (numeric levels)
// Higher number = more privilege
// ═══════════════════════════════════════════════════════════

const ROLE_LEVELS: Record<UserRole, number> = {
  SOUS_TRAITANT: 1,
  CHEF_CHANTIER: 2,
  CONDUCTEUR: 3,
  ADMIN_ENTREPRISE: 4,
  GERANT: 5,
  SUPER_ADMIN: 6,
}

// ═══════════════════════════════════════════════════════════
// PERMISSION MATRIX 1: PAGE ACCESS
// Maps each AppPage to the minimum role level required.
// ═══════════════════════════════════════════════════════════

const PAGE_ACCESS: Record<AppPage, number> = {
  dashboard: 1,          // everyone
  chantiers: 1,          // everyone
  planning: 1,           // everyone
  pointage: 1,           // everyone
  personnel: 1,          // everyone
  paie: 2,               // CHEF_CHANTIER+
  'sous-traitants': 2,   // CHEF_CHANTIER+
  budget: 2,             // CHEF_CHANTIER+
  stocks: 1,             // everyone
  engins: 1,             // everyone
  carburant: 1,          // everyone
  rapports: 1,           // everyone
  photos: 1,             // everyone
  documents: 1,          // everyone
  parametres: 3,         // CONDUCTEUR+
  'gestion-acces': 5,    // GERANT+ only
  'admin-plateforme': 6, // SUPER_ADMIN only
}

// ═══════════════════════════════════════════════════════════
// PERMISSION MATRIX 2: SETTINGS ACCESS
// Maps each SettingsCategory to the minimum role level required.
// ═══════════════════════════════════════════════════════════

const SETTINGS_ACCESS: Record<SettingsCategory, number> = {
  general: 3,        // CONDUCTEUR+
  securite: 4,       // ADMIN_ENTREPRISE+
  notifications: 1,  // everyone
  apparence: 1,      // everyone
}

// ═══════════════════════════════════════════════════════════
// PERMISSION MATRIX 3: FEATURE ACCESS
// Maps each AppFeature to the minimum role level required.
// ═══════════════════════════════════════════════════════════

const FEATURE_ACCESS: Record<AppFeature, number> = {
  notifications: 1,            // everyone
  search: 1,                   // everyone
  profile: 1,                  // everyone
  'export-csv': 2,             // CHEF_CHANTIER+
  'audit-log': 4,              // ADMIN_ENTREPRISE+
  'permission-management': 5,  // GERANT+
  'user-management': 4,        // ADMIN_ENTREPRISE+
  'enterprise-settings': 5,    // GERANT+
  'platform-admin': 6,         // SUPER_ADMIN only
  '2fa-setup': 1,              // everyone (self-setup)
  invitation: 4,               // ADMIN_ENTREPRISE+
}

// ═══════════════════════════════════════════════════════════
// MODULE PERMISSION DEFAULTS
// Maps each of the 16 application modules to a default
// PermissionLevel per role. Used for fine-grained permissions.
// ═══════════════════════════════════════════════════════════

type AppModule =
  | 'chantiers'
  | 'planning'
  | 'pointage'
  | 'personnel'
  | 'paie'
  | 'sous-traitants'
  | 'budget'
  | 'stocks'
  | 'engins'
  | 'carburant'
  | 'rapports'
  | 'photos'
  | 'documents'
  | 'parametres'
  | 'gestion-acces'
  | 'admin-plateforme'

const MODULE_PERMISSIONS: Record<UserRole, Record<AppModule, PermissionLevel>> = {
  SUPER_ADMIN: {
    chantiers: 'GESTION',
    planning: 'GESTION',
    pointage: 'GESTION',
    personnel: 'GESTION',
    paie: 'GESTION',
    'sous-traitants': 'GESTION',
    budget: 'GESTION',
    stocks: 'GESTION',
    engins: 'GESTION',
    carburant: 'GESTION',
    rapports: 'GESTION',
    photos: 'GESTION',
    documents: 'GESTION',
    parametres: 'GESTION',
    'gestion-acces': 'GESTION',
    'admin-plateforme': 'GESTION',
  },

  GERANT: {
    chantiers: 'GESTION',
    planning: 'GESTION',
    pointage: 'GESTION',
    personnel: 'GESTION',
    paie: 'GESTION',
    'sous-traitants': 'GESTION',
    budget: 'GESTION',
    stocks: 'GESTION',
    engins: 'GESTION',
    carburant: 'GESTION',
    rapports: 'GESTION',
    photos: 'GESTION',
    documents: 'GESTION',
    parametres: 'GESTION',
    'gestion-acces': 'GESTION',
    'admin-plateforme': 'AUCUN',
  },

  ADMIN_ENTREPRISE: {
    chantiers: 'GESTION',
    planning: 'GESTION',
    pointage: 'GESTION',
    personnel: 'GESTION',
    paie: 'GESTION',
    'sous-traitants': 'GESTION',
    budget: 'GESTION',
    stocks: 'GESTION',
    engins: 'GESTION',
    carburant: 'GESTION',
    rapports: 'GESTION',
    photos: 'GESTION',
    documents: 'GESTION',
    parametres: 'ECRITURE',
    'gestion-acces': 'ECRITURE',
    'admin-plateforme': 'AUCUN',
  },

  CONDUCTEUR: {
    chantiers: 'ECRITURE',
    planning: 'ECRITURE',
    pointage: 'LECTURE',
    personnel: 'LECTURE',
    paie: 'LECTURE',
    'sous-traitants': 'LECTURE',
    budget: 'LECTURE',
    stocks: 'ECRITURE',
    engins: 'ECRITURE',
    carburant: 'ECRITURE',
    rapports: 'LECTURE',
    photos: 'LECTURE',
    documents: 'LECTURE',
    parametres: 'LECTURE',
    'gestion-acces': 'AUCUN',
    'admin-plateforme': 'AUCUN',
  },

  CHEF_CHANTIER: {
    chantiers: 'LECTURE',
    planning: 'LECTURE',
    pointage: 'ECRITURE',
    personnel: 'LECTURE',
    paie: 'LECTURE',
    'sous-traitants': 'LECTURE',
    budget: 'LECTURE',
    stocks: 'LECTURE',
    engins: 'LECTURE',
    carburant: 'LECTURE',
    rapports: 'ECRITURE',
    photos: 'ECRITURE',
    documents: 'ECRITURE',
    parametres: 'LECTURE',
    'gestion-acces': 'AUCUN',
    'admin-plateforme': 'AUCUN',
  },

  SOUS_TRAITANT: {
    chantiers: 'LECTURE',
    planning: 'LECTURE',
    pointage: 'AUCUN',
    personnel: 'AUCUN',
    paie: 'AUCUN',
    'sous-traitants': 'LECTURE',
    budget: 'LECTURE',
    stocks: 'AUCUN',
    engins: 'AUCUN',
    carburant: 'AUCUN',
    rapports: 'LECTURE',
    photos: 'AUCUN',
    documents: 'AUCUN',
    parametres: 'AUCUN',
    'gestion-acces': 'AUCUN',
    'admin-plateforme': 'AUCUN',
  },
}

// ═══════════════════════════════════════════════════════════
// ROLE LABELS (French display names)
// ═══════════════════════════════════════════════════════════

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  GERANT: 'Gérant',
  ADMIN_ENTREPRISE: "Admin d'Entreprise",
  CONDUCTEUR: 'Conducteur de Travaux',
  CHEF_CHANTIER: 'Chef de Chantier',
  SOUS_TRAITANT: 'Sous-traitant',
}

// ═══════════════════════════════════════════════════════════
// DEFAULT PAGE PER ROLE
// ═══════════════════════════════════════════════════════════

const DEFAULT_PAGES: Record<UserRole, string> = {
  SUPER_ADMIN: 'admin-plateforme',
  GERANT: 'dashboard',
  ADMIN_ENTREPRISE: 'dashboard',
  CONDUCTEUR: 'dashboard',
  CHEF_CHANTIER: 'pointage',
  SOUS_TRAITANT: 'chantiers',
}

// ═══════════════════════════════════════════════════════════
// ROLE BADGE TAILWIND CLASSES
// ═══════════════════════════════════════════════════════════

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  GERANT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  ADMIN_ENTREPRISE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  CONDUCTEUR: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  CHEF_CHANTIER: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  SOUS_TRAITANT: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400 border-stone-200 dark:border-stone-800',
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Check if a given role can access a specific page.
 */
export function canAccessPage(role: UserRole, page: AppPage): boolean {
  const requiredLevel = PAGE_ACCESS[page]
  const currentLevel = ROLE_LEVELS[role]
  return currentLevel >= requiredLevel
}

/**
 * Check if a given role can access a specific settings category.
 */
export function canAccessSettings(role: UserRole, category: SettingsCategory): boolean {
  const requiredLevel = SETTINGS_ACCESS[category]
  const currentLevel = ROLE_LEVELS[role]
  return currentLevel >= requiredLevel
}

/**
 * Check if a given role can access a specific feature.
 */
export function canAccessFeature(role: UserRole, feature: AppFeature): boolean {
  const requiredLevel = FEATURE_ACCESS[feature]
  const currentLevel = ROLE_LEVELS[role]
  return currentLevel >= requiredLevel
}

/**
 * Check if the current role meets or exceeds the minimum role level required.
 */
export function hasMinimumRole(currentRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_LEVELS[currentRole] >= ROLE_LEVELS[minimumRole]
}

/**
 * Get the default landing page for a given role.
 */
export function getDefaultPage(role: UserRole): string {
  return DEFAULT_PAGES[role]
}

/**
 * Get the French display label for a given role.
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role]
}

/**
 * Get Tailwind CSS badge classes for a given role.
 * Returns classes for a bordered badge with role-specific colors.
 */
export function getRoleBadgeClass(role: UserRole): string {
  return ROLE_BADGE_CLASSES[role]
}

/**
 * Get the default PermissionLevel for a specific module given a role.
 * Supports any module string; returns LECTURE as safe default for unknown modules.
 */
export function getModulePermissionLevel(
  role: UserRole,
  module: string
): PermissionLevel {
  const permissions = MODULE_PERMISSIONS[role]
  return (permissions as Record<string, PermissionLevel>)[module] ?? 'LECTURE'
}

/**
 * Get all pages accessible by a given role.
 */
export function getAccessiblePages(role: UserRole): AppPage[] {
  return (Object.keys(PAGE_ACCESS) as AppPage[]).filter((page) =>
    canAccessPage(role, page)
  )
}

/**
 * Get all features accessible by a given role.
 */
export function getAccessibleFeatures(role: UserRole): AppFeature[] {
  return (Object.keys(FEATURE_ACCESS) as AppFeature[]).filter((feature) =>
    canAccessFeature(role, feature)
  )
}

/**
 * Get the numeric level for a role.
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_LEVELS[role]
}

/**
 * Check if a role is an admin-level role (GERANT or SUPER_ADMIN).
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'GERANT' || role === 'SUPER_ADMIN'
}

/**
 * Check if a role is a super admin.
 */
export function isSuperAdminRole(role: UserRole): boolean {
  return role === 'SUPER_ADMIN'
}
