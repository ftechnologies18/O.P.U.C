// ─────────────────────────────────────────────────────────────
// O.P.U.C — RBAC (Role-Based Access Control) Permission System
// Simplified 4-role architecture for BTP/construction in Côte d'Ivoire
// Pure logic — can be used on both server and client
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type UserRole =
  | 'SUPER_ADMIN'
  | 'GERANT'
  | 'CHEF_PROJET'
  | 'EMPLOYE'

// ─────────────────────────────────────────────────────────────
// FONCTION (BTP functional role for EMPLOYE users)
// Fixed enum of 8 BTP specialisations. Optional on User (nullable
// for legacy users). Used by the GERANT to qualify the employé's
// domain of intervention within the company.
// ─────────────────────────────────────────────────────────────

export type UserFonction =
  | 'CHARGE_LOGISTIQUE'
  | 'CHARGE_CARBURANT'
  | 'CHARGE_PLANNING'
  | 'CHARGE_QUALITE'
  | 'CHARGE_DOCUMENTATION'
  | 'CHARGE_COMMERCIAL'
  | 'CHARGE_RH'
  | 'CHEF_CHANTIER'

export const ALL_FONCTIONS: UserFonction[] = [
  'CHARGE_LOGISTIQUE',
  'CHARGE_CARBURANT',
  'CHARGE_PLANNING',
  'CHARGE_QUALITE',
  'CHARGE_DOCUMENTATION',
  'CHARGE_COMMERCIAL',
  'CHARGE_RH',
  'CHEF_CHANTIER',
]

const FONCTION_LABELS: Record<UserFonction, string> = {
  CHARGE_LOGISTIQUE: 'Chargé de la Logistique',
  CHARGE_CARBURANT: 'Chargé du Carburant',
  CHARGE_PLANNING: 'Chargé du Planning',
  CHARGE_QUALITE: 'Chargé de la Qualité',
  CHARGE_DOCUMENTATION: 'Chargé de la Documentation',
  CHARGE_COMMERCIAL: 'Chargé du Commercial',
  CHARGE_RH: 'Chargé des RH',
  CHEF_CHANTIER: 'Chef de Chantier',
}

// Tailwind badge classes per fonction. No indigo/blue primary per project rule.
export const FONCTION_BADGE_CLASSES: Record<UserFonction, string> = {
  CHARGE_LOGISTIQUE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  CHARGE_CARBURANT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  CHARGE_PLANNING: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  CHARGE_QUALITE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  CHARGE_DOCUMENTATION: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  CHARGE_COMMERCIAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  CHARGE_RH: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  CHEF_CHANTIER: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
}

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
  | 'clients'
  | 'devis'
  | 'contrats'
  | 'facturation'
  | 'support'
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
  EMPLOYE: 1,
  CHEF_PROJET: 2,
  GERANT: 3,
  SUPER_ADMIN: 4,
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
  paie: 1,               // everyone
  'sous-traitants': 1,   // everyone
  budget: 1,             // everyone
  stocks: 1,             // everyone
  engins: 1,             // everyone
  carburant: 1,          // everyone
  rapports: 1,           // everyone
  photos: 1,             // everyone
  documents: 1,          // everyone
  clients: 1,            // everyone
  devis: 1,              // everyone
  contrats: 1,           // everyone
  facturation: 1,        // everyone
  support: 1,            // everyone
  parametres: 2,         // CHEF_PROJET+
  'gestion-acces': 3,    // GERANT+ only
  'admin-plateforme': 4, // SUPER_ADMIN only
}

// ═══════════════════════════════════════════════════════════
// PERMISSION MATRIX 2: SETTINGS ACCESS
// Maps each SettingsCategory to the minimum role level required.
// ═══════════════════════════════════════════════════════════

const SETTINGS_ACCESS: Record<SettingsCategory, number> = {
  general: 2,        // CHEF_PROJET+
  securite: 3,       // GERANT+
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
  'export-csv': 2,             // CHEF_PROJET+
  'audit-log': 3,              // GERANT+
  'permission-management': 3,  // GERANT+
  'user-management': 3,        // GERANT+
  'enterprise-settings': 3,    // GERANT+
  'platform-admin': 4,         // SUPER_ADMIN only
  '2fa-setup': 1,              // everyone (self-setup)
  invitation: 3,               // GERANT+
}

// ═══════════════════════════════════════════════════════════
// MODULE PERMISSION DEFAULTS
// Maps each application module to a default PermissionLevel per role.
// Used for fine-grained permissions.
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
  | 'clients'
  | 'devis'
  | 'contrats'
  | 'facturation'
  | 'support'

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
    clients: 'GESTION',
    devis: 'GESTION',
    contrats: 'GESTION',
    facturation: 'GESTION',
    support: 'GESTION',
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
    clients: 'GESTION',
    devis: 'GESTION',
    contrats: 'GESTION',
    facturation: 'GESTION',
    support: 'GESTION',
    parametres: 'GESTION',
    'gestion-acces': 'GESTION',
    'admin-plateforme': 'AUCUN',
  },

  CHEF_PROJET: {
    chantiers: 'ECRITURE',
    planning: 'ECRITURE',
    pointage: 'ECRITURE',
    personnel: 'LECTURE',
    paie: 'LECTURE',
    'sous-traitants': 'LECTURE',
    budget: 'LECTURE',
    stocks: 'ECRITURE',
    engins: 'ECRITURE',
    carburant: 'ECRITURE',
    rapports: 'ECRITURE',
    photos: 'ECRITURE',
    documents: 'ECRITURE',
    clients: 'ECRITURE',
    devis: 'ECRITURE',
    contrats: 'ECRITURE',
    facturation: 'ECRITURE',
    support: 'ECRITURE',
    parametres: 'LECTURE',
    'gestion-acces': 'AUCUN',
    'admin-plateforme': 'AUCUN',
  },

  EMPLOYE: {
    chantiers: 'LECTURE',
    planning: 'LECTURE',
    pointage: 'LECTURE',
    personnel: 'AUCUN',
    paie: 'AUCUN',
    'sous-traitants': 'LECTURE',
    budget: 'LECTURE',
    stocks: 'LECTURE',
    engins: 'LECTURE',
    carburant: 'LECTURE',
    rapports: 'LECTURE',
    photos: 'LECTURE',
    documents: 'LECTURE',
    clients: 'LECTURE',
    devis: 'LECTURE',
    contrats: 'LECTURE',
    facturation: 'LECTURE',
    support: 'LECTURE',
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
  CHEF_PROJET: 'Chef de Projet',
  EMPLOYE: 'Employé',
}

// ═══════════════════════════════════════════════════════════
// DEFAULT PAGE PER ROLE
// ═══════════════════════════════════════════════════════════

const DEFAULT_PAGES: Record<UserRole, string> = {
  SUPER_ADMIN: 'admin-plateforme',
  GERANT: 'dashboard',
  CHEF_PROJET: 'pointage',
  EMPLOYE: 'dashboard',
}

// ═══════════════════════════════════════════════════════════
// ROLE BADGE TAILWIND CLASSES
// ═══════════════════════════════════════════════════════════

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  GERANT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  CHEF_PROJET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  EMPLOYE: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800',
}

// ═══════════════════════════════════════════════════════════
// ALL EXPORTED ROLE CONSTANTS (for UI components)
// ═══════════════════════════════════════════════════════════

export const ALL_ROLES: UserRole[] = ['SUPER_ADMIN', 'GERANT', 'CHEF_PROJET', 'EMPLOYE']

export const ENTERPRISE_ROLES: UserRole[] = ['GERANT', 'CHEF_PROJET', 'EMPLOYE']

export const ROLES_LIST: string[] = ['GERANT', 'CHEF_PROJET', 'EMPLOYE']

export const DEFAULT_PERMISSIONS: Record<string, Record<string, string>> = {
  GERANT: {
    dashboard: 'GESTION', chantiers: 'GESTION', planning: 'GESTION', pointage: 'GESTION',
    personnel: 'GESTION', paie: 'GESTION', 'sous-traitants': 'GESTION', budget: 'GESTION',
    stocks: 'GESTION', engins: 'GESTION', carburant: 'GESTION', rapports: 'GESTION',
    photos: 'GESTION', documents: 'GESTION', clients: 'GESTION', devis: 'GESTION',
    contrats: 'GESTION', facturation: 'GESTION', support: 'GESTION', parametres: 'GESTION',
    'gestion-acces': 'GESTION',
  },
  CHEF_PROJET: {
    dashboard: 'ECRITURE', chantiers: 'ECRITURE', planning: 'ECRITURE', pointage: 'ECRITURE',
    personnel: 'LECTURE', paie: 'LECTURE', 'sous-traitants': 'LECTURE', budget: 'LECTURE',
    stocks: 'ECRITURE', engins: 'ECRITURE', carburant: 'ECRITURE', rapports: 'ECRITURE',
    photos: 'ECRITURE', documents: 'ECRITURE', clients: 'ECRITURE', devis: 'ECRITURE',
    contrats: 'ECRITURE', facturation: 'ECRITURE', support: 'ECRITURE', parametres: 'LECTURE',
    'gestion-acces': 'AUCUN',
  },
  EMPLOYE: {
    dashboard: 'LECTURE', chantiers: 'LECTURE', planning: 'LECTURE', pointage: 'LECTURE',
    personnel: 'AUCUN', paie: 'AUCUN', 'sous-traitants': 'LECTURE', budget: 'LECTURE',
    stocks: 'LECTURE', engins: 'LECTURE', carburant: 'LECTURE', rapports: 'LECTURE',
    photos: 'LECTURE', documents: 'LECTURE', clients: 'LECTURE', devis: 'LECTURE',
    contrats: 'LECTURE', facturation: 'LECTURE', support: 'LECTURE', parametres: 'AUCUN',
    'gestion-acces': 'AUCUN',
  },
}

export const PERMISSION_MODULES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'chantiers', label: 'Chantiers' },
  { key: 'planning', label: 'Planning' },
  { key: 'pointage', label: 'Pointage' },
  { key: 'personnel', label: 'Personnel' },
  { key: 'paie', label: 'Paie' },
  { key: 'sous-traitants', label: 'Sous-traitants' },
  { key: 'budget', label: 'Budget' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'engins', label: 'Parc Engins' },
  { key: 'carburant', label: 'Carburant' },
  { key: 'rapports', label: 'Rapports' },
  { key: 'photos', label: 'Photos' },
  { key: 'documents', label: 'Documents' },
  { key: 'clients', label: 'Clients' },
  { key: 'devis', label: 'Devis' },
  { key: 'contrats', label: 'Contrats' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'support', label: 'Support' },
  { key: 'parametres', label: 'Paramètres' },
  { key: 'gestion-acces', label: 'Gestion Accès' },
]

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
export function getRoleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] || role.replace('_', ' ')
}

/**
 * Get Tailwind CSS badge classes for a given role.
 * Returns classes for a bordered badge with role-specific colors.
 */
export function getRoleBadgeClass(role: string): string {
  return (ROLE_BADGE_CLASSES as Record<string, string>)[role] || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Get the French display label for a given fonction.
 * Falls back to a humanised version of the raw string if unknown.
 */
export function getFonctionLabel(f: string): string {
  return (FONCTION_LABELS as Record<string, string>)[f] || f.replace(/_/g, ' ')
}

/**
 * Get Tailwind CSS badge classes for a given fonction.
 * Returns classes for a bordered badge with fonction-specific colours.
 */
export function getFonctionBadgeClass(f: string): string {
  return (FONCTION_BADGE_CLASSES as Record<string, string>)[f] || 'bg-gray-100 text-gray-800 border-gray-200'
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
