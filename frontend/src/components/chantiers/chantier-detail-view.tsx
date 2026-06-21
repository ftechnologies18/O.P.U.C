'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  TrendingUp,
  Building2,
  ChevronDown,
  ChevronRight,
  Phone,
  Wrench,
  Loader2,
  Fuel,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Types ────────────────────────────────────────────────

interface Tache {
  id: string
  nom: string
  description?: string
  ordre: number
  avancement: number
  statut: string
  dateDebut?: string
  dateFin?: string
  responsableId?: string
  tachePrecedenteId?: string
  responsable?: { id: string; name: string } | null
  sortiesStock: { id: string }[]
  photos: { id: string }[]
}

interface Phase {
  id: string
  nom: string
  ordre: number
  description?: string
  avancement: number
  dateDebut?: string
  dateFin?: string
  taches: Tache[]
  photos: { id: string }[]
}

interface JournalierAffectation {
  id: string
  actif: boolean
  dateDebut: string
  dateFin?: string
  journalier: {
    id: string
    nom: string
    prenom: string
    specialite?: string
    telephone?: string
  }
}

interface ChantierDetail {
  id: string
  nom: string
  adresse?: string
  maitreOuvrage?: string
  dateDebut?: string
  dateFinPrevue?: string
  budgetPrevisionnel: number
  statut: string
  description?: string
  modeCarburant?: string
  entrepriseId?: string
  createdAt: string
  updatedAt: string
  entreprise?: { id: string; nom: string; telephone?: string; email?: string }
  phases: Phase[]
  journaliers: JournalierAffectation[]
  equipements: { equipement: { id: string; designation: string; immatriculation?: string; etat: string } }[]
  _count: { pointages: number; photos: number; rapports: number; contratsST: number }
  avancementGlobal: number
  budgetReel: number
  coutPersonnel: number
  coutSousTraitants: number
}

// ─── Helpers ──────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try {
    const parsed = parseISO(d)
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy', { locale: fr }) : '—'
  } catch {
    return '—'
  }
}

const statutColors: Record<string, string> = {
  EN_COURS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_PREPARATION: 'bg-amber-100 text-amber-700 border-amber-200',
  EN_PAUSE: 'bg-orange-100 text-orange-700 border-orange-200',
  TERMINE: 'bg-slate-200 text-slate-700 border-slate-300',
  RECEPTIONNE: 'bg-sky-100 text-sky-700 border-sky-200',
}

const statutLabels: Record<string, string> = {
  EN_COURS: 'En cours',
  EN_PREPARATION: 'En préparation',
  EN_PAUSE: 'En pause',
  TERMINE: 'Terminé',
  RECEPTIONNE: 'Réceptionné',
}

const tacheStatutColors: Record<string, string> = {
  PLANIFIEE: 'bg-slate-100 text-slate-600 border-slate-200',
  EN_COURS: 'bg-amber-100 text-amber-700 border-amber-200',
  TERMINEE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_RETARD: 'bg-red-100 text-red-700 border-red-200',
}

const tacheStatutLabels: Record<string, string> = {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  EN_RETARD: 'En retard',
}

// ─── Component ────────────────────────────────────────────

export function ChantierDetailView() {
  const router = useRouter()
  const { selectedChantierId } = useAppStore()
  const [chantier, setChantier] = useState<ChantierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Expanded phases
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createPhaseDialogOpen, setCreatePhaseDialogOpen] = useState(false)
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false)
  const [deletePhaseDialogOpen, setDeletePhaseDialogOpen] = useState(false)
  const [deleteTaskDialogOpen, setDeleteTaskDialogOpen] = useState(false)

  // Editing avancement
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingAvancement, setEditingAvancement] = useState<string>('')

  // Target IDs for delete dialogs
  const [targetPhaseId, setTargetPhaseId] = useState<string | null>(null)
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null)
  const [targetPhaseIdForTask, setTargetPhaseIdForTask] = useState<string | null>(null)

  // Available users (for task assignment — responsableId select)
  // Fetched once on mount : CHEF_PROJET + EMPLOYE users of the tenant
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; email: string; role: string; fonction?: string }[]>([])

  useEffect(() => {
    fetch('/api/v1/users?pageSize=100')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.data) {
          // Filter : only CHEF_PROJET + EMPLOYE (not GERANT/SUPER_ADMIN — they have full access anyway)
          const assignable = data.data.filter((u: any) => u.role === 'CHEF_PROJET' || u.role === 'EMPLOYE')
          setAvailableUsers(assignable)
        }
      })
      .catch(() => { /* silent fail — select will just be empty */ })
  }, [])

  // ─── Fetch data ───

  const fetchChantier = useCallback(async () => {
    if (!selectedChantierId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/chantiers/${selectedChantierId}`)
      if (res.ok) {
        const data = await res.json()
        setChantier(data)
        // Auto-expand all phases
        const ids = new Set(data.phases.map((p: Phase) => p.id))
        setExpandedPhases(ids)
      } else {
        toast.error('Chantier non trouvé')
        router.push('/chantiers')
      }
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [selectedChantierId, router])

  useEffect(() => {
    fetchChantier()
  }, [fetchChantier])

  // ─── Edit chantier form ───

  const [editForm, setEditForm] = useState({
    nom: '',
    description: '',
    adresse: '',
    maitreOuvrage: '',
    dateDebut: '',
    dateFinPrevue: '',
    budgetPrevisionnel: '',
    statut: '',
    modeCarburant: 'STOCK_PHYSIQUE',
  })

  const openEditDialog = () => {
    if (!chantier) return
    setEditForm({
      nom: chantier.nom,
      description: chantier.description || '',
      adresse: chantier.adresse || '',
      maitreOuvrage: chantier.maitreOuvrage || '',
      dateDebut: chantier.dateDebut ? chantier.dateDebut.split('T')[0] : '',
      dateFinPrevue: chantier.dateFinPrevue ? chantier.dateFinPrevue.split('T')[0] : '',
      budgetPrevisionnel: String(chantier.budgetPrevisionnel),
      statut: chantier.statut,
      modeCarburant: chantier.modeCarburant || 'STOCK_PHYSIQUE',
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!chantier) return
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/chantiers/${chantier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          budgetPrevisionnel: parseFloat(editForm.budgetPrevisionnel) || 0,
          modeCarburant: editForm.modeCarburant,
        }),
      })
      if (res.ok) {
        toast.success('Chantier mis à jour')
        setEditDialogOpen(false)
        fetchChantier()
      } else {
        toast.error('Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChantier = async () => {
    if (!chantier) return
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/chantiers/${chantier.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Chantier supprimé')
        router.push('/chantiers')
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // ─── Create Phase ───

  const [phaseForm, setPhaseForm] = useState({
    nom: '',
    description: '',
    dateDebut: '',
    dateFin: '',
  })

  const handleCreatePhase = async () => {
    if (!chantier) return
    if (!phaseForm.nom.trim()) {
      toast.error('Le nom de la phase est requis')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/chantiers/${chantier.id}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phaseForm),
      })
      if (res.ok) {
        toast.success('Phase créée')
        setCreatePhaseDialogOpen(false)
        setPhaseForm({ nom: '', description: '', dateDebut: '', dateFin: '' })
        fetchChantier()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete Phase ───

  const handleDeletePhase = async () => {
    if (!chantier || !targetPhaseId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/chantiers/${chantier.id}/phases/${targetPhaseId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Phase supprimée')
        setDeletePhaseDialogOpen(false)
        setTargetPhaseId(null)
        fetchChantier()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // ─── Create Task ───

  const [taskForm, setTaskForm] = useState({
    nom: '',
    description: '',
    dateDebut: '',
    dateFin: '',
    responsableId: '',
    tachePrecedenteId: '',
  })

  const openCreateTaskDialog = (phaseId: string) => {
    setTargetPhaseIdForTask(phaseId)
    setTaskForm({ nom: '', description: '', dateDebut: '', dateFin: '', responsableId: '', tachePrecedenteId: '' })
    setCreateTaskDialogOpen(true)
  }

  const handleCreateTask = async () => {
    if (!chantier || !targetPhaseIdForTask) return
    if (!taskForm.nom.trim()) {
      toast.error('Le nom de la tâche est requis')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        `/api/v1/chantiers/${chantier.id}/phases/${targetPhaseIdForTask}/taches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskForm),
        }
      )
      if (res.ok) {
        toast.success('Tâche créée')
        setCreateTaskDialogOpen(false)
        setTargetPhaseIdForTask(null)
        fetchChantier()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete Task ───

  const handleDeleteTask = async () => {
    if (!chantier || !targetTaskId || !targetPhaseIdForTask) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/v1/chantiers/${chantier.id}/phases/${targetPhaseIdForTask}/taches/${targetTaskId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('Tâche supprimée')
        setDeleteTaskDialogOpen(false)
        setTargetTaskId(null)
        setTargetPhaseIdForTask(null)
        fetchChantier()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // ─── Inline avancement edit ───

  const startEditAvancement = (tache: Tache) => {
    setEditingTaskId(tache.id)
    setEditingAvancement(String(Math.round(tache.avancement)))
  }

  const saveAvancement = async (tacheId: string, phaseId: string) => {
    const val = Math.min(100, Math.max(0, parseInt(editingAvancement) || 0))
    setSaving(true)
    try {
      const res = await fetch(
        `/api/v1/chantiers/${chantier!.id}/phases/${phaseId}/taches/${tacheId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avancement: val }),
        }
      )
      if (res.ok) {
        toast.success('Avancement mis à jour')
        setEditingTaskId(null)
        fetchChantier()
      } else {
        toast.error('Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  // ─── Get all tasks for task predecessor dropdown ───

  const getAllTasks = (): Tache[] => {
    if (!chantier) return []
    return chantier.phases.flatMap((p) => p.taches)
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-96" />
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!chantier) return null

  const kpiCards = [
    {
      title: 'Avancement global',
      value: `${chantier.avancementGlobal}%`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      progress: chantier.avancementGlobal,
    },
    {
      title: 'Budget prévisionnel',
      value: fmtCurrency(chantier.budgetPrevisionnel),
      icon: ClipboardList,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      title: 'Journaliers affectés',
      value: String(chantier.journaliers.length),
      icon: Users,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
    },
    {
      title: 'Pointages totaux',
      value: String(chantier._count.pointages),
      icon: ClipboardList,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
    },
  ]

  // All tasks for predecessor selector
  const allTasks = getAllTasks()

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => router.push('/chantiers')}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="sr-only">Retour</span>
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {chantier.nom}
            </h2>
            <Badge variant="outline" className={statutColors[chantier.statut] || ''}>
              {statutLabels[chantier.statut] || chantier.statut}
            </Badge>
          </div>
          {chantier.adresse && (
            <p className="text-[15px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {chantier.adresse}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="w-4 h-4 mr-1.5" />
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm lg:text-[15px] text-muted-foreground font-medium">
                      {card.title}
                    </p>
                    <p className="text-xl lg:text-2xl font-bold mt-1 text-foreground truncate">
                      {card.value}
                    </p>
                  </div>
                  <div className={`p-2 lg:p-2.5 rounded-lg ${card.bg} ${card.border} border shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 lg:w-5 lg:h-5 ${card.color}`} />
                  </div>
                </div>
                {'progress' in card && (
                  <Progress value={card.progress} className="h-1.5 mt-3" />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-initial">
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="phases" className="flex-1 sm:flex-initial">
            Phases &amp; Tâches
          </TabsTrigger>
          <TabsTrigger value="equipe" className="flex-1 sm:flex-initial">
            Équipe
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Vue d'ensemble ─── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Description */}
          {chantier.description ? (
            <Card className="border shadow-sm">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-[17px] font-semibold">Description</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-[15px] text-muted-foreground whitespace-pre-line leading-relaxed">
                  {chantier.description}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border shadow-sm">
              <CardContent className="px-5 py-6">
                <p className="text-[15px] text-muted-foreground italic">
                  Aucune description fournie
                </p>
              </CardContent>
            </Card>
          )}

          {/* Info Grid */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoItem
                  icon={MapPin}
                  label="Adresse"
                  value={chantier.adresse}
                />
                <InfoItem
                  icon={Building2}
                  label="Maître d&apos;ouvrage"
                  value={chantier.maitreOuvrage}
                />
                <InfoItem
                  icon={Calendar}
                  label="Date début"
                  value={fmtDate(chantier.dateDebut)}
                />
                <InfoItem
                  icon={Calendar}
                  label="Date fin prévue"
                  value={fmtDate(chantier.dateFinPrevue)}
                />
                <InfoItem
                  icon={Building2}
                  label="Entreprise"
                  value={chantier.entreprise?.nom}
                />
                <InfoItem
                  icon={ClipboardList}
                  label="Budget réel"
                  value={fmtCurrency(chantier.budgetReel)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Phases Timeline */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">Timeline des phases</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {chantier.phases.length === 0 ? (
                <p className="text-[15px] text-muted-foreground py-4 text-center">
                  Aucune phase définie
                </p>
              ) : (
                <div className="space-y-4">
                  {chantier.phases.map((phase, index) => (
                    <div key={phase.id} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            phase.avancement >= 100
                              ? 'bg-emerald-500 text-white'
                              : phase.avancement > 0
                              ? 'bg-amber-500 text-white'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {phase.avancement >= 100 ? '✓' : phase.ordre}
                        </div>
                        {index < chantier.phases.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        )}
                      </div>

                      {/* Phase content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-semibold text-foreground">
                            {phase.nom}
                          </span>
                          {phase.dateDebut && (
                            <span className="text-sm text-muted-foreground">
                              {fmtDate(phase.dateDebut)}
                              {phase.dateFin ? ` → ${fmtDate(phase.dateFin)}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress
                            value={phase.avancement}
                            className="h-2 flex-1"
                          />
                          <span className="text-sm font-medium text-muted-foreground w-10 text-right">
                            {Math.round(phase.avancement)}%
                          </span>
                        </div>
                        {phase.description && (
                          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                            {phase.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Phases & Tâches ─── */}
        <TabsContent value="phases" className="space-y-4 mt-4">
          {chantier.phases.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                  <ClipboardList className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-[15px] font-medium text-foreground mb-1">
                  Aucune phase définie
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Commencez par ajouter des phases pour organiser votre chantier
                </p>
                <Button size="sm" onClick={() => setCreatePhaseDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Ajouter une phase
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {chantier.phases.map((phase) => {
                const isExpanded = expandedPhases.has(phase.id)
                return (
                  <Card key={phase.id} className="border shadow-sm">
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => togglePhase(phase.id)}
                    >
                      {/* Phase Header */}
                      <div className="px-4 lg:px-5 py-3.5 flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs font-mono bg-muted"
                            >
                              P{phase.ordre}
                            </Badge>
                            <span className="text-[15px] font-semibold text-foreground truncate">
                              {phase.nom}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({phase.taches.length} tâche{phase.taches.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={phase.avancement}
                              className="h-1.5 flex-1 max-w-[200px]"
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {Math.round(phase.avancement)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {phase.dateDebut && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {fmtDate(phase.dateDebut)}
                              {phase.dateFin ? ` → ${fmtDate(phase.dateFin)}` : ''}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setTargetPhaseId(phase.id)
                              setDeletePhaseDialogOpen(true)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Phase Content: Tasks */}
                      <CollapsibleContent>
                        <Separator />
                        <div className="px-4 lg:px-5 py-3 space-y-2">
                          {phase.taches.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">
                              Aucune tâche dans cette phase
                            </p>
                          ) : (
                            phase.taches.map((tache) => (
                              <div
                                key={tache.id}
                                className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors group"
                              >
                                {/* Task statut */}
                                <Badge
                                  variant="outline"
                                  className={`text-xs shrink-0 ${tacheStatutColors[tache.statut] || ''}`}
                                >
                                  {tacheStatutLabels[tache.statut] || tache.statut}
                                </Badge>

                                {/* Task name */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[15px] font-medium text-foreground truncate">
                                    {tache.nom}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {tache.responsable && (
                                      <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {tache.responsable.name}
                                      </span>
                                    )}
                                    {tache.dateDebut && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {fmtDate(tache.dateDebut)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Avancement */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {editingTaskId === tache.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={editingAvancement}
                                        onChange={(e) => setEditingAvancement(e.target.value)}
                                        className="w-14 h-7 text-xs text-center"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveAvancement(tache.id, phase.id)
                                          if (e.key === 'Escape') setEditingTaskId(null)
                                        }}
                                        autoFocus
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                        onClick={() => saveAvancement(tache.id, phase.id)}
                                        disabled={saving}
                                      >
                                        <TrendingUp className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-sm font-medium gap-1"
                                      onClick={() => startEditAvancement(tache)}
                                    >
                                      <TrendingUp className="w-3 h-3" />
                                      {Math.round(tache.avancement)}%
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setTargetTaskId(tache.id)
                                      setTargetPhaseIdForTask(phase.id)
                                      setDeleteTaskDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}

                          {/* Add task button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed text-sm"
                            onClick={() => openCreateTaskDialog(phase.id)}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Ajouter une tâche
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })}

              {/* Add phase button */}
              <Button
                variant="outline"
                className="w-full border-dashed h-10"
                onClick={() => setCreatePhaseDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Ajouter une phase
              </Button>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 3: Équipe ─── */}
        <TabsContent value="equipe" className="mt-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-amber-500" />
                Journaliers affectés ({chantier.journaliers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {chantier.journaliers.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                    <Users className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-[15px] text-muted-foreground">
                    Aucun journalier affecté à ce chantier
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {chantier.journaliers.map((aff) => {
                    const j = aff.journalier
                    return (
                      <div
                        key={aff.id}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
                          {j.prenom[0]}
                          {j.nom[0]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-foreground truncate">
                            {j.prenom} {j.nom}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {j.specialite && (
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {j.specialite}
                              </span>
                            )}
                            {j.telephone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {j.telephone}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                          Actif
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Chantier Dialog ─── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le chantier</DialogTitle>
            <DialogDescription>
              Modifiez les informations du chantier
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-nom">Nom du chantier</Label>
              <Input
                id="edit-nom"
                value={editForm.nom}
                onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                placeholder="Ex: Résidence Les Palmiers"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Description du projet..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-adresse">Adresse</Label>
              <Input
                id="edit-adresse"
                value={editForm.adresse}
                onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })}
                placeholder="Adresse du chantier"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-maitre">Maître d&apos;ouvrage</Label>
              <Input
                id="edit-maitre"
                value={editForm.maitreOuvrage}
                onChange={(e) => setEditForm({ ...editForm, maitreOuvrage: e.target.value })}
                placeholder="Nom du maître d'ouvrage"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-dateDebut">Date début</Label>
                <Input
                  id="edit-dateDebut"
                  type="date"
                  value={editForm.dateDebut}
                  onChange={(e) => setEditForm({ ...editForm, dateDebut: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-dateFin">Date fin prévue</Label>
                <Input
                  id="edit-dateFin"
                  type="date"
                  value={editForm.dateFinPrevue}
                  onChange={(e) => setEditForm({ ...editForm, dateFinPrevue: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-budget">Budget prévisionnel (FCFA)</Label>
              <Input
                id="edit-budget"
                type="number"
                value={editForm.budgetPrevisionnel}
                onChange={(e) => setEditForm({ ...editForm, budgetPrevisionnel: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-statut">Statut</Label>
              <Select
                value={editForm.statut}
                onValueChange={(value) => setEditForm({ ...editForm, statut: value })}
              >
                <SelectTrigger id="edit-statut" className="w-full">
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
            {/* Mode Carburant */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5" />
                Mode de gestion carburant
              </Label>
              <Select
                value={editForm.modeCarburant}
                onValueChange={(value) => setEditForm({ ...editForm, modeCarburant: value })}
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
                      <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
                      Achat direct en station-service
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editForm.modeCarburant === 'STOCK_PHYSIQUE'
                  ? 'Gestion avec cuve/citerne sur le chantier : entrées → stock → sorties vers engins'
                  : 'Achat au coup par coup en station : bons d\'achat avec reçus directement affectés aux engins'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.nom.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Chantier Dialog ─── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le chantier</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées (phases, tâches,
              pointages, stocks, etc.) seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChantier}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Create Phase Dialog ─── */}
      <Dialog open={createPhaseDialogOpen} onOpenChange={setCreatePhaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle phase</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle phase au chantier
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="phase-nom">Nom de la phase *</Label>
              <Input
                id="phase-nom"
                value={phaseForm.nom}
                onChange={(e) => setPhaseForm({ ...phaseForm, nom: e.target.value })}
                placeholder="Ex: Gros œuvre"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phase-description">Description</Label>
              <Textarea
                id="phase-description"
                value={phaseForm.description}
                onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                placeholder="Description de la phase..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="phase-dateDebut">Date début</Label>
                <Input
                  id="phase-dateDebut"
                  type="date"
                  value={phaseForm.dateDebut}
                  onChange={(e) => setPhaseForm({ ...phaseForm, dateDebut: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phase-dateFin">Date fin</Label>
                <Input
                  id="phase-dateFin"
                  type="date"
                  value={phaseForm.dateFin}
                  onChange={(e) => setPhaseForm({ ...phaseForm, dateFin: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePhaseDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleCreatePhase}
              disabled={saving || !phaseForm.nom.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Créer la phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Phase Dialog ─── */}
      <AlertDialog open={deletePhaseDialogOpen} onOpenChange={setDeletePhaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la phase</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera la phase et toutes ses tâches. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhase}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Create Task Dialog ─── */}
      <Dialog open={createTaskDialogOpen} onOpenChange={setCreateTaskDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle tâche</DialogTitle>
            <DialogDescription>
              Ajoutez une tâche à la phase sélectionnée
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-nom">Nom de la tâche *</Label>
              <Input
                id="task-nom"
                value={taskForm.nom}
                onChange={(e) => setTaskForm({ ...taskForm, nom: e.target.value })}
                placeholder="Ex: Fouilles fondations"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Description de la tâche..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="task-dateDebut">Date début</Label>
                <Input
                  id="task-dateDebut"
                  type="date"
                  value={taskForm.dateDebut}
                  onChange={(e) => setTaskForm({ ...taskForm, dateDebut: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-dateFin">Date fin</Label>
                <Input
                  id="task-dateFin"
                  type="date"
                  value={taskForm.dateFin}
                  onChange={(e) => setTaskForm({ ...taskForm, dateFin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-responsable">Responsable (assignation)</Label>
              <select
                id="task-responsable"
                value={taskForm.responsableId}
                onChange={(e) => setTaskForm({ ...taskForm, responsableId: e.target.value })}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Non assigné —</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'EMPLOYE' ? 'Employé' : 'Chef de Projet'}{u.fonction ? ` · ${u.fonction.replace(/_/g, ' ').toLowerCase()}` : ''})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                L'utilisateur assigné retrouvera cette tâche dans « Mes Tâches ».
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-precedente">Tâche précédente (dépendance)</Label>
              <select
                id="task-precedente"
                value={taskForm.tachePrecedenteId}
                onChange={(e) => setTaskForm({ ...taskForm, tachePrecedenteId: e.target.value })}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Aucune —</option>
                {allTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={saving || !taskForm.nom.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Créer la tâche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Task Dialog ─── */}
      <AlertDialog open={deleteTaskDialogOpen} onOpenChange={setDeleteTaskDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La tâche sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-2 rounded-lg bg-muted shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-[15px] font-medium text-foreground truncate">
          {value || '—'}
        </p>
      </div>
    </div>
  )
}
