'use client'

import {
  FileStack, FileText, Upload, ShieldCheck, FileCheck, Receipt,
  Construction, HardHat,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const plannedFeatures = [
  {
    icon: Upload,
    title: 'Upload de plans',
    description: 'Plans d\'architecture, plans de masse, plans de coffrage et de ferraillage.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Permis de construire',
    description: 'Gestion et suivi des permis de construire, autorisations et validations.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  {
    icon: FileCheck,
    title: 'Contrats signés',
    description: 'Archivage des contrats de travail, contrats de sous-traitance et avenants.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
  },
  {
    icon: FileText,
    title: 'PV de réception',
    description: 'Procès-verbaux de réception des travaux, attachements et réserves.',
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-500/10',
  },
  {
    icon: Receipt,
    title: 'Factures',
    description: 'Factures de matériaux, de sous-traitance et de location d\'engins.',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-500/10',
  },
  {
    icon: Construction,
    title: 'Documentation technique',
    description: 'DTU, normes, notes de calcul, études de sol et rapports géotechniques.',
    color: 'text-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
  },
]

export function DocumentsView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <FileStack className="w-7 h-7 text-amber-500" />
          Documents
        </h2>
        <p className="text-muted-foreground mt-1">
          Centralisez et gérez tous les documents de vos chantiers.
        </p>
      </div>

      {/* Coming soon card */}
      <Card className="border border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/5 dark:to-orange-500/5 shadow-sm">
        <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
          {/* Illustration */}
          <div className="shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/10 rotate-6 scale-95" />
              <div className="absolute inset-0 rounded-2xl bg-amber-500/5 -rotate-3 scale-105" />
              <div className="relative w-28 h-28 rounded-2xl bg-white dark:bg-background border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col items-center justify-center gap-2">
                <HardHat className="w-10 h-10 text-amber-500" />
                <FileStack className="w-6 h-6 text-amber-400" />
              </div>
              {/* Floating docs */}
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shadow-sm">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>
              <div className="absolute -bottom-1 -left-3 w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shadow-sm">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-0">
                Bientôt disponible
              </Badge>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Le module de gestion documentaire sera disponible prochainement.
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Ce module vous permettra de centraliser, organiser et partager tous les documents
              liés à vos chantiers : plans, permis, contrats, factures et bien plus encore.
              Restez connectés pour les mises à jour.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Planned features */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Fonctionnalités prévues
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plannedFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <Card
                key={feature.title}
                className="border shadow-sm hover:shadow-md transition-shadow group"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${feature.bg} shrink-0`}>
                      <Icon className={`w-5 h-5 ${feature.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Astuce :</strong> En attendant, vous pouvez utiliser le module{' '}
            <span className="font-medium text-foreground">Rapports</span> pour documenter
            l&apos;avancement quotidien de vos chantiers.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
