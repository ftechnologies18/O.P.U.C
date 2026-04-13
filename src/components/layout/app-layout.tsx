'use client'

import { signOut, useSession } from 'next-auth/react'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  LogOut,
  Bell,
  Menu,
  X,
  ChevronRight,
  HardHat,
} from 'lucide-react'
import { useState } from 'react'

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
  const { data: session } = useSession()

  const userInitials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'OP'

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500 text-white font-bold text-sm">
          <HardHat className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">O.P.U.C.</h1>
          <p className="text-sm text-sidebar-foreground/60 leading-tight">Pilotage de Chantier</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User info */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-amber-500/50">
            <AvatarFallback className="bg-amber-600 text-white text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-sidebar-foreground truncate">
              {session?.user?.name || 'Utilisateur'}
            </p>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30">
              {(session?.user as { role: string })?.role?.replace('_', ' ') || 'Rôle'}
            </Badge>
          </div>
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
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id)
                  onNavigate()
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-all duration-200',
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 font-medium shadow-sm'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive && 'text-amber-400')} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto text-amber-400/70" />}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Logout */}
      <div className="p-3">
        <Button
          variant="ghost"
          onClick={() => signOut()}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[15px]">Déconnexion</span>
        </Button>
      </div>
    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useAppStore()
  const [notificationCount] = useState(3)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-72 bg-sidebar z-50 lg:hidden transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute top-3 right-3">
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
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden h-9 w-9"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500 text-white">
                <HardHat className="w-4 h-4" />
              </div>
              <span className="font-bold text-[15px] text-foreground">O.P.U.C.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="w-4.5 h-4.5" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
