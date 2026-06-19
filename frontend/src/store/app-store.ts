import { create } from 'zustand'
import type { AppPage, UserRole } from '@/lib/rbac'
import { canAccessPage } from '@/lib/rbac'

export type SidebarMode = 'expanded' | 'compact' | 'hidden'

interface AppState {
  currentView: AppPage | 'chantier-detail'
  selectedChantierId: string | null
  sidebarOpen: boolean
  sidebarMode: SidebarMode
  userRole: UserRole | null
  setCurrentView: (view: AppPage | 'chantier-detail') => void
  setSelectedChantierId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarMode: (mode: SidebarMode) => void
  cycleSidebarMode: () => void
  setUserRole: (role: UserRole | null) => void
  getAccessibleViews: () => AppPage[]
}

function getInitialSidebarMode(): SidebarMode {
  if (typeof window === 'undefined') return 'expanded'
  try {
    const saved = localStorage.getItem('opuc-sidebar-mode')
    if (saved === 'expanded' || saved === 'compact' || saved === 'hidden') return saved
  } catch {}
  return 'expanded'
}

function getInitialUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem('opuc-user-role')
    if (saved) return saved as UserRole
  } catch {}
  return null
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'dashboard',
  selectedChantierId: null,
  sidebarOpen: false,
  sidebarMode: getInitialSidebarMode(),
  userRole: getInitialUserRole(),

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedChantierId: (id) => set({ selectedChantierId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarMode: (mode) => {
    try { localStorage.setItem('opuc-sidebar-mode', mode) } catch {}
    set({ sidebarMode: mode })
  },

  cycleSidebarMode: () => {
    const { sidebarMode } = get()
    const next: Record<SidebarMode, SidebarMode> = {
      expanded: 'compact',
      compact: 'hidden',
      hidden: 'expanded',
    }
    const newMode = next[sidebarMode]
    try { localStorage.setItem('opuc-sidebar-mode', newMode) } catch {}
    set({ sidebarMode: newMode })
  },

  setUserRole: (role) => {
    try {
      if (role) {
        localStorage.setItem('opuc-user-role', role)
      } else {
        localStorage.removeItem('opuc-user-role')
      }
    } catch {}
    set({ userRole: role })
  },

  getAccessibleViews: () => {
    const { userRole } = get()
    if (!userRole) return []
    return ([
      'dashboard',
      'chantiers',
      'planning',
      'pointage',
      'personnel',
      'paie',
      'sous-traitants',
      'budget',
      'stocks',
      'engins',
      'carburant',
      'rapports',
      'photos',
      'documents',
      'clients',
      'devis',
      'contrats',
      'facturation',
      'support',
      'parametres',
      'gestion-acces',
      'admin-plateforme',
    ] as AppPage[]).filter((page) => canAccessPage(userRole, page))
  },
}))
