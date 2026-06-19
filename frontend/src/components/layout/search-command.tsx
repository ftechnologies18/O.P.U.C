'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
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
  Search,
} from 'lucide-react'

const NAV_PAGES = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'Navigation' },
  { id: 'chantiers', label: 'Chantiers', icon: Building2, group: 'Navigation' },
  { id: 'personnel', label: 'Personnel', icon: Users, group: 'Navigation' },
  { id: 'pointage', label: 'Pointage', icon: ClipboardList, group: 'Navigation' },
  { id: 'paie', label: 'Paie hebdomadaire', icon: Wallet, group: 'Navigation' },
  { id: 'stocks', label: 'Stocks & Matériaux', icon: Package, group: 'Navigation' },
  { id: 'budget', label: 'Budget', icon: PieChart, group: 'Navigation' },
  { id: 'planning', label: 'Planning (Gantt)', icon: CalendarRange, group: 'Navigation' },
  { id: 'rapports', label: 'Rapports journaliers', icon: FileText, group: 'Navigation' },
  { id: 'photos', label: 'Photothèque', icon: Camera, group: 'Navigation' },
  { id: 'documents', label: 'Documents', icon: FileStack, group: 'Navigation' },
  { id: 'sous-traitants', label: 'Sous-traitants', icon: UserCog, group: 'Navigation' },
  { id: 'parametres', label: 'Paramètres', icon: Settings, group: 'Navigation' },
]

const QUICK_ACTIONS = [
  { id: 'pointage', label: 'Nouveau pointage', icon: ClipboardList, group: 'Actions rapides' },
  { id: 'stocks', label: 'Gérer les stocks', icon: Package, group: 'Actions rapides' },
  { id: 'rapports', label: 'Rédiger un rapport', icon: FileText, group: 'Actions rapides' },
  { id: 'photos', label: 'Ajouter une photo', icon: Camera, group: 'Actions rapides' },
]

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleNavigate = (viewId: string) => {
    router.push(`/${viewId}`)
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button - inline search bar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 w-full max-w-md h-10 px-3.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 text-muted-foreground transition-colors cursor-pointer group"
      >
        <Search className="w-4 h-4 shrink-0 group-hover:text-amber-500 transition-colors" />
        <span className="text-[15px] text-muted-foreground/70 flex-1 text-left">
          Rechercher...
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-1 h-6 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-muted-foreground shadow-sm">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher une page, une action..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

          <CommandGroup heading="Actions rapides">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <CommandItem
                  key={`action-${action.id}`}
                  value={`action-${action.label}`}
                  onSelect={() => handleNavigate(action.id)}
                  className="text-[15px] py-3"
                >
                  <Icon className="w-4.5 h-4.5 mr-2 text-amber-500" />
                  <span>{action.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {NAV_PAGES.map((page) => {
              const Icon = page.icon
              return (
                <CommandItem
                  key={page.id}
                  value={page.label}
                  onSelect={() => handleNavigate(page.id)}
                  className="text-[15px] py-3"
                >
                  <Icon className="w-4.5 h-4.5 mr-2 text-muted-foreground" />
                  <span>{page.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
