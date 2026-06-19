'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
  Search,
  FilterX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Building2,
  User,
  Percent,
  Receipt,
  ArrowRightLeft,
  Play,
  Ban,
  X,
  Check,
  Info,
  FileSignature,
  HardHat,
  Truck,
  Wrench,
  Briefcase,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type StatutContrat = 'EN_PREPARATION' | 'ACTIF' | 'EXPIRE' | 'RESILIE' | 'TERMINE'
type TypeContrat = 'TRAVAUX' | 'FOURNITURE' | 'SERVICE' | 'MIXTE'

interface Client {
  id: string
  raisonSociale: string
  telephone: string | null
  email: string | null
  adresse: string | null
}

interface Contrat {
  id: string
  numero: string
  clientId: string
  client: Client
  objet: string
  typeContrat: TypeContrat
  montantHT: number
  tauxTVA: number
  montantTTC: number
  dateDebut: string
  dateFin: string
  conditions: string | null
  penaltyRetard: number | null
  statut: StatutContrat
  createdAt: string
  updatedAt: string
  _count: {
    factures: number
  }
}

interface ContratFormData {
  clientId: string
  objet: string
  typeContrat: TypeContrat
  montantHT: number
  tauxTVA: number
  dateDebut: string
  dateFin: string
  conditions: string
  penaltyRetard: number
}

interface ContratDetail extends Contrat {
  montantTVA: number
  joursRestants: number | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUT_CONFIG: Record<StatutContrat, { label: string; className: string; icon: typeof Info }> = {
  EN_PREPARATION: {
    label: 'En préparation',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    icon: FileSignature,
  },
  ACTIF: {
    label: 'Actif',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    icon: Play,
  },
  EXPIRE: {
    label: 'Expiré',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    icon: AlertTriangle,
  },
  RESILIE: {
    label: 'Résilié',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    icon: Ban,
  },
  TERMINE: {
    label: 'Terminé',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
    icon: CheckCircle2,
  },
}

const TYPE_CONTRAT_CONFIG: Record<TypeContrat, { label: string; icon: typeof HardHat; className: string }> = {
  TRAVAUX: { label: 'Travaux', icon: HardHat, className: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  FOURNITURE: { label: 'Fourniture', icon: Truck, className: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
  SERVICE: { label: 'Service', icon: Wrench, className: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  MIXTE: { label: 'Mixte', icon: Briefcase, className: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
}

const STATUT_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_PREPARATION', label: 'En préparation' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'EXPIRE', label: 'Expiré' },
  { value: 'RESILIE', label: 'Résilié' },
  { value: 'TERMINE', label: 'Terminé' },
]

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'TRAVAUX', label: 'Travaux' },
  { value: 'FOURNITURE', label: 'Fourniture' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MIXTE', label: 'Mixte' },
]

const EMPTY_FORM: ContratFormData = {
  clientId: '',
  objet: '',
  typeContrat: 'TRAVAUX',
  montantHT: 0,
  tauxTVA: 18,
  dateDebut: '',
  dateFin: '',
  conditions: '',
  penaltyRetard: 0,
}

const ITEMS_PER_PAGE = 10

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' F'
}

function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETONS
// ═══════════════════════════════════════════════════════════════

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-4">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ContratsView() {
  // ── List State ──
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // ── Create/Edit Dialog State ──
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingContrat, setEditingContrat] = useState<Contrat | null>(null)
  const [formData, setFormData] = useState<ContratFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  // ── Detail Dialog State ──
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailContrat, setDetailContrat] = useState<ContratDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Status Change State ──
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Contrat | null>(null)
  const [newStatut, setNewStatut] = useState<StatutContrat>('ACTIF')
  const [statusChanging, setStatusChanging] = useState(false)

  // ── Delete Dialog State ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Contrat | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ═══════════════════════════════════════════════════════════
  // API CALLS
  // ═══════════════════════════════════════════════════════════

  const fetchClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const res = await fetch('/api/v1/clients?limit=100')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
      }
    } catch {
      // silent fail for clients
    } finally {
      setClientsLoading(false)
    }
  }, [])

  const fetchContrats = useCallback(async (
    page: number = 1,
    search?: string,
    statut?: string,
    typeContrat?: string,
    clientId?: string,
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(ITEMS_PER_PAGE))
      if (search) params.set('search', search)
      if (statut) params.set('statut', statut)
      if (typeContrat) params.set('typeContrat', typeContrat)
      if (clientId) params.set('clientId', clientId)

      const res = await fetch(`/api/v1/contrats?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContrats(data.contrats || [])
        setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 })
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchContratDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/v1/contrats/${id}`)
      if (res.ok) {
        const data = await res.json()
        const contrat = data.contrat as Contrat
        const now = new Date()
        const fin = new Date(contrat.dateFin)
        const joursRestants = contrat.statut === 'ACTIF' ? differenceInDays(fin, now) : null
        setDetailContrat({
          ...contrat,
          montantTVA: contrat.montantTTC - contrat.montantHT,
          joursRestants,
        })
      } else {
        toast.error('Impossible de charger les détails du contrat')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    fetchContrats(currentPage, searchQuery, statutFilter, typeFilter, clientFilter)
  }, [currentPage, fetchContrats, searchQuery, statutFilter, typeFilter, clientFilter])

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchContrats(1, searchQuery, statutFilter, typeFilter, clientFilter)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatutFilter('')
    setTypeFilter('')
    setClientFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statutFilter || typeFilter || clientFilter

  // ── Auto-calc TTC ──
  const calculatedTTC = useMemo(() => {
    const ht = formData.montantHT || 0
    const tva = formData.tauxTVA || 0
    return ht + (ht * tva / 100)
  }, [formData.montantHT, formData.tauxTVA])

  // ── Form handlers ──
  const openCreateDialog = () => {
    setEditingContrat(null)
    setFormData(EMPTY_FORM)
    setFormDialogOpen(true)
  }

  const openEditDialog = (contrat: Contrat) => {
    setEditingContrat(contrat)
    setFormData({
      clientId: contrat.clientId,
      objet: contrat.objet,
      typeContrat: contrat.typeContrat,
      montantHT: contrat.montantHT,
      tauxTVA: contrat.tauxTVA,
      dateDebut: contrat.dateDebut ? format(new Date(contrat.dateDebut), 'yyyy-MM-dd') : '',
      dateFin: contrat.dateFin ? format(new Date(contrat.dateFin), 'yyyy-MM-dd') : '',
      conditions: contrat.conditions || '',
      penaltyRetard: contrat.penaltyRetard || 0,
    })
    setFormDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.clientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (!formData.objet.trim()) {
      toast.error("L'objet du contrat est requis")
      return
    }
    if (!formData.dateDebut || !formData.dateFin) {
      toast.error('Les dates de début et fin sont requises')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        montantTTC: calculatedTTC,
      }

      const url = editingContrat ? `/api/contrats/${editingContrat.id}` : '/api/contrats'
      const method = editingContrat ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(editingContrat ? 'Contrat mis à jour avec succès' : 'Contrat créé avec succès')
        setFormDialogOpen(false)
        fetchContrats(currentPage, searchQuery, statutFilter, typeFilter, clientFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue lors de l'enregistrement")
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  // ── Detail handler ──
  const openDetailDialog = (contrat: Contrat) => {
    setDetailDialogOpen(true)
    fetchContratDetail(contrat.id)
  }

  // ── Status change handlers ──
  const openStatusDialog = (contrat: Contrat, statut: StatutContrat) => {
    setStatusTarget(contrat)
    setNewStatut(statut)
    setStatusDialogOpen(true)
  }

  const handleStatusChange = async () => {
    if (!statusTarget) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/v1/contrats/${statusTarget.id}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (res.ok) {
        const label = STATUT_CONFIG[newStatut].label
        toast.success(`Contrat "${statusTarget.numero}" passé en "${label}"`)
        setStatusDialogOpen(false)
        fetchContrats(currentPage, searchQuery, statutFilter, typeFilter, clientFilter)
        // Refresh detail if open
        if (detailDialogOpen && detailContrat?.id === statusTarget.id) {
          fetchContratDetail(statusTarget.id)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Impossible de changer le statut')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setStatusChanging(false)
    }
  }

  // ── Delete handler ──
  const confirmDelete = (contrat: Contrat) => {
    setDeleteTarget(contrat)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/contrats/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Contrat "${deleteTarget.numero}" supprimé`)
        setDeleteDialogOpen(false)
        fetchContrats(currentPage, searchQuery, statutFilter, typeFilter, clientFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Impossible de supprimer le contrat')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setDeleting(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Gestion des Contrats
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} contrat{pagination.total !== 1 ? 's' : ''} enregistré{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Contrat
        </Button>
      </div>

      {/* ── Search & Filters ── */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher par numéro, objet, client..."
                className="pl-9"
              />
            </div>
            <Select value={statutFilter || 'TOUS'} onValueChange={(v) => { setStatutFilter(v === 'TOUS' ? '' : v) }}>
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                {STATUT_FILTERS.map((f) => (
                  <SelectItem key={f.value || 'TOUS'} value={f.value || 'TOUS'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter || 'TOUS'} onValueChange={(v) => { setTypeFilter(v === 'TOUS' ? '' : v) }}>
              <SelectTrigger className="sm:w-[150px]">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value || 'TOUS'} value={f.value || 'TOUS'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="outline" onClick={handleResetFilters} className="gap-2 shrink-0">
                <FilterX className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton rows={ITEMS_PER_PAGE} />
      ) : contrats.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucun contrat'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Aucun contrat ne correspond à vos critères de recherche.'
                : 'Commencez par créer votre premier contrat.'}
            </p>
            {!hasFilters && (
              <Button onClick={openCreateDialog} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <Plus className="w-4 h-4" />
                Nouveau Contrat
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">N° / Client</TableHead>
                    <TableHead className="hidden lg:table-cell">Objet</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Montant TTC</TableHead>
                    <TableHead className="hidden md:table-cell">Période</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Factures</TableHead>
                    <TableHead className="w-12 pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contrats.map((contrat, index) => {
                    const statut = STATUT_CONFIG[contrat.statut]
                    const typeConfig = TYPE_CONTRAT_CONFIG[contrat.typeContrat]
                    const TypeIcon = typeConfig.icon
                    const StatutIcon = statut.icon
                    return (
                      <motion.tr
                        key={contrat.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="space-y-0.5">
                            <p className="font-medium text-foreground text-sm">{contrat.numero}</p>
                            <p className="text-xs text-muted-foreground">{contrat.client?.raisonSociale || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">{contrat.objet}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('p-1 rounded', typeConfig.className)}>
                              <TypeIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm">{typeConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className="text-sm font-semibold text-foreground">
                            {formatFCFA(contrat.montantTTC)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>{contrat.dateDebut ? format(new Date(contrat.dateDebut), 'dd/MM/yyyy') : '—'}</p>
                            <p className="flex items-center gap-1">
                              <ArrowRightLeft className="w-3 h-3" />
                              {contrat.dateFin ? format(new Date(contrat.dateFin), 'dd/MM/yyyy') : '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn('text-[10px] gap-1', statut.className)}>
                            <StatutIcon className="w-3 h-3" />
                            {statut.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {contrat._count.factures}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailDialog(contrat)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(contrat)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {contrat.statut === 'EN_PREPARATION' && (
                                <DropdownMenuItem onClick={() => openStatusDialog(contrat, 'ACTIF')} className="text-emerald-600 focus:text-emerald-600">
                                  <Play className="w-4 h-4 mr-2" />
                                  Activer
                                </DropdownMenuItem>
                              )}
                              {(contrat.statut === 'ACTIF' || contrat.statut === 'EN_PREPARATION') && (
                                <DropdownMenuItem onClick={() => openStatusDialog(contrat, 'RESILIE')} className="text-orange-600 focus:text-orange-600">
                                  <Ban className="w-4 h-4 mr-2" />
                                  Résilier
                                </DropdownMenuItem>
                              )}
                              {(contrat.statut === 'ACTIF' || contrat.statut === 'EN_PREPARATION') && (
                                <DropdownMenuItem onClick={() => openStatusDialog(contrat, 'TERMINE')} className="text-sky-600 focus:text-sky-600">
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Terminer
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => confirmDelete(contrat)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let page = i + 1
                    if (pagination.totalPages > 5) {
                      if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= pagination.totalPages - 2) {
                        page = pagination.totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                    }
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className={cn('h-8 w-8 p-0', page === currentPage && 'bg-emerald-600 hover:bg-emerald-700')}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={currentPage >= pagination.totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE / EDIT DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingContrat ? (
                <>
                  <Pencil className="w-5 h-5 text-amber-500" />
                  Modifier le contrat {editingContrat.numero}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Nouveau Contrat
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingContrat
                ? 'Modifiez les informations du contrat ci-dessous.'
                : 'Remplissez les informations pour créer un nouveau contrat.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 py-2">
              {/* Client Select */}
              <div className="space-y-2">
                <Label htmlFor="clientId">Client <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, clientId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={clientsLoading ? 'Chargement...' : 'Sélectionner un client'} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.raisonSociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Objet */}
              <div className="space-y-2">
                <Label htmlFor="objet">Objet du contrat <span className="text-red-500">*</span></Label>
                <Input
                  id="objet"
                  value={formData.objet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, objet: e.target.value }))}
                  placeholder="Ex: Construction bâtiment administratif"
                />
              </div>

              {/* Type Contrat + Penalty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="typeContrat">Type de contrat</Label>
                  <Select
                    value={formData.typeContrat}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, typeContrat: v as TypeContrat }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONTRAT_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="penaltyRetard" className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" />
                    Pénalité de retard (%)
                  </Label>
                  <Input
                    id="penaltyRetard"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.penaltyRetard}
                    onChange={(e) => setFormData((prev) => ({ ...prev, penaltyRetard: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Montant HT + Taux TVA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="montantHT">Montant HT (FCFA)</Label>
                  <Input
                    id="montantHT"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.montantHT || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, montantHT: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tauxTVA">Taux TVA (%)</Label>
                  <Input
                    id="tauxTVA"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.tauxTVA}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tauxTVA: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* TTC Preview */}
              <div className="p-4 rounded-lg bg-muted/50 border space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Montant HT</span>
                  <span className="font-medium">{formatFCFA(formData.montantHT || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({formData.tauxTVA || 0}%)</span>
                  <span className="font-medium">{formatFCFA((formData.montantHT || 0) * ((formData.tauxTVA || 0) / 100))}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Montant TTC</span>
                  <span className="text-emerald-600">{formatFCFA(calculatedTTC)}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateDebut">Date de début <span className="text-red-500">*</span></Label>
                  <Input
                    id="dateDebut"
                    type="date"
                    value={formData.dateDebut}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateDebut: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFin">Date de fin <span className="text-red-500">*</span></Label>
                  <Input
                    id="dateFin"
                    type="date"
                    value={formData.dateFin}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateFin: e.target.value }))}
                  />
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                <Label htmlFor="conditions">Conditions particulières</Label>
                <Textarea
                  id="conditions"
                  value={formData.conditions}
                  onChange={(e) => setFormData((prev) => ({ ...prev, conditions: e.target.value }))}
                  placeholder="Conditions de paiement, clauses spécifiques, délais..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingContrat ? 'Mettre à jour' : 'Créer le contrat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DETAIL DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              Détails du contrat
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailContrat ? (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-5 py-2">
                {/* Header Info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground text-lg">{detailContrat.numero}</h3>
                      <Badge variant="outline" className={cn('text-[10px] gap-1', STATUT_CONFIG[detailContrat.statut].className)}>
                        {STATUT_CONFIG[detailContrat.statut].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{detailContrat.objet}</p>
                  </div>
                </div>

                <Separator />

                {/* Client Info */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Client
                  </h4>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="font-medium text-sm">{detailContrat.client?.raisonSociale || '—'}</p>
                    {detailContrat.client?.email && (
                      <p className="text-xs text-muted-foreground">{detailContrat.client.email}</p>
                    )}
                    {detailContrat.client?.telephone && (
                      <p className="text-xs text-muted-foreground">{detailContrat.client.telephone}</p>
                    )}
                    {detailContrat.client?.adresse && (
                      <p className="text-xs text-muted-foreground">{detailContrat.client.adresse}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Contract Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Type de contrat</p>
                    <div className="flex items-center gap-1.5">
                      <div className={cn('p-1 rounded', TYPE_CONTRAT_CONFIG[detailContrat.typeContrat].className)}>
                        {(() => { const Icon = TYPE_CONTRAT_CONFIG[detailContrat.typeContrat].icon; return <Icon className="w-3.5 h-3.5" /> })()}
                      </div>
                      <span className="text-sm font-medium">{TYPE_CONTRAT_CONFIG[detailContrat.typeContrat].label}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Factures liées</p>
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{detailContrat._count.factures} facture{detailContrat._count.factures !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Amounts */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    Montants
                  </h4>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Montant HT</span>
                      <span className="font-medium">{formatFCFA(detailContrat.montantHT)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">TVA ({detailContrat.tauxTVA}%)</span>
                      <span className="font-medium">{formatFCFA(detailContrat.montantTVA)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-base font-bold">
                      <span>Montant TTC</span>
                      <span className="text-emerald-600">{formatFCFA(detailContrat.montantTTC)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Dates */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Période
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Date de début</p>
                      <p className="text-sm font-medium">
                        {detailContrat.dateDebut
                          ? format(new Date(detailContrat.dateDebut), 'dd MMM yyyy', { locale: fr })
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Date de fin</p>
                      <p className="text-sm font-medium">
                        {detailContrat.dateFin
                          ? format(new Date(detailContrat.dateFin), 'dd MMM yyyy', { locale: fr })
                          : '—'}
                      </p>
                    </div>
                  </div>
                  {detailContrat.joursRestants !== null && (
                    <div className={cn(
                      'mt-2 p-2 rounded-lg text-center text-sm font-medium',
                      detailContrat.joursRestants > 30
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : detailContrat.joursRestants > 0
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                    )}>
                      <Clock className="w-4 h-4 inline-block mr-1" />
                      {detailContrat.joursRestants > 0
                        ? `${detailContrat.joursRestants} jour${detailContrat.joursRestants > 1 ? 's' : ''} restant${detailContrat.joursRestants > 1 ? 's' : ''}`
                        : 'Expiré'}
                    </div>
                  )}
                </div>

                {/* Penalty */}
                {detailContrat.penaltyRetard != null && detailContrat.penaltyRetard > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Pénalité de retard
                      </h4>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          {detailContrat.penaltyRetard}% par période de retard
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">
                          Soit {formatFCFA(detailContrat.montantTTC * detailContrat.penaltyRetard / 100)} par période
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Conditions */}
                {detailContrat.conditions && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-muted-foreground" />
                        Conditions particulières
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-lg bg-muted/50">
                        {detailContrat.conditions}
                      </p>
                    </div>
                  </>
                )}

                {/* Metadata */}
                <Separator />
                <div className="text-xs text-muted-foreground space-y-0.5 text-center">
                  <p>Créé {formatRelativeTime(detailContrat.createdAt)}</p>
                  <p>Modifié {formatRelativeTime(detailContrat.updatedAt)}</p>
                </div>
              </div>
            </ScrollArea>
          ) : null}

          {/* Detail Footer with Status Actions */}
          {detailContrat && (
            <DialogFooter className="pt-4 border-t flex-wrap gap-2">
              {(detailContrat.statut === 'EN_PREPARATION' || detailContrat.statut === 'ACTIF' || detailContrat.statut === 'EXPIRE') && (
                <>
                  {detailContrat.statut !== 'ACTIF' && (
                    <Button
                      variant="outline"
                      onClick={() => openStatusDialog(detailContrat, 'ACTIF')}
                      className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Activer
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => openStatusDialog(detailContrat, 'RESILIE')}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50 gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Résilier
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openStatusDialog(detailContrat, 'TERMINE')}
                    className="text-sky-600 border-sky-300 hover:bg-sky-50 gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Terminer
                  </Button>
                </>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setDetailDialogOpen(false); openEditDialog(detailContrat) }} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  Modifier
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          STATUS CHANGE DIALOG
          ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {newStatut === 'ACTIF' && <Play className="w-5 h-5 text-emerald-500" />}
              {newStatut === 'RESILIE' && <Ban className="w-5 h-5 text-orange-500" />}
              {newStatut === 'TERMINE' && <CheckCircle2 className="w-5 h-5 text-sky-500" />}
              {newStatut === 'EXPIRE' && <AlertTriangle className="w-5 h-5 text-red-500" />}
              Changer le statut du contrat
            </AlertDialogTitle>
            <AlertDialogDescription>
              {newStatut === 'ACTIF' && (
                <>Voulez-vous vraiment <strong>activer</strong> le contrat &quot;{statusTarget?.numero}&quot; ? Le contrat sera considéré comme en cours d&apos;exécution.</>
              )}
              {newStatut === 'RESILIE' && (
                <>Voulez-vous vraiment <strong>résilier</strong> le contrat &quot;{statusTarget?.numero}&quot; ? Cette action marque la fin anticipée du contrat.</>
              )}
              {newStatut === 'TERMINE' && (
                <>Voulez-vous vraiment marquer le contrat &quot;{statusTarget?.numero}&quot; comme <strong>terminé</strong> ? Cette action indique que le contrat a été exécuté à son terme.</>
              )}
              {newStatut === 'EXPIRE' && (
                <>Voulez-vous vraiment marquer le contrat &quot;{statusTarget?.numero}&quot; comme <strong>expiré</strong> ?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusChanging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={statusChanging}
              className={cn(
                newStatut === 'ACTIF' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                newStatut === 'RESILIE' && 'bg-orange-600 hover:bg-orange-700 text-white',
                newStatut === 'TERMINE' && 'bg-sky-600 hover:bg-sky-700 text-white',
                newStatut === 'EXPIRE' && 'bg-red-600 hover:bg-red-700 text-white',
              )}
            >
              {statusChanging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════
          DELETE DIALOG
          ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer le contrat
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le contrat &quot;{deleteTarget?.numero}&quot; ?
              Cette action est irréversible et supprimera également les factures associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
