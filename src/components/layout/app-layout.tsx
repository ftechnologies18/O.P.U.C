'use client'

import { useAppStore } from '@/store/app-store'
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
  HardHat,
} from 'lucide-react'
import { SearchCommand } from './search-command'
import { UserMenu } from './user-menu'
import { NotificationBell } from './notification-bell'

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'chantiers', label: 'Chantiers', icon: Building2 },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'pointage', label: 'Pointage', icon: ClipboardList },
  { id: 'paie', label: 'Paie', icon: Wallet },
  { id: 'stocks', label: 'Stocks', icon: Package },
  { id: 'budget', label: 'Budget', icon: PieChart },
  { id: 'planning', label: 'Planning', icon: CalendarRange },
  { id: 'rapports', label: 'Rapports', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'documents', label: 'Documents', icon: FileStack },
  { id: 'sous-traitants', label: 'Sous-traitants', icon: UserCog },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
]

interface AppLayoutProps {
  children: React.ReactNode
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { currentView, setCurrentView } = useAppStore()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25">
          <HardHat className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-sidebar-foreground tracking-tight">O.P.U.C.</h1>
          <p className="text-xs text-sidebar-foreground/50 leading-tight font-medium">Pilotage de Chantier</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setCurrentView(item.id)
                      onNavigate()
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-300 font-medium shadow-sm border border-amber-500/10'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isActive ? 'bg-amber-500/20' : 'bg-transparent'
                    )}>
                      <Icon className={cn('w-4.5 h-4.5', isActive ? 'text-amber-400' : 'text-sidebar-foreground/50')} />
                    </div>
                    <span className="truncate">{item.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-amber-400/50" />}
                  </button>
                </TooltipTrigger>
              </Tooltip>
            )
          })}
        </nav>
      </ScrollArea>

    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, currentView } = useAppStore()

  // Current page label
  const currentPage = navItems.find((item) => item.id === currentView)
  const pageLabel = currentPage?.label || 'Tableau de bord'
  const PageIcon = currentPage?.icon || LayoutDashboard

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
        <SidebarContent onNavigate={() => {}} />
      </aside>

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
        <SidebarContent onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:pl-[260px]">
        {/* ══════════ TOP HEADER ══════════ */}
        <header className="sticky top-0 z-20 h-16 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Left: hamburger + mobile logo + breadcrumb */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden h-10 w-10 hover:bg-muted/70"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Mobile logo */}
              <div className="lg:hidden flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                  <HardHat className="w-4 h-4" />
                </div>
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
                  // Trigger Cmd+K search on mobile
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
