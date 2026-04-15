'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  User,
  HardHat,
  Layers,
  ClipboardList,
  TrendingUp,
  FolderOpen,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Chantier {
  id: string
  nom: string
  adresse: string | null
  maitreOuvrage: string | null
  dateDebut: string | null
  dateFinPrevue: string | null
  budgetPrevisionnel: number
  statut: string
  description: string | null
  avancementGlobal: number
  _count: {
    phases: number
    journaliers: number
  }
  modeCarburant: string
  createdAt: string
  updatedAt: string
}

interface KpiData {
  total: number
  actifs: number
  enPreparation: number
  termines: number
}

interface FormData {
  nom: string
  adresse: string
  maitreOuvrage: string
  dateDebut: string
  dateFinPrevue: string
  budgetPrevisionnel: string
  description: string
  statut: string
  modeCarburant: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'EN_PREPARATION', label: 'En préparation' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_PAUSE', label: 'En pause' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'RECEPTIONNE', label: 'Réceptionné' },
]

const STATUS_COLORS: Record<string, string> = {
  EN_PREPARATION: 'bg-amber-100 text-amber-700 border-amber-200',
  EN_COURS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_PAUSE: 'bg-orange-100 text-orange-700 border-orange-200',
  TERMINE: 'bg-slate-100 text-slate-700 border-slate-200',
  RECEPTIONNE: 'bg-blue-100 text-blue-700 border-blue-200',
}

const STATUS_LABELS: Record<string, string> = {
  EN_PREPARATION: 'En préparation',
  EN_COURS: 'En cours',
  EN_PAUSE: 'En pause',
  TERMINE: 'Terminé',
  RECEPTIONNE: 'Réceptionné',
}

const EMPTY_FORM: FormData = {
  nom: '',
  adresse: '',
  maitreOuvrage: '',
  dateDebut: '',
  dateFinPrevue: '',
  budgetPrevisionnel: '',
  description: '',
  statut: 'EN_PREPARATION',
  modeCarburant: 'STOCK_PHYSIQUE',
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return `${NUMBER_FORMAT.format(amount)} FCFA`
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: fr })
  } catch {
    return '—'
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChantiersView() {
  const { setCurrentView, setSelectedChantierId } = useAppStore()

  // State
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('TOUS')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch chantiers ───────────────────────────────────────────────────────

  const fetchChantiers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'TOUS') params.set('statut', activeTab)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/chantiers?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setChantiers(json.chantiers)
        setKpi(json.kpi)
      } else {
        toast.error('Erreur lors du chargement des chantiers')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [activeTab, search])

  useEffect(() => {
    fetchChantiers()
  }, [fetchChantiers])

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (chantier: Chantier) => {
    setEditingId(chantier.id)
    setForm({
      nom: chantier.nom,
      adresse: chantier.adresse || '',
      maitreOuvrage: chantier.maitreOuvrage || '',
      dateDebut: chantier.dateDebut
        ? format(parseISO(chantier.dateDebut), 'yyyy-MM-dd')
        : '',
      dateFinPrevue: chantier.dateFinPrevue
        ? format(parseISO(chantier.dateFinPrevue), 'yyyy-MM-dd')
        : '',
      budgetPrevisionnel: String(chantier.budgetPrevisionnel),
      description: chantier.description || '',
      statut: chantier.statut,
      modeCarburant: chantier.modeCarburant || 'STOCK_PHYSIQUE',
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.nom.trim()) {
      toast.error('Le nom du chantier est requis')
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        nom: form.nom.trim(),
        adresse: form.adresse.trim() || null,
        maitreOuvrage: form.maitreOuvrage.trim() || null,
        dateDebut: form.dateDebut || null,
        dateFinPrevue: form.dateFinPrevue || null,
        budgetPrevisionnel: Number(form.budgetPrevisionnel) || 0,
        description: form.description.trim() || null,
        modeCarburant: form.modeCarburant,
      }

      let res: Response
      if (editingId) {
        body.statut = form.statut
        res = await fetch(`/api/chantiers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/chantiers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingId
            ? 'Chantier mis à jour avec succès'
            : 'Chantier créé avec succès'
        )
        setFormOpen(false)
        fetchChantiers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      const res = await fetch(`/api/chantiers/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Chantier supprimé avec succès')
        setDeleteOpen(false)
        setDeletingId(null)
        fetchChantiers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const handleViewDetail = (id: string) => {
    setSelectedChantierId(id)
    setCurrentView('chantier-detail')
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────

  const kpiCards = kpi
    ? [
        {
          label: 'Total chantiers',
          value: kpi.total,
          icon: Building2,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Actifs',
          value: kpi.actifs,
          icon: TrendingUp,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
        {
          label: 'En préparation',
          value: kpi.enPreparation,
          icon: Clock,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
        },
        {
          label: 'Terminés',
          value: kpi.termines,
          icon: CheckCircle2,
          color: 'text-slate-600',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Chantiers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos chantiers de construction
          </p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouveau chantier
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm lg:text-[15px] text-muted-foreground font-medium">
                      {card.label}
                    </p>
                    <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-2 lg:p-2.5 rounded-lg border',
                      card.bg,
                      card.border
                    )}
                  >
                    <Icon className={cn('w-4 h-4 lg:w-5 lg:h-5', card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Search + Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, adresse, maître d'ouvrage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'px-3 py-1.5 text-[15px] font-medium rounded-md whitespace-nowrap transition-colors',
                activeTab === tab.value
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chantiers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border shadow-sm">
              <CardContent className="p-5 space-y-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center justify-end gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : chantiers.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Aucun chantier trouvé
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search || activeTab !== 'TOUS'
              ? 'Aucun chantier ne correspond à vos critères de recherche.'
              : 'Commencez par créer votre premier chantier.'}
          </p>
          {!search && activeTab === 'TOUS' && (
            <Button
              onClick={openCreate}
              className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Créer un chantier
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + search}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {chantiers.map((chantier, index) => (
              <motion.div
                key={chantier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="border shadow-sm hover:shadow-md transition-shadow group h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col flex-1 gap-3">
                    {/* Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-foreground text-[15px] leading-tight line-clamp-2 flex-1">
                        {chantier.nom}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs shrink-0',
                          STATUS_COLORS[chantier.statut]
                        )}
                      >
                        {STATUS_LABELS[chantier.statut] || chantier.statut}
                      </Badge>
                    </div>

                    {/* Address */}
                    {chantier.adresse && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">{chantier.adresse}</span>
                      </div>
                    )}

                    {/* Maître d'ouvrage */}
                    {chantier.maitreOuvrage && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <User className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">{chantier.maitreOuvrage}</span>
                      </div>
                    )}

                    {/* Budget */}
                    <div className="text-[15px] font-semibold text-foreground">
                      {formatFCFA(chantier.budgetPrevisionnel)}
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Avancement global</span>
                        <span className="font-medium text-foreground">
                          {chantier.avancementGlobal}%
                        </span>
                      </div>
                      <Progress
                        value={chantier.avancementGlobal}
                        className="h-2"
                      />
                    </div>

                    {/* Counts */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {chantier._count.phases} phase
                          {chantier._count.phases !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HardHat className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {chantier._count.journaliers} journalier
                          {chantier._count.journaliers !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(chantier.dateDebut)}
                      </span>
                      {chantier.dateFinPrevue && (
                        <>
                          <span className="text-muted-foreground/40">→</span>
                          <span>{formatDate(chantier.dateFinPrevue)}</span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 pt-2 mt-auto border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600"
                        onClick={() => handleViewDetail(chantier.id)}
                        title="Voir le détail"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600"
                        onClick={() => openEdit(chantier)}
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => confirmDelete(chantier.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Create/Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le chantier' : 'Nouveau chantier'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du chantier ci-dessous.'
                : 'Remplissez les informations pour créer un nouveau chantier.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Nom */}
            <div className="grid gap-2">
              <Label htmlFor="nom">Nom du chantier *</Label>
              <Input
                id="nom"
                placeholder="Ex: Résidence Les Palmiers"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
            </div>

            {/* Adresse */}
            <div className="grid gap-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                placeholder="Ex: Rue de la Liberté, Kinshasa"
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />
            </div>

            {/* Maître d'ouvrage */}
            <div className="grid gap-2">
              <Label htmlFor="maitreOuvrage">Maître d'ouvrage</Label>
              <Input
                id="maitreOuvrage"
                placeholder="Ex: Ministère des Travaux Publics"
                value={form.maitreOuvrage}
                onChange={(e) =>
                  setForm({ ...form, maitreOuvrage: e.target.value })
                }
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateDebut">Date de début</Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={form.dateDebut}
                  onChange={(e) =>
                    setForm({ ...form, dateDebut: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateFinPrevue">Date de fin prévue</Label>
                <Input
                  id="dateFinPrevue"
                  type="date"
                  value={form.dateFinPrevue}
                  onChange={(e) =>
                    setForm({ ...form, dateFinPrevue: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Budget */}
            <div className="grid gap-2">
              <Label htmlFor="budgetPrevisionnel">Budget prévisionnel (FCFA)</Label>
              <Input
                id="budgetPrevisionnel"
                type="number"
                placeholder="Ex: 150000000"
                value={form.budgetPrevisionnel}
                onChange={(e) =>
                  setForm({ ...form, budgetPrevisionnel: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description du projet..."
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            {/* Mode Carburant */}
            <div className="grid gap-2">
              <Label>Mode de gestion carburant</Label>
              <Select
                value={form.modeCarburant}
                onValueChange={(value) =>
                  setForm({ ...form, modeCarburant: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK_PHYSIQUE">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      Stock physique (cuve / citerne)
                    </div>
                  </SelectItem>
                  <SelectItem value="ACHAT_DIRECT">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      Achat direct en station-service
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.modeCarburant === 'STOCK_PHYSIQUE'
                  ? 'Gestion avec cuve/citerne sur le chantier : entrées → stock → sorties vers engins'
                  : 'Achat au coup par coup en station : bons d\'achat avec reçus directement affectés aux engins'}
              </p>
            </div>

            {/* Statut (only for edit) */}
            {editingId && (
              <div className="grid gap-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(value) =>
                    setForm({ ...form, statut: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EN_PREPARATION">En préparation</SelectItem>
                    <SelectItem value="EN_COURS">En cours</SelectItem>
                    <SelectItem value="EN_PAUSE">En pause</SelectItem>
                    <SelectItem value="TERMINE">Terminé</SelectItem>
                    <SelectItem value="RECEPTIONNE">Réceptionné</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {editingId ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>
                  {editingId ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Mettre à jour
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Créer
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le chantier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à ce
              chantier (phases, pointages, stocks, etc.) seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
