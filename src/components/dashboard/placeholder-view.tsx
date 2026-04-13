'use client'

import {
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
  HardHat,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const viewLabels: Record<string, string> = {
  chantiers: 'Chantiers',
  personnel: 'Personnel',
  pointage: 'Pointage',
  paie: 'Paie',
  stocks: 'Stocks',
  budget: 'Budget',
  planning: 'Planning',
  rapports: 'Rapports',
  photos: 'Photos',
  documents: 'Documents',
  'sous-traitants': 'Sous-traitants',
  parametres: 'Paramètres',
}

const viewIcons: Record<string, React.ElementType> = {
  chantiers: Building2,
  personnel: Users,
  pointage: ClipboardList,
  paie: Wallet,
  stocks: Package,
  budget: PieChart,
  planning: CalendarRange,
  rapports: FileText,
  photos: Camera,
  documents: FileStack,
  'sous-traitants': UserCog,
  parametres: Settings,
}

interface PlaceholderViewProps {
  viewId: string
}

export function PlaceholderView({ viewId }: PlaceholderViewProps) {
  const Icon = viewIcons[viewId] || HardHat
  const label = viewLabels[viewId] || viewId

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{label}</h2>
        <p className="text-muted-foreground mt-1">
          Module en cours de développement
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 lg:py-24">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-6">
            <Icon className="w-12 h-12 text-amber-500" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Bientôt disponible</h3>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Le module &quot;{label}&quot; est en cours de développement et sera disponible dans une prochaine mise à jour.
          </p>
          <div className="mt-6 px-4 py-2 rounded-lg bg-muted text-xs text-muted-foreground font-mono">
            Phase 0 — Fondation • Module : {viewId}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
