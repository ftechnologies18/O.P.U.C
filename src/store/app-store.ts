import { create } from 'zustand'

export type SidebarMode = 'expanded' | 'compact' | 'hidden'

interface AppState {
  currentView: string
  selectedChantierId: string | null
  sidebarOpen: boolean
  sidebarMode: SidebarMode
  setCurrentView: (view: string) => void
  setSelectedChantierId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarMode: (mode: SidebarMode) => void
  cycleSidebarMode: () => void
}

function getInitialSidebarMode(): SidebarMode {
  if (typeof window === 'undefined') return 'expanded'
  try {
    const saved = localStorage.getItem('opuc-sidebar-mode')
    if (saved === 'expanded' || saved === 'compact' || saved === 'hidden') return saved
  } catch {}
  return 'expanded'
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'dashboard',
  selectedChantierId: null,
  sidebarOpen: false,
  sidebarMode: getInitialSidebarMode(),

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
}))
