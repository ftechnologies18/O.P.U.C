import { create } from 'zustand'

interface AppState {
  currentView: string
  selectedChantierId: string | null
  sidebarOpen: boolean
  setCurrentView: (view: string) => void
  setSelectedChantierId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedChantierId: null,
  sidebarOpen: false,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedChantierId: (id) => set({ selectedChantierId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
