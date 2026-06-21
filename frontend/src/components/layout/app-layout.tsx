'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore, type SidebarMode } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  Wallet,
  Package,
  PieChart,
  CalendarRange,
  FileText,
  Camera,
  FileStack,
  UserCog,
  Settings,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Sidebar,
  ChevronsLeft,
  ChevronsRight,
  Truck,
  Fuel,
  ShieldCheck,
  Shield,
  Contact,
  FileSpreadsheet,
  FileSignature,
  Receipt,
  Headphones,
  CreditCard,
  LifeBuoy,
  KeyRound,
  Crown,
  ListChecks,
} from 'lucide-react'
import { useSession } from '@/lib/auth-session'
import { canAccessPage, getRolePages } from '@/lib/rbac'
import type { UserRole, AppPage } from '@/lib/rbac'
import { SearchCommand } from './search-command'
import { UserMenu } from './user-menu'
import { NotificationBell } from './notification-bell'
import { OpucLogo } from './opuc-logo'

/* ═══════════════════════════════════════════════
   Navigation grouping — sidebar categories
   ═══════════════════════════════════════════════ */

/** Predicate pour autoriser l'affichage d'un item selon le contexte utilisateur (role + isCoGerant). */
interface NavVisibilityContext {
  role?: UserRole
  isCoGerant?: boolean
}

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  /** Custom href (defaults to `/${id}`). Used for nested routes like /admin/entreprises. */
  href?: string
  /** Restrict to specific roles. If omitted, RBAC `canAccessPage` is used (when id maps to an AppPage). */
  requiredRoles?: UserRole[]
  /** Predicate customisé pour l'affichage (ex: GERANT principal uniquement). */
  canShow?: (ctx: NavVisibilityContext) => boolean
}

interface NavSection {
  group: string
  items: NavItem[]
}

/** Mapping domaine → modules de la sidebar. Utilisé pour afficher le badge "D". */
const DOMAIN_MODULES: Record<string, string[]> = {
  FINANCE: ['facturation', 'contrats', 'paie', 'budget'],
  RH: ['personnel', 'pointage', 'paie'],
  LOGISTIQUE: ['stocks', 'carburant', 'engins', 'sous-traitants'],
  COMMERCIAL: ['clients', 'devis', 'contrats'],
  CHANTIER: ['chantiers', 'planning'],
  DOCUMENTS: ['documents', 'photos', 'rapports'],
}

interface DelegationLite {
  id: string
  domain: string
  permissions: string
  statut: string
  expiresLe: string | null
}

const navSections: NavSection[] = [
  {
    group: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Gestion Chantier',
    items: [
      { id: 'chantiers', label: 'Chantiers', icon: Building2 },
      { id: 'mes-taches', label: 'Mes Tâches', href: '/mes-taches', icon: ListChecks },
      { id: 'planning', label: 'Planning', icon: CalendarRange },
      { id: 'pointage', label: 'Pointage', icon: ClipboardList },
    ],
  },
  {
    group: 'Ressources Humaines',
    items: [
      { id: 'personnel', label: 'Personnel', icon: Users },
      { id: 'paie', label: 'Paie', icon: Wallet },
      { id: 'sous-traitants', label: 'Sous-traitants', icon: UserCog },
    ],
  },
  {
    group: 'Logistique & Finance',
    items: [
      { id: 'budget', label: 'Budget', icon: PieChart },
      { id: 'stocks', label: 'Stocks', icon: Package },
      { id: 'engins', label: 'Parc Engins', icon: Truck },
      { id: 'carburant', label: 'Carburant', icon: Fuel },
    ],
  },
  {
    group: 'Gestion Commerciale',
    items: [
      { id: 'clients', label: 'Clients', icon: Contact },
      { id: 'devis', label: 'Devis', icon: FileSpreadsheet },
      { id: 'contrats', label: 'Contrats', icon: FileSignature },
      { id: 'facturation', label: 'Facturation', icon: Receipt },
    ],
  },
  {
    group: 'Documents & Médias',
    items: [
      { id: 'rapports', label: 'Rapports', icon: FileText },
      { id: 'photos', label: 'Photos', icon: Camera },
      { id: 'documents', label: 'Documents', icon: FileStack },
      { id: 'support', label: 'Support', icon: Headphones },
    ],
  },
  {
    // 🏢 Plateforme — SUPER_ADMIN only (filtered via requiredRoles)
    group: 'Plateforme',
    items: [
      { id: 'admin-plateforme', label: 'Dashboard', icon: LayoutDashboard, requiredRoles: ['SUPER_ADMIN'] },
      { id: 'admin-entreprises', label: 'Entreprises', href: '/admin/entreprises', icon: Building2, requiredRoles: ['SUPER_ADMIN'] },
      { id: 'admin-subscriptions', label: 'Abonnements', href: '/admin/subscriptions', icon: CreditCard, requiredRoles: ['SUPER_ADMIN'] },
      { id: 'admin-support-access', label: 'Support Access', href: '/admin/support-access', icon: LifeBuoy, requiredRoles: ['SUPER_ADMIN'] },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { id: 'gestion-acces', label: 'Gestion des Accès', icon: ShieldCheck },
      { id: 'acces-support', label: 'Accès Support', href: '/parametres/acces-support', icon: Shield, requiredRoles: ['GERANT', 'SUPER_ADMIN'] },
      {
        id: 'delegations',
        label: 'Délégations',
        href: '/parametres/delegations',
        icon: KeyRound,
        canShow: (ctx) => {
          // GERANT, SUPER_ADMIN, ou co-GERANT (CHEF_PROJET avec isCoGerant=true)
          return ctx.role === 'GERANT' || ctx.role === 'SUPER_ADMIN' || ctx.isCoGerant === true
        },
      },
      {
        id: 'co-gerant',
        label: 'Co-Gérant',
        href: '/parametres/co-gerant',
        icon: Crown,
        canShow: (ctx) => {
          // GERANT principal uniquement (pas un co-GERANT, pas SUPER_ADMIN)
          return ctx.role === 'GERANT' && !ctx.isCoGerant
        },
      },
      { id: 'parametres', label: 'Paramètres', icon: Settings },
    ],
  },
]

// Flat list for header breadcrumb lookup
const navItems: NavItem[] = navSections.flatMap((s) => s.items)

interface AppLayoutProps {
  children: React.ReactNode
}

/* ═══════════════════════════════════════════════
   Sidebar Content — adapts to expanded / compact
   ═══════════════════════════════════════════════ */
function SidebarContent({
  mode,
  onNavigate,
  myDelegations = [],
}: {
  mode: 'expanded' | 'compact'
  onNavigate: () => void
  myDelegations?: DelegationLite[]
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as UserRole | undefined
  const fonction = (session?.user as any)?.fonction as string | undefined
  const isCoGerant = (session?.user as any)?.isCoGerant === true
  const compact = mode === 'compact'

  // EMPLOYE (et legacy SOUS_TRAITANT) sont restreints par fonction :
  // - `null`    → pas de filtre par fonction (rôles supérieurs, RBAC normal)
  // - `string[]`→ liste blanche des page-ids autorisés pour cet EMPLOYE
  const allowedPages = getRolePages(userRole, fonction)

  // Calcule l'ensemble des module-ids couverts par au moins une délégation active.
  const delegatedModuleIds = useMemo(() => {
    const set = new Set<string>()
    for (const d of myDelegations) {
      if (d.statut !== 'ACTIF') continue
      // expire si date passée → on ignore (le backend marquera EXPIRE plus tard)
      if (d.expiresLe && new Date(d.expiresLe).getTime() < Date.now()) continue
      const mods = DOMAIN_MODULES[d.domain]
      if (mods) mods.forEach((m) => set.add(m))
    }
    return set
  }, [myDelegations])

  // Filter nav sections based on user's role + RBAC permissions.
  //
  // Priorité des filtres (du plus restrictif au moins restrictif) :
  // 1. allowedPages (SUPER_ADMIN / EMPLOYE) : whitelist stricte — si l'item
  //    n'est pas dans la liste, il est masqué QUELLE QUE SOIT la raison
  //    (canShow, requiredRoles, canAccessPage). C'est la priorité absolue
  //    car SUPER_ADMIN ne doit voir QUE les pages admin, et EMPLOYE ne
  //    doit voir QUE les pages de sa fonction.
  // 2. canShow : predicate customisé (ex: GERANT principal uniquement)
  // 3. requiredRoles : whitelist de rôles
  // 4. canAccessPage : fallback RBAC (niveau minimum par page)
  // 5. Items sans filtre → visibles par défaut
  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (!userRole) return false

        // 1. Whitelist stricte (SUPER_ADMIN / EMPLOYE) — priorité absolue
        if (allowedPages) {
          const pageId = item.href ? item.href.replace(/^\//, '') : item.id
          if (!allowedPages.includes(pageId)) return false
        }

        // 2. canShow (predicate customisé)
        if (item.canShow) return item.canShow({ role: userRole, isCoGerant })

        // 3. requiredRoles (whitelist de rôles)
        if (item.requiredRoles) return item.requiredRoles.includes(userRole)

        // 4. canAccessPage (fallback RBAC niveau minimum)
        const knownPages: string[] = [
          'dashboard', 'chantiers', 'planning', 'pointage', 'personnel', 'paie',
          'sous-traitants', 'budget', 'stocks', 'engins', 'carburant', 'rapports',
          'photos', 'documents', 'clients', 'devis', 'contrats', 'facturation',
          'support', 'parametres', 'gestion-acces', 'admin-plateforme',
        ]
        if (knownPages.includes(item.id)) {
          if (!canAccessPage(userRole, item.id as AppPage)) return false
        }

        // 5. Default : visible
        return true
      })
    }))
    .filter(section => section.items.length > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 shrink-0',
        compact ? 'p-3 justify-center' : 'p-4'
      )}>
        <OpucLogo size={compact ? 36 : 42} className="shrink-0" />
        {!compact && (
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-sidebar-foreground tracking-tight">O.P.U.C.</h1>
            <p className="text-xs text-sidebar-foreground/50 leading-tight font-medium">Pilotage de Chantier</p>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation — grouped by category (RBAC-filtered) */}
      <ScrollArea className="flex-1 overflow-hidden px-2">
        <nav className="py-1">
          {filteredSections.map((section, sIdx) => (
            <div key={section.group} className={cn(sIdx > 0 && 'mt-1.5')}>
              {/* Category header — expanded mode */}
              {!compact && (
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30 select-none">
                  {section.group}
                </p>
              )}
              {/* Compact separator dot */}
              {compact && sIdx > 0 && (
                <div className="flex justify-center py-1">
                  <div className="w-1 h-1 rounded-full bg-sidebar-foreground/15" />
                </div>
              )}
              {/* Items */}
              <div className="space-y-px">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const itemHref = item.href || `/${item.id}`
                  const isActive =
                    pathname === itemHref || pathname.startsWith(`${itemHref}/`)
                  const hasDelegation = delegatedModuleIds.has(item.id)
                  return (
                    <Tooltip key={item.id} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          href={itemHref}
                          onClick={onNavigate}
                          className={cn(
                            'w-full flex items-center rounded-lg transition-all duration-200',
                            compact
                              ? 'justify-center px-0 py-2 mx-auto w-10 h-10 relative'
                              : 'gap-3 px-3 py-1.5 text-[14px]',
                            isActive
                              ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 font-medium shadow-sm border border-amber-500/10'
                              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                          )}
                        >
                          <div className={cn(
                            'flex items-center justify-center shrink-0 transition-colors',
                            compact ? 'w-8 h-8' : 'w-7 h-7 rounded-lg',
                            isActive ? 'bg-amber-500/20' : 'bg-transparent'
                          )}>
                            <Icon className={cn(
                              compact ? 'w-4.5 h-4.5' : 'w-4 h-4',
                              isActive ? 'text-amber-400' : 'text-sidebar-foreground/50'
                            )} />
                          </div>
                          {!compact && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {hasDelegation && (
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <span className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                                      D
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" sideOffset={4}>
                                    <p>Module délégué</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!hasDelegation && isActive && (
                                <ChevronRight className="w-4 h-4 ml-auto text-amber-400/50" />
                              )}
                            </>
                          )}
                          {compact && hasDelegation && (
                            <span
                              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 border border-sidebar"
                              aria-label="Module délégué"
                            />
                          )}
                        </Link>
                      </TooltipTrigger>
                      {compact && (
                        <TooltipContent side="right" sideOffset={8} className="font-medium text-[15px]">
                          {item.label}
                          {hasDelegation && ' (délégué)'}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Sidebar mode toggle at bottom */}
      <div className={cn('shrink-0 p-2', compact ? 'flex justify-center' : 'px-1')}>
        <SidebarModeToggle />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Sidebar Mode Toggle — 3 options
   ═══════════════════════════════════════════════ */
const modeOptions: { mode: SidebarMode; label: string; description: string; icon: React.ElementType }[] = [
  { mode: 'expanded', label: 'Étendue', description: 'Icônes + textes', icon: ChevronsLeft },
  { mode: 'compact', label: 'Compacte', description: 'Icônes uniquement', icon: Sidebar },
  { mode: 'hidden', label: 'Masquée', description: 'Barre latérale fermée', icon: PanelLeftOpen },
]

function SidebarModeToggle() {
  const { sidebarMode, setSidebarMode } = useAppStore()

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-sidebar-accent/50">
      {modeOptions.map((opt) => {
        const Icon = opt.icon
        const active = sidebarMode === opt.mode
        return (
          <Tooltip key={opt.mode} delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarMode(opt.mode)}
                className={cn(
                  'flex items-center justify-center rounded-md transition-all duration-200 cursor-pointer',
                  active
                    ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                    : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent'
                )}
                title={opt.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="text-center">
                <p className="font-semibold text-[15px]">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Hidden Sidebar — floating toggle button
   ═══════════════════════════════════════════════ */
function SidebarToggleFloat() {
  const { setSidebarMode } = useAppStore()

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarMode('expanded')}
          className="h-9 w-9 rounded-lg shadow-sm border-border/60 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/30 dark:hover:text-amber-400"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <p className="font-medium">Afficher la barre latérale</p>
      </TooltipContent>
    </Tooltip>
  )
}

/* ═══════════════════════════════════════════════
   Main App Layout
   ═══════════════════════════════════════════════ */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, toggleSidebar, sidebarMode, setSidebarMode } = useAppStore()
  const { data: session } = useSession()

  // Fetch des délégations reçues par l'utilisateur courant (pour le badge "D").
  // On ne fetch qu'une seule fois au montage, et on refetch quand l'utilisateur
  // revient sur une page de l'app (focus + intervalle léger).
  const [myDelegations, setMyDelegations] = useState<DelegationLite[]>([])
  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/delegations/my', { credentials: 'same-origin' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        // L'API peut retourner soit un tableau, soit { delegations: [...] }, soit { data: [...] }
        const list: any[] = Array.isArray(data)
          ? data
          : data?.delegations || data?.data || []
        setMyDelegations(list.map((d: any) => ({
          id: d.id,
          domain: d.domain,
          permissions: d.permissions,
          statut: d.statut,
          expiresLe: d.expiresLe,
        })))
      } catch {
        // Silencieux : le badge n'est qu'une convenance visuelle.
      }
    }
    load()
    return () => { cancelled = true }
  }, [session?.user])

  // Derive the current page from the URL — App Router is now the source of
  // truth for navigation (replaces the old `currentView` Zustand state).
  // Supports custom `href` (e.g. /admin/entreprises).
  const currentPage = navItems.find((item) => {
    const href = item.href || `/${item.id}`
    return pathname === href || pathname.startsWith(`${href}/`)
  })
  const pageLabel = currentPage?.label || 'Tableau de bord'
  const PageIcon = currentPage?.icon || LayoutDashboard

  const isHidden = sidebarMode === 'hidden'
  const isCompact = sidebarMode === 'compact'
  const sidebarW = isCompact ? 68 : 260

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isHidden && (
        <aside
          className={cn(
            'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border z-30 transition-all duration-300 ease-in-out',
          )}
          style={{ width: sidebarW }}
        >
          <SidebarContent mode={isCompact ? 'compact' : 'expanded'} onNavigate={() => {}} myDelegations={myDelegations} />
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-72 bg-sidebar z-50 lg:hidden transition-transform duration-300 ease-in-out shadow-2xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute top-3 right-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent mode="expanded" onNavigate={() => setSidebarOpen(false)} myDelegations={myDelegations} />
      </aside>

      {/* Main content area */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300 ease-in-out',
          !isHidden && 'lg:pl-[260px]',
          isCompact && !isHidden && 'lg:pl-[68px]'
        )}
      >
        {/* ══════════ TOP HEADER ══════════ */}
        <header className="sticky top-0 z-20 h-16 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Left: hamburger + mobile logo + sidebar toggle + breadcrumb */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden h-10 w-10 hover:bg-muted/70"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Desktop: sidebar toggle (when sidebar exists) or re-open button (when hidden) */}
              <div className="hidden lg:block">
                {isHidden ? (
                  <SidebarToggleFloat />
                ) : (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarMode(isCompact ? 'expanded' : 'hidden')}
                        className="h-9 w-9 hover:bg-muted/70 text-muted-foreground"
                      >
                        {isCompact ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <p className="font-medium">{isCompact ? 'Développer la barre latérale' : 'Masquer la barre latérale'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Mobile logo */}
              <div className="lg:hidden flex items-center gap-2">
                <OpucLogo size={32} className="shrink-0" />
                <span className="font-bold text-[15px] text-foreground">O.P.U.C.</span>
              </div>

              {/* Breadcrumb - visible on desktop */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Accueil</span>
                <span className="text-muted-foreground/30">/</span>
                <div className="flex items-center gap-1.5">
                  <PageIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-[15px] font-medium text-foreground">{pageLabel}</span>
                </div>
              </div>
            </div>

            {/* Center: Search bar */}
            <div className="hidden md:flex flex-1 justify-center max-w-lg mx-6">
              <SearchCommand />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              {/* Mobile search trigger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
                  document.dispatchEvent(event)
                }}
                className="md:hidden h-10 w-10 hover:bg-muted/70"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </Button>

              {/* Notifications */}
              <NotificationBell />

              {/* Separator */}
              <div className="hidden sm:block w-px h-7 bg-border mx-1.5" />

              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* ══════════ PAGE CONTENT ══════════ */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
