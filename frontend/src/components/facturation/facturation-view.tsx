'use client'

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  FileText,
  Receipt,
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
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  Banknote,
  Building2,
  CircleDollarSign,
  BarChart3,
  PieChart,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Ban,
  X,
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
import { Progress } from '@/components/ui/progress'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Client {
  id: string
  raisonSociale: string
  nomContact?: string | null
  telephone?: string | null
  email?: string | null
  adresse?: string | null
  nif?: string | null
  rccm?: string | null
}

interface Contrat {
  id: string
  numero: string
  objet: string
  typeContrat?: string | null
  montantHT?: number | null
  montantTTC?: number | null
}

interface FactureListItem {
  id: string
  numero: string
  typeFacture: string
  statut: string
  dateEmission: string
  dateEcheance: string | null
  montantHT: number
  tauxTVA: number
  montantTVA: number
  totalTTC: number
  montantPaye: number
  notes: string | null
  conditions: string | null
  clientId: string
  client: { id: string; raisonSociale: string }
  contrat: { id: string; numero: string; objet: string } | null
  _count: { paiements: number }
}

interface FactureDetail {
  id: string
  numero: string
  typeFacture: string
  statut: string
  dateEmission: string
  dateEcheance: string | null
  datePaiement: string | null
  montantHT: number
  tauxTVA: number
  montantTVA: number
  totalTTC: number
  montantPaye: number
  notes: string | null
  conditions: string | null
  clientId: string
  client: Client
  contrat: Contrat | null
  paiements: Paiement[]
}

interface Paiement {
  id: string
  factureId: string
  montant: number
  modePaiement: string
  reference: string | null
  notes: string | null
  datePaiement: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface FactureResume {
  totalEnAttente: number
  totalPayee: number
  totalEnRetard: number
}

interface StatsResponse {
  general: {
    totalFacture: number
    totalEncaisse: number
    totalRestant: number
    nombreFactures: number
    tauxRecouvrement: number
  }
  facturesEnRetard: {
    nombre: number
    montantTotal: number
    montantPaye: number
    montantImpaye: number
  }
  repartitionStatut: {
    statut: string
    nombre: number
    montantTotal: number
    montantPaye: number
  }[]
  repartitionType: {
    type: string
    nombre: number
    montantTotal: number
    montantPaye: number
  }[]
  topClients: {
    client: { id: string; raisonSociale: string } | null
    nombreFactures: number
    montantTotal: number
    montantPaye: number
  }[]
  mensuel: {
    mois: string
    nombre: number
    facture: number
    encaisse: number
    impaye: number
  }[]
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  BROUILLON: {
    label: 'Brouillon',
    className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400 dark:border-stone-700',
  },
  ENVOYE: {
    label: 'Envoyé',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
  },
  PAYEE: {
    label: 'Payée',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  },
  PARTIELLEMENT_PAYEE: {
    label: 'Partiellement payée',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  },
  ANNULEE: {
    label: 'Annulée',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  },
  EN_RETARD: {
    label: 'En retard',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  },
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  FACTURE: {
    label: 'Facture',
    className: 'bg-muted text-muted-foreground border-border',
  },
  ACOMPTE: {
    label: 'Acompte',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700',
  },
  SITUATION: {
    label: 'Situation',
    className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700',
  },
  SOLDE: {
    label: 'Solde',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  },
}

const MODE_PAIEMENT_CONFIG: Record<string, { label: string }> = {
  ESPECES: { label: 'Espèces' },
  VIREMENT: { label: 'Virement' },
  MOBILE_MONEY: { label: 'Mobile Money' },
  CHEQUE: { label: 'Chèque' },
}

const STATUT_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'PAYEE', label: 'Payée' },
  { value: 'PARTIELLEMENT_PAYEE', label: 'Partiellement payée' },
  { value: 'EN_RETARD', label: 'En retard' },
  { value: 'ANNULEE', label: 'Annulée' },
]

const TYPE_FACTURE_FILTERS = [
  { value: '', label: 'Tous les types' },
  { value: 'FACTURE', label: 'Facture' },
  { value: 'ACOMPTE', label: 'Acompte' },
  { value: 'SITUATION', label: 'Situation' },
  { value: 'SOLDE', label: 'Solde' },
]

const ITEMS_PER_PAGE = 15

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' F'
}

function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

function formatDateLong(date: string | Date): string {
  return format(new Date(date), 'dd MMMM yyyy', { locale: fr })
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETONS
// ═══════════════════════════════════════════════════════════════

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-24 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function FacturationView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Facturation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion des factures, paiements et statistiques
          </p>
        </div>
      </div>

      <Tabs defaultValue="factures" className="space-y-6">
        <TabsList>
          <TabsTrigger value="factures" className="gap-2">
            <FileText className="w-4 h-4" />
            Factures
          </TabsTrigger>
          <TabsTrigger value="statistiques" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="factures">
          <FacturesTab />
        </TabsContent>

        <TabsContent value="statistiques">
          <StatistiquesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: FACTURES
// ═══════════════════════════════════════════════════════════════

function FacturesTab() {
  const [factures, setFactures] = useState<FactureListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState<FactureResume | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [typeFactureFilter, setTypeFactureFilter] = useState('')
  const [clientIdFilter, setClientIdFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Clients for filter select
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoaded, setClientsLoaded] = useState(false)

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<FactureListItem | FactureDetail | null>(null)
  const [factureDetail, setFactureDetail] = useState<FactureDetail | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Fetch Clients for filter ─────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/clients?limit=100')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
        setClientsLoaded(true)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClients()
  }, [fetchClients])

  // ─── Fetch Factures ───────────────────────────────────────
  const fetchFactures = useCallback(
    async (page: number = 1, search?: string, statut?: string, clientId?: string, typeFacture?: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(ITEMS_PER_PAGE))
        if (search) params.set('search', search)
        if (statut) params.set('statut', statut)
        if (clientId) params.set('clientId', clientId)
        if (typeFacture) params.set('typeFacture', typeFacture)

        const res = await fetch(`/api/v1/facturation?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setFactures(data.factures || [])
          setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 })
          setResume(data.resume || null)
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFactures(currentPage, searchQuery, statutFilter, clientIdFilter, typeFactureFilter)
  }, [currentPage, fetchFactures, searchQuery, statutFilter, clientIdFilter, typeFactureFilter])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchFactures(1, searchQuery, statutFilter, clientIdFilter, typeFactureFilter)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatutFilter('')
    setTypeFactureFilter('')
    setClientIdFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statutFilter || typeFactureFilter || clientIdFilter

  // ─── Detail ───────────────────────────────────────────────
  const handleViewDetail = async (facture: FactureListItem) => {
    setSelectedFacture(facture)
    setDetailDialogOpen(true)
    try {
      const res = await fetch(`/api/v1/facturation/${facture.id}`)
      if (res.ok) {
        const data = await res.json()
        setFactureDetail(data.facture)
      }
    } catch {
      toast.error('Erreur lors du chargement des détails')
    }
  }

  // ─── Edit ─────────────────────────────────────────────────
  const handleEdit = (facture: FactureListItem) => {
    setSelectedFacture(facture)
    setEditDialogOpen(true)
  }

  // ─── Delete ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedFacture) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/facturation/${selectedFacture.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Facture ${(selectedFacture as FactureListItem).numero} supprimée`)
        setDeleteDialogOpen(false)
        setSelectedFacture(null)
        fetchFactures(currentPage, searchQuery, statutFilter, clientIdFilter, typeFactureFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Stats from resume ───────────────────────────────────
  const totalFacture = useMemo(() => {
    if (!resume) return 0
    return resume.totalEnAttente + resume.totalPayee + resume.totalEnRetard
  }, [resume])

  const totalEncaisse = resume?.totalPayee ?? 0
  const totalEnRetard = resume?.totalEnRetard ?? 0
  const totalRestant = totalFacture - totalEncaisse

  // ─── After create/edit refresh ───────────────────────────
  const handleFactureCreated = () => {
    fetchFactures(1, searchQuery, statutFilter, clientIdFilter, typeFactureFilter)
    setCurrentPage(1)
  }

  const handleDetailUpdated = () => {
    fetchFactures(currentPage, searchQuery, statutFilter, clientIdFilter, typeFactureFilter)
    // Also refresh detail if open
    if (selectedFacture) {
      handleViewDetail(selectedFacture as FactureListItem).catch(() => {})
    }
  }

  // ─── Stat cards ───────────────────────────────────────────
  const statCards = [
    {
      title: 'Total Facturé',
      value: formatFCFA(totalFacture),
      icon: CircleDollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: 'Total Encaissé',
      value: formatFCFA(totalEncaisse),
      icon: Wallet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: 'En Retard',
      value: formatFCFA(totalEnRetard),
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/20',
    },
    {
      title: 'Restant À Encaisser',
      value: formatFCFA(totalRestant),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/20',
    },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Liste des Factures
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} facture{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Facture
        </Button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
              >
                <Card className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 lg:p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                        <p className="text-xl lg:text-2xl font-bold mt-1 text-foreground">{card.value}</p>
                      </div>
                      <div className={cn('p-2 lg:p-2.5 rounded-lg border', card.bg, card.border)}>
                        <Icon className={cn('w-4.5 h-4.5 lg:w-5 lg:h-5', card.color)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Search & Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher par numéro, client..."
                className="pl-9"
              />
            </div>
            <Select value={statutFilter || 'TOUS'} onValueChange={(v) => setStatutFilter(v === 'TOUS' ? '' : v)}>
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                {STATUT_FILTERS.map((f) => (
                  <SelectItem key={f.value || 'TOUS'} value={f.value || 'TOUS'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFactureFilter || 'TOUS'} onValueChange={(v) => setTypeFactureFilter(v === 'TOUS' ? '' : v)}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FACTURE_FILTERS.map((f) => (
                  <SelectItem key={f.value || 'TOUS'} value={f.value || 'TOUS'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientsLoaded && clients.length > 0 && (
              <Select value={clientIdFilter || 'TOUS'} onValueChange={(v) => setClientIdFilter(v === 'TOUS' ? '' : v)}>
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Tous les clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Tous les clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button variant="outline" onClick={handleResetFilters} className="gap-2 shrink-0">
                <FilterX className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : factures.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucune facture'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Aucune facture ne correspond à vos filtres.'
                : 'Commencez par créer votre première facture.'}
            </p>
            {!hasFilters && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                Créer une facture
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
                    <TableHead className="pl-4">Numéro</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Émission</TableHead>
                    <TableHead className="hidden lg:table-cell">Échéance</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Payé</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factures.map((facture, index) => {
                    const statusCfg = STATUS_CONFIG[facture.statut] || STATUS_CONFIG.BROUILLON
                    const typeCfg = TYPE_CONFIG[facture.typeFacture] || TYPE_CONFIG.FACTURE
                    return (
                      <motion.tr
                        key={facture.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{facture.numero}</p>
                              <p className="text-xs text-muted-foreground md:hidden">
                                {typeCfg.label}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{facture.client.raisonSociale}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', typeCfg.className)}>
                            {typeCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{formatDate(facture.dateEmission)}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {facture.dateEcheance ? formatDate(facture.dateEcheance) : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-foreground">{formatFCFA(facture.totalTTC)}</span>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              facture.montantPaye >= facture.totalTTC
                                ? 'text-emerald-600'
                                : facture.montantPaye > 0
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {formatFCFA(facture.montantPaye)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', statusCfg.className)}>
                            {statusCfg.label}
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
                              <DropdownMenuItem onClick={() => handleViewDetail(facture)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              {facture.statut === 'BROUILLON' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleEdit(facture)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedFacture(facture)
                                      setDeleteDialogOpen(true)
                                    }}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  {(pagination.page - 1) * pagination.limit + 1}
                  –
                  {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
                  {pagination.total}
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
                        className={cn(
                          'h-8 w-8 p-0',
                          page === currentPage && 'bg-emerald-600 hover:bg-emerald-700'
                        )}
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

      {/* Create Facture Dialog */}
      <CreateFactureDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleFactureCreated}
        clients={clients}
        fetchClients={fetchClients}
      />

      {/* Edit Facture Dialog */}
      {selectedFacture && editDialogOpen && (
        <EditFactureDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdated={() => {
            handleFactureCreated()
            setEditDialogOpen(false)
          }}
          facture={selectedFacture as FactureListItem}
          clients={clients}
        />
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => { setDetailDialogOpen(open); if (!open) setFactureDetail(null) }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Détails de la facture
            </DialogTitle>
          </DialogHeader>
          {factureDetail ? (
            <FactureDetailContent
              facture={factureDetail}
              onStatusChanged={handleDetailUpdated}
              onPaymentAdded={handleDetailUpdated}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer la facture
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la facture &quot;{(selectedFacture as FactureListItem)?.numero}&quot; ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
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

// ═══════════════════════════════════════════════════════════════
// FACTURE DETAIL CONTENT
// ═══════════════════════════════════════════════════════════════

function FactureDetailContent({
  facture,
  onStatusChanged,
  onPaymentAdded,
}: {
  facture: FactureDetail
  onStatusChanged: () => void
  onPaymentAdded: () => void
}) {
  const [paiements, setPaiements] = useState<Paiement[]>(facture.paiements)
  const [paiementDialogOpen, setPaiementDialogOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const statusCfg = STATUS_CONFIG[facture.statut] || STATUS_CONFIG.BROUILLON
  const typeCfg = TYPE_CONFIG[facture.typeFacture] || TYPE_CONFIG.FACTURE
  const resteAPayer = Math.max(0, facture.totalTTC - facture.montantPaye)
  const progressPercent = facture.totalTTC > 0 ? Math.min(100, (facture.montantPaye / facture.totalTTC) * 100) : 0

  // ─── Status actions ──────────────────────────────────────
  const handleStatusChange = async (newStatut: string) => {
    setLoadingAction(newStatut)
    try {
      const res = await fetch(`/api/v1/facturation/${facture.id}/statut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (res.ok) {
        toast.success(`Statut mis à jour : ${STATUS_CONFIG[newStatut]?.label || newStatut}`)
        onStatusChanged()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du changement de statut')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoadingAction(null)
    }
  }

  // ─── Payment added callback ──────────────────────────────
  const handlePaymentAdded = (paiement: Paiement) => {
    setPaiements((prev) => [paiement, ...prev])
    onPaymentAdded()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-foreground">{facture.numero}</h3>
            <Badge variant="outline" className={cn('text-xs px-2 py-0.5 border', typeCfg.className)}>
              {typeCfg.label}
            </Badge>
            <Badge variant="outline" className={cn('text-xs px-2 py-0.5 border', statusCfg.className)}>
              {statusCfg.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              Émise le {formatDateLong(facture.dateEmission)}
            </span>
            {facture.dateEcheance && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Échéance : {formatDateLong(facture.dateEcheance)}
              </span>
            )}
            {facture.datePaiement && (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Payée le {formatDateLong(facture.datePaiement)}
              </span>
            )}
          </div>
        </div>
        {/* Status Actions */}
        {facture.statut === 'BROUILLON' && (
          <Button
            onClick={() => handleStatusChange('ENVOYE')}
            disabled={loadingAction === 'ENVOYE'}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {loadingAction === 'ENVOYE' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Envoyer
          </Button>
        )}
        {(facture.statut === 'ENVOYE' || facture.statut === 'PARTIELLEMENT_PAYEE' || facture.statut === 'EN_RETARD') && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleStatusChange('PAYEE')}
              disabled={loadingAction === 'PAYEE'}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {loadingAction === 'PAYEE' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Marquer Payée
            </Button>
            <Button
              onClick={() => handleStatusChange('ANNULEE')}
              disabled={loadingAction === 'ANNULEE'}
              variant="destructive"
              className="gap-2"
            >
              {loadingAction === 'ANNULEE' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              Annuler
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Client & Contrat Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="font-medium text-foreground">{facture.client.raisonSociale}</p>
            {facture.client.nomContact && (
              <p className="text-sm text-muted-foreground mt-1">{facture.client.nomContact}</p>
            )}
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              {facture.client.email && <p>{facture.client.email}</p>}
              {facture.client.telephone && <p>{facture.client.telephone}</p>}
              {facture.client.adresse && <p>{facture.client.adresse}</p>}
            </div>
          </CardContent>
        </Card>
        {facture.contrat && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                Contrat associé
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="font-medium text-foreground">{facture.contrat.numero}</p>
              <p className="text-sm text-muted-foreground mt-1">{facture.contrat.objet}</p>
              {facture.contrat.montantTTC && (
                <p className="text-xs text-muted-foreground mt-2">
                  Montant contrat : {formatFCFA(facture.contrat.montantTTC)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Amount Breakdown */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Détails financiers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Montant HT</p>
              <p className="text-sm font-bold text-foreground mt-1">{formatFCFA(facture.montantHT)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">TVA ({facture.tauxTVA}%)</p>
              <p className="text-sm font-bold text-foreground mt-1">{formatFCFA(facture.montantTVA)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <p className="text-xs text-muted-foreground">Total TTC</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {formatFCFA(facture.totalTTC)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Montant Payé</p>
              <p className="text-sm font-bold text-foreground mt-1">{formatFCFA(facture.montantPaye)}</p>
            </div>
          </div>

          {/* Payment Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reste à payer</span>
              <span className={cn('font-semibold', resteAPayer > 0 ? 'text-red-600' : 'text-emerald-600')}>
                {formatFCFA(resteAPayer)}
              </span>
            </div>
            <Progress
              value={progressPercent}
              className={cn(
                'h-3',
                progressPercent >= 100
                  ? '[&>div]:bg-emerald-500'
                  : progressPercent > 0
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-muted-foreground'
              )}
            />
            <p className="text-xs text-muted-foreground text-right">{progressPercent.toFixed(1)}% payé</p>
          </div>

          {facture.notes && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground bg-muted/50 p-2 rounded">{facture.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paiements Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Paiements
              <Badge variant="secondary" className="text-xs ml-1">
                {paiements.length}
              </Badge>
            </CardTitle>
            {facture.statut !== 'BROUILLON' && facture.statut !== 'ANNULEE' && facture.statut !== 'PAYEE' && (
              <Button
                size="sm"
                onClick={() => setPaiementDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter Paiement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {paiements.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun paiement enregistré</p>
            </div>
          ) : (
            <ScrollArea className="max-h-60">
              <div className="space-y-3">
                {paiements.map((p) => {
                  const modeCfg = MODE_PAIEMENT_CONFIG[p.modePaiement] || { label: p.modePaiement }
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {formatFCFA(p.montant)}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {modeCfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(p.datePaiement)}
                            {p.reference && ` — Réf: ${p.reference}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <AddPaiementDialog
        open={paiementDialogOpen}
        onOpenChange={setPaiementDialogOpen}
        factureId={facture.id}
        factureNumero={facture.numero}
        resteAPayer={resteAPayer}
        onPaymentAdded={handlePaymentAdded}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CREATE FACTURE DIALOG
// ═══════════════════════════════════════════════════════════════

function CreateFactureDialog({
  open,
  onOpenChange,
  onCreated,
  clients,
  fetchClients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  clients: Client[]
  fetchClients: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState('')
  const [contratId, setContratId] = useState('')
  const [typeFacture, setTypeFacture] = useState('FACTURE')
  const [montantHT, setMontantHT] = useState('')
  const [tauxTVA, setTauxTVA] = useState('18')
  const [dateEcheance, setDateEcheance] = useState('')
  const [notes, setNotes] = useState('')

  // Contrats for selected client
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loadingContrats, setLoadingContrats] = useState(false)

  const montantHtNum = parseFloat(montantHT) || 0
  const tauxTvaNum = parseFloat(tauxTVA) || 0
  const montantTVA = Math.round(montantHtNum * tauxTvaNum / 100)
  const totalTTC = montantHtNum + montantTVA

  // Fetch contrats when client changes
  useEffect(() => {
    if (!clientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContrats([])
      setContratId('')
      return
    }
    const fetchContrats = async () => {
      setLoadingContrats(true)
      try {
        const res = await fetch(`/api/v1/contrats?clientId=${clientId}&limit=50`)
        if (res.ok) {
          const data = await res.json()
          setContrats(data.contrats || [])
        }
      } catch {
        // silent
      } finally {
        setLoadingContrats(false)
      }
    }
    fetchContrats()
  }, [clientId])

  // Open: fetch clients if empty
  useEffect(() => {
    if (open && clients.length === 0) {
      fetchClients()
    }
  }, [open, clients.length, fetchClients])

  // Reset on close
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setClientId('')
      setContratId('')
      setTypeFacture('FACTURE')
      setMontantHT('')
      setTauxTVA('18')
      setDateEcheance('')
      setNotes('')
      setContrats([])
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      toast.error('Veuillez sélectionner un client.')
      return
    }
    if (!montantHT || isNaN(parseFloat(montantHT)) || parseFloat(montantHT) < 0) {
      toast.error('Veuillez saisir un montant HT valide.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          contratId: contratId || undefined,
          typeFacture,
          montantHT: parseFloat(montantHT),
          tauxTVA: parseFloat(tauxTVA),
          dateEcheance: dateEcheance || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Facture ${data.facture.numero} créée avec succès`)
        handleClose(false)
        onCreated()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Nouvelle Facture
          </DialogTitle>
          <DialogDescription>Créer une nouvelle facture pour un client.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
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

          {/* Type Facture */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type de facture</Label>
            <Select value={typeFacture} onValueChange={setTypeFacture}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contrat Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Contrat (optionnel)</Label>
            {loadingContrats ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement des contrats...
              </div>
            ) : (
              <Select value={contratId} onValueChange={setContratId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder={!clientId ? 'Sélectionnez d\'abord un client' : 'Aucun contrat'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUCUN">Aucun contrat</SelectItem>
                  {contrats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} — {c.objet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Montant HT *</Label>
              <Input
                type="number"
                value={montantHT}
                onChange={(e) => setMontantHT(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Taux TVA (%)</Label>
              <Input
                type="number"
                value={tauxTVA}
                onChange={(e) => setTauxTVA(e.target.value)}
                placeholder="18"
                min="0"
                max="100"
              />
            </div>
          </div>

          {/* Auto-calculated */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVA :</span>
                  <span className="font-medium">{formatFCFA(montantTVA)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total TTC :</span>
                  <span className="font-bold text-emerald-600">{formatFCFA(totalTTC)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Echéance */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date d&apos;échéance</Label>
            <Input
              type="date"
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes ou conditions particulières..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// EDIT FACTURE DIALOG
// ═══════════════════════════════════════════════════════════════

function EditFactureDialog({
  open,
  onOpenChange,
  onUpdated,
  facture,
  clients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  facture: FactureListItem
  clients: Client[]
}) {
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState(facture.clientId)
  const [contratId, setContratId] = useState(facture.contrat?.id || '')
  const [typeFacture, setTypeFacture] = useState(facture.typeFacture)
  const [montantHT, setMontantHT] = useState(String(facture.montantHT))
  const [tauxTVA, setTauxTVA] = useState(String(facture.tauxTVA))
  const [dateEcheance, setDateEcheance] = useState(
    facture.dateEcheance ? format(new Date(facture.dateEcheance), 'yyyy-MM-dd') : ''
  )
  const [notes, setNotes] = useState(facture.notes || '')

  // Contrats for selected client
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loadingContrats, setLoadingContrats] = useState(false)

  const montantHtNum = parseFloat(montantHT) || 0
  const tauxTvaNum = parseFloat(tauxTVA) || 0
  const montantTVA = Math.round(montantHtNum * tauxTvaNum / 100)
  const totalTTC = montantHtNum + montantTVA

  useEffect(() => {
    if (!clientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContrats([])
      setContratId('')
      return
    }
    const fetchContrats = async () => {
      setLoadingContrats(true)
      try {
        const res = await fetch(`/api/v1/contrats?clientId=${clientId}&limit=50`)
        if (res.ok) {
          const data = await res.json()
          setContrats(data.contrats || [])
        }
      } catch {
        // silent
      } finally {
        setLoadingContrats(false)
      }
    }
    fetchContrats()
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      toast.error('Veuillez sélectionner un client.')
      return
    }
    if (!montantHT || isNaN(parseFloat(montantHT)) || parseFloat(montantHT) < 0) {
      toast.error('Veuillez saisir un montant HT valide.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/facturation/${facture.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          contratId: contratId === 'AUCUN' ? null : contratId || null,
          typeFacture,
          montantHT: parseFloat(montantHT),
          tauxTVA: parseFloat(tauxTVA),
          dateEcheance: dateEcheance || null,
          notes: notes.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Facture modifiée avec succès')
        onUpdated()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-emerald-600" />
            Modifier la facture {facture.numero}
          </DialogTitle>
          <DialogDescription>Modifier les informations de la facture.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
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

          {/* Type Facture */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type de facture</Label>
            <Select value={typeFacture} onValueChange={setTypeFacture}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contrat Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Contrat (optionnel)</Label>
            {loadingContrats ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
              </div>
            ) : (
              <Select value={contratId || 'AUCUN'} onValueChange={setContratId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun contrat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUCUN">Aucun contrat</SelectItem>
                  {contrats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} — {c.objet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Montant HT *</Label>
              <Input
                type="number"
                value={montantHT}
                onChange={(e) => setMontantHT(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Taux TVA (%)</Label>
              <Input
                type="number"
                value={tauxTVA}
                onChange={(e) => setTauxTVA(e.target.value)}
                placeholder="18"
                min="0"
                max="100"
              />
            </div>
          </div>

          {/* Auto-calculated */}
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVA :</span>
                  <span className="font-medium">{formatFCFA(montantTVA)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total TTC :</span>
                  <span className="font-bold text-emerald-600">{formatFCFA(totalTTC)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Echéance */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date d&apos;échéance</Label>
            <Input
              type="date"
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes ou conditions particulières..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD PAIEMENT DIALOG
// ═══════════════════════════════════════════════════════════════

function AddPaiementDialog({
  open,
  onOpenChange,
  factureId,
  factureNumero,
  resteAPayer,
  onPaymentAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  factureId: string
  factureNumero: string
  resteAPayer: number
  onPaymentAdded: (paiement: Paiement) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [montant, setMontant] = useState('')
  const [modePaiement, setModePaiement] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setMontant('')
      setModePaiement('')
      setReference('')
      setNotes('')
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
      toast.error('Veuillez saisir un montant valide.')
      return
    }
    if (!modePaiement) {
      toast.error('Veuillez sélectionner un mode de paiement.')
      return
    }

    const montantNum = parseFloat(montant)
    if (montantNum > resteAPayer) {
      toast.error(`Le montant ne peut pas dépasser ${formatFCFA(resteAPayer)}`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/facturation/${factureId}/paiements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant: montantNum,
          modePaiement,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Paiement de ${formatFCFA(montantNum)} enregistré`)
        onPaymentAdded(data.paiement)
        handleClose(false)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'ajout du paiement')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            Ajouter un paiement
          </DialogTitle>
          <DialogDescription>
            Facture {factureNumero} — Reste à payer :{' '}
            <span className="font-semibold text-red-600">{formatFCFA(resteAPayer)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Montant *</Label>
            <Input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={`Max: ${formatFCFA(resteAPayer)}`}
              min="0"
              max={resteAPayer}
              step="any"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Mode de paiement *</Label>
            <Select value={modePaiement} onValueChange={setModePaiement}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODE_PAIEMENT_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Référence</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Numéro de référence (optionnel)"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur le paiement..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: STATISTIQUES
// ═══════════════════════════════════════════════════════════════

function StatistiquesTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/facturation/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        toast.error('Erreur de chargement des statistiques')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </motion.div>
    )
  }

  if (!stats) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="py-16 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <p className="text-muted-foreground">Impossible de charger les statistiques.</p>
        </CardContent>
      </Card>
    )
  }

  const { general, facturesEnRetard, repartitionStatut, repartitionType, topClients, mensuel } = stats

  const kpiCards = [
    {
      title: 'Total facturé',
      value: formatFCFA(general.totalFacture),
      icon: CircleDollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      description: `${general.nombreFactures} facture${general.nombreFactures !== 1 ? 's' : ''}`,
    },
    {
      title: 'Total encaissé',
      value: formatFCFA(general.totalEncaisse),
      icon: Wallet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      description: 'Montant total perçu',
    },
    {
      title: 'Taux de recouvrement',
      value: `${general.tauxRecouvrement}%`,
      icon: TrendingUp,
      color: general.tauxRecouvrement >= 70 ? 'text-emerald-600' : general.tauxRecouvrement >= 40 ? 'text-amber-600' : 'text-red-600',
      bg: general.tauxRecouvrement >= 70 ? 'bg-emerald-50 dark:bg-emerald-500/10' : general.tauxRecouvrement >= 40 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10',
      border: general.tauxRecouvrement >= 70 ? 'border-emerald-200 dark:border-emerald-500/20' : general.tauxRecouvrement >= 40 ? 'border-amber-200 dark:border-amber-500/20' : 'border-red-200 dark:border-red-500/20',
      description: 'Sur le total facturé',
    },
    {
      title: 'Factures en retard',
      value: String(facturesEnRetard.nombre),
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/20',
      description: formatFCFA(facturesEnRetard.montantImpaye) + ' impayé(s)',
    },
  ]

  // Max montant for distribution bar widths
  const maxTypeMontant = Math.max(...repartitionType.map((r) => r.montantTotal), 1)
  const maxStatusMontant = Math.max(...repartitionStatut.map((r) => r.montantTotal), 1)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          Statistiques de facturation
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de votre activité de facturation
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
            >
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 lg:p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                      <p className={cn('text-2xl lg:text-3xl font-bold mt-1', card.color === 'text-emerald-600' ? 'text-foreground' : card.color)}>
                        {card.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </div>
                    <div className={cn('p-2 lg:p-2.5 rounded-lg border', card.bg, card.border)}>
                      <Icon className={cn('w-4.5 h-4.5 lg:w-5 lg:h-5', card.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Monthly Revenue */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-5 pt-5">
          <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
            <CalendarDays className="w-4.5 h-4.5 text-emerald-500" />
            Revenus mensuels (6 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-center">Factures</TableHead>
                  <TableHead className="text-right">Facturé</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Impayé</TableHead>
                  <TableHead className="text-right w-32">Taux recouvrement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mensuel.map((m, i) => {
                  const taux = m.facture > 0 ? Math.round((m.encaisse / m.facture) * 100) : 0
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm capitalize">{m.mois}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{m.nombre}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatFCFA(m.facture)}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600">{formatFCFA(m.encaisse)}</TableCell>
                      <TableCell className="text-right text-sm text-red-600">{formatFCFA(m.impaye)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Progress
                            value={taux}
                            className="w-16 h-2 [&>div]:bg-emerald-500"
                          />
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">{taux}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-emerald-500" />
              Top 5 Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {topClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topClients.map((tc, i) => {
                  const taux = tc.montantTotal > 0 ? Math.round((tc.montantPaye / tc.montantTotal) * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-600">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tc.client?.raisonSociale || 'Client inconnu'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tc.nombreFactures} facture{tc.nombreFactures !== 1 ? 's' : ''} — {taux}% payé
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatFCFA(tc.montantTotal)}</p>
                        <p className="text-xs text-emerald-600">{formatFCFA(tc.montantPaye)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution by Type */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <PieChart className="w-4.5 h-4.5 text-emerald-500" />
              Répartition par type
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {repartitionType.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <div className="space-y-4">
                {repartitionType.map((rt) => {
                  const typeCfg = TYPE_CONFIG[rt.type] || TYPE_CONFIG.FACTURE
                  const widthPct = Math.max(5, (rt.montantTotal / maxTypeMontant) * 100)
                  return (
                    <div key={rt.type} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', typeCfg.className)}>
                            {typeCfg.label}
                          </Badge>
                          <span className="text-muted-foreground">
                            ({rt.nombre} facture{rt.nombre !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{formatFCFA(rt.montantTotal)}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                          className={cn(
                            'h-full rounded-full',
                            rt.type === 'FACTURE' && 'bg-emerald-500',
                            rt.type === 'ACOMPTE' && 'bg-sky-500',
                            rt.type === 'SITUATION' && 'bg-violet-500',
                            rt.type === 'SOLDE' && 'bg-orange-500',
                          )}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribution by Status */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-5 pt-5">
          <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
            <BarChart3 className="w-4.5 h-4.5 text-emerald-500" />
            Répartition par statut
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {repartitionStatut.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune donnée disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {repartitionStatut.map((rs) => {
                const statusCfg = STATUS_CONFIG[rs.statut] || STATUS_CONFIG.BROUILLON
                const widthPct = Math.max(5, (rs.montantTotal / maxStatusMontant) * 100)
                return (
                  <div key={rs.statut} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 border', statusCfg.className)}>
                        {statusCfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{rs.nombre} facture{rs.nombre !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{formatFCFA(rs.montantTotal)}</p>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={cn(
                          'h-full rounded-full',
                          rs.statut === 'BROUILLON' && 'bg-stone-400',
                          rs.statut === 'ENVOYE' && 'bg-blue-500',
                          rs.statut === 'PAYEE' && 'bg-emerald-500',
                          rs.statut === 'PARTIELLEMENT_PAYEE' && 'bg-amber-500',
                          (rs.statut === 'ANNULEE' || rs.statut === 'EN_RETARD') && 'bg-red-500',
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Payé : {formatFCFA(rs.montantPaye)}</span>
                      <span>Reste : {formatFCFA(rs.montantTotal - rs.montantPaye)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
