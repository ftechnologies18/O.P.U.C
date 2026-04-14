'use client'

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
} from 'lucide-react'
import { SearchCommand } from './search-command'
import { UserMenu } from './user-menu'
import { NotificationBell } from './notification-bell'
import { OpucLogo } from './opuc-logo'

/* ═══════════════════════════════════════════════
   Navigation grouping — sidebar categories
   ═══════════════════════════════════════════════ */
const navSections = [
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
    ],
  },
  {
    group: 'Documents & Médias',
    items: [
      { id: 'rapports', label: 'Rapports', icon: FileText },
      { id: 'photos', label: 'Photos', icon: Camera },
      { id: 'documents', label: 'Documents', icon: FileStack },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { id: 'parametres', label: 'Paramètres', icon: Settings },
    ],
  },
]

// Flat list for header breadcrumb lookup
const navItems = navSections.flatMap((s) => s.items)

interface AppLayoutProps {
  children: React.ReactNode
}

/* ═══════════════════════════════════════════════
   Sidebar Content — adapts to expanded / compact
   ═══════════════════════════════════════════════ */
function SidebarContent({
  mode,
  onNavigate,
}: {
  mode: 'expanded' | 'compact'
  onNavigate: () => void
}) {
  const { currentView, setCurrentView } = useAppStore()
  const compact = mode === 'compact'

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

      {/* Navigation — grouped by category */}
      <ScrollArea className="flex-1 overflow-hidden px-2">
        <nav className="py-1">
          {navSections.map((section, sIdx) => (
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
                  const isActive = currentView === item.id
                  return (
                    <Tooltip key={item.id} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            setCurrentView(item.id)
                            onNavigate()
                          }}
                          className={cn(
                            'w-full flex items-center rounded-lg transition-all duration-200',
                            compact
                              ? 'justify-center px-0 py-2 mx-auto w-10 h-10'
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
                              {isActive && <ChevronRight className="w-4 h-4 ml-auto text-amber-400/50" />}
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      {compact && (
                        <TooltipContent side="right" sideOffset={8} className="font-medium text-[15px]">
                          {item.label}
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
  const { sidebarOpen, setSidebarOpen, toggleSidebar, currentView, sidebarMode, setSidebarMode } = useAppStore()

  // Current page label
  const currentPage = navItems.find((item) => item.id === currentView)
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
          <SidebarContent mode={isCompact ? 'compact' : 'expanded'} onNavigate={() => {}} />
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
        <SidebarContent mode="expanded" onNavigate={() => setSidebarOpen(false)} />
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
