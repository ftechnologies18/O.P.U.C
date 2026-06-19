'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  FileText,
  Building2,
  Users,
  CircleDollarSign,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FilterX,
  MoreHorizontal,
  UserCircle,
  Briefcase,
  ScrollText,
  ClipboardList,
  Receipt,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  Target,
  Landmark,
  User,
  LayoutDashboard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type ClientStatut = 'ACTIF' | 'INACTIF' | 'PROSPECT'
type ClientType = 'ENTREPRISE' | 'PARTICULIER' | 'INSTITUTION'

interface ClientList {
  id: string
  raisonSociale: string
  nomContact: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  rccm: string | null
  nif: string | null
  type: ClientType
  statut: ClientStatut
  notes: string | null
  entrepriseId: string
  createdAt: string
  updatedAt: string
  _count: {
    chantiers: number
    contrats: number
  }
}

interface ClientDetail {
  id: string
  raisonSociale: string
  nomContact: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  rccm: string | null
  nif: string | null
  type: ClientType
  statut: ClientStatut
  notes: string | null
  entrepriseId: string
  createdAt: string
  updatedAt: string
  chantiers: ChantierBrief[]
  devis: DevisBrief[]
  contrats: ContratBrief[]
  factures: FactureBrief[]
}

interface ChantierBrief {
  id: string
  nom: string
  statut: string
  createdAt: string
}

interface DevisBrief {
  id: string
  numero: string
  montantTTC: number
  statut: string
  createdAt: string
}

interface ContratBrief {
  id: string
  objet: string
  montantHT: number
  statut: string
  createdAt: string
}

interface FactureBrief {
  id: string
  numero: string
  montantTTC: number
  statut: string
  createdAt: string
}

interface ClientStats {
  total: number
  actifs: number
  prospects: number
  inactifs: number
  topRevenue: Array<{ id: string; raisonSociale: string; revenue: number }>
  topChantiers: Array<{ id: string; raisonSociale: string; count: number }>
  recentClients: ClientList[]
  revenueByType: Array<{ type: ClientType; revenue: number }>
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ClientFormData {
  raisonSociale: string
  nomContact: string
  telephone: string
  email: string
  adresse: string
  rccm: string
  nif: string
  type: ClientType
  statut: ClientStatut
  notes: string
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIF: {
    label: 'Actif',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  INACTIF: {
    label: 'Inactif',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  },
  PROSPECT: {
    label: 'Prospect',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

const TYPE_CONFIG: Record<string, { label: string; className: string; icon: typeof Building2 }> = {
  ENTREPRISE: {
    label: 'Entreprise',
    className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Building2,
  },
  PARTICULIER: {
    label: 'Particulier',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400',
    icon: User,
  },
  INSTITUTION: {
    label: 'Institution',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
    icon: Landmark,
  },
}

const EMPTY_CLIENT_FORM: ClientFormData = {
  raisonSociale: '',
  nomContact: '',
  telephone: '',
  email: '',
  adresse: '',
  rccm: '',
  nif: '',
  type: 'ENTREPRISE',
  statut: 'PROSPECT',
  notes: '',
}

const ITEMS_PER_PAGE = 10

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' F'
}

function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy', { locale: fr })
}

function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

function getStatutBadge(statut: string) {
  return STATUT_CONFIG[statut] || { label: statut, className: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function getTypeBadge(type: string) {
  return TYPE_CONFIG[type] || { label: type, className: 'bg-gray-100 text-gray-600 border-gray-200', icon: Building2 }
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETONS
// ═══════════════════════════════════════════════════════════════

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-16" />
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
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ClientsView() {
  const [activeTab, setActiveTab] = useState('liste')

  // ── Liste Clients state ──────────────────────────────────────
  const [clients, setClients] = useState<ClientList[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // ── Dashboard state ──────────────────────────────────────────
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // ── Detail state ────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Create/Edit dialog state ─────────────────────────────────
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ClientFormData>(EMPTY_CLIENT_FORM)
  const [submitting, setSubmitting] = useState(false)

  // ── Delete dialog state ──────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClientList | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ═══════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════

  const fetchClients = useCallback(
    async (page: number = 1, search?: string, statut?: string, type?: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(ITEMS_PER_PAGE))
        if (search) params.set('search', search)
        if (statut) params.set('statut', statut)
        if (type) params.set('type', type)

        const res = await fetch(`/api/v1/clients?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setClients(data.clients || [])
          setPagination(
            data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 }
          )
        } else {
          toast.error('Erreur lors du chargement des clients')
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/v1/clients/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      toast.error('Erreur lors du chargement des statistiques')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchClientDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setSelectedClient(null)
    try {
      const res = await fetch(`/api/v1/clients/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedClient(data)
      } else {
        toast.error('Erreur lors du chargement des détails')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ── Load on tab change / filter change ─────────────────────
  useEffect(() => {
    if (activeTab === 'liste') {
      fetchClients(currentPage, searchQuery, statutFilter, typeFilter)
    } else if (activeTab === 'dashboard') {
      fetchStats()
    }
  }, [activeTab, currentPage, fetchClients, fetchStats, searchQuery, statutFilter, typeFilter])

  // ═══════════════════════════════════════════════════════════
  // SEARCH & FILTER
  // ═══════════════════════════════════════════════════════════

  const handleSearch = () => {
    setCurrentPage(1)
    fetchClients(1, searchQuery, statutFilter, typeFilter)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatutFilter('')
    setTypeFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statutFilter || typeFilter

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════

  const openCreateDialog = () => {
    setEditingClientId(null)
    setFormData({ ...EMPTY_CLIENT_FORM })
    setFormDialogOpen(true)
  }

  const openEditDialog = (client: ClientList) => {
    setEditingClientId(client.id)
    setFormData({
      raisonSociale: client.raisonSociale,
      nomContact: client.nomContact || '',
      telephone: client.telephone || '',
      email: client.email || '',
      adresse: client.adresse || '',
      rccm: client.rccm || '',
      nif: client.nif || '',
      type: client.type,
      statut: client.statut,
      notes: '',
    })
    setFormDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.raisonSociale.trim()) {
      toast.error('La raison sociale est requise')
      return
    }

    setSubmitting(true)
    try {
      const body = {
        raisonSociale: formData.raisonSociale.trim(),
        nomContact: formData.nomContact.trim() || null,
        telephone: formData.telephone.trim() || null,
        email: formData.email.trim() || null,
        adresse: formData.adresse.trim() || null,
        rccm: formData.rccm.trim() || null,
        nif: formData.nif.trim() || null,
        type: formData.type,
        statut: formData.statut,
        notes: formData.notes.trim() || null,
      }

      let res: Response
      if (editingClientId) {
        res = await fetch(`/api/v1/clients/${editingClientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingClientId
            ? 'Client mis à jour avec succès'
            : 'Client créé avec succès'
        )
        setFormDialogOpen(false)
        fetchClients(currentPage, searchQuery, statutFilter, typeFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────

  const confirmDelete = (client: ClientList) => {
    setDeleteTarget(client)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/clients/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success(`Client "${deleteTarget.raisonSociale}" supprimé`)
        setDeleteDialogOpen(false)
        fetchClients(currentPage, searchQuery, statutFilter, typeFilter)
        // If we're viewing details of this client, go back
        if (selectedClient?.id === deleteTarget.id) {
          setSelectedClient(null)
          setActiveTab('liste')
        }
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

  // ── View Details ─────────────────────────────────────────────

  const openClientDetail = (client: ClientList) => {
    setActiveTab('detail')
    fetchClientDetail(client.id)
  }

  const handleBackToList = () => {
    setSelectedClient(null)
    setActiveTab('liste')
  }

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD STATS CARDS
  // ═══════════════════════════════════════════════════════════

  const dashboardStatCards = stats
    ? [
        {
          title: 'Total Clients',
          value: stats.total,
          icon: Users,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          border: 'border-emerald-200 dark:border-emerald-500/20',
        },
        {
          title: 'Clients Actifs',
          value: stats.actifs,
          icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          border: 'border-emerald-200 dark:border-emerald-500/20',
        },
        {
          title: 'Prospects',
          value: stats.prospects,
          icon: Target,
          color: 'text-amber-600',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          border: 'border-amber-200 dark:border-amber-500/20',
        },
        {
          title: 'Inactifs',
          value: stats.inactifs,
          icon: UserCircle,
          color: 'text-red-600',
          bg: 'bg-red-50 dark:bg-red-500/10',
          border: 'border-red-200 dark:border-red-500/20',
        },
      ]
    : []

  // ═══════════════════════════════════════════════════════════
  // RENDER — MAIN
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCircle className="w-6 h-6 text-emerald-600" />
            Gestion des Clients
          </h2>
          <p className="text-[15px] text-muted-foreground mt-1">
            CRM — Gérez vos clients, prospects et institutions
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau Client
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="liste" className="gap-1.5">
            <Users className="w-4 h-4 hidden sm:block" />
            Liste Clients
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="w-4 h-4 hidden sm:block" />
            Tableau de Bord
          </TabsTrigger>
          <TabsTrigger value="detail" className="gap-1.5" disabled={!selectedClient}>
            <Eye className="w-4 h-4 hidden sm:block" />
            Détails Client
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════
            TAB 1: LISTE CLIENTS
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="liste">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
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
                      placeholder="Rechercher par raison sociale, contact, email, téléphone..."
                      className="pl-9"
                    />
                  </div>
                  <Select value={statutFilter || 'TOUS'} onValueChange={(v) => setStatutFilter(v === 'TOUS' ? '' : v)}>
                    <SelectTrigger className="sm:w-[160px]">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOUS">Tous les statuts</SelectItem>
                      <SelectItem value="ACTIF">Actif</SelectItem>
                      <SelectItem value="INACTIF">Inactif</SelectItem>
                      <SelectItem value="PROSPECT">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter || 'TOUS'} onValueChange={(v) => setTypeFilter(v === 'TOUS' ? '' : v)}>
                    <SelectTrigger className="sm:w-[170px]">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TOUS">Tous les types</SelectItem>
                      <SelectItem value="ENTREPRISE">Entreprise</SelectItem>
                      <SelectItem value="PARTICULIER">Particulier</SelectItem>
                      <SelectItem value="INSTITUTION">Institution</SelectItem>
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

            {/* Client Table */}
            {loading ? (
              <TableSkeleton rows={5} />
            ) : clients.length === 0 ? (
              <Card className="border shadow-sm">
                <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                    <UserCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {hasFilters ? 'Aucun résultat' : 'Aucun client'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasFilters
                      ? 'Aucun client ne correspond à vos critères de recherche.'
                      : 'Commencez par créer un nouveau client.'}
                  </p>
                  {!hasFilters && (
                    <Button
                      onClick={openCreateDialog}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Nouveau Client
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
                          <TableHead className="pl-4">Client</TableHead>
                          <TableHead className="hidden md:table-cell">Contact</TableHead>
                          <TableHead className="hidden lg:table-cell">Email</TableHead>
                          <TableHead className="text-center">Type</TableHead>
                          <TableHead className="text-center">Statut</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">Chantiers</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">Contrats</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((client, index) => {
                          const statut = getStatutBadge(client.statut)
                          const typeInfo = getTypeBadge(client.type)
                          const TypeIcon = typeInfo.icon

                          return (
                            <motion.tr
                              key={client.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.03 }}
                              className="border-b transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="pl-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <TypeIcon className="w-4 h-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground text-sm">
                                      {client.raisonSociale}
                                    </p>
                                    {client.nomContact && (
                                      <p className="text-xs text-muted-foreground">
                                        {client.nomContact}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {client.telephone ? (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {client.telephone}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {client.email ? (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {client.email}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={cn('text-xs', typeInfo.className)}>
                                  {typeInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={cn('text-xs', statut.className)}>
                                  {statut.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center hidden sm:table-cell">
                                <Badge variant="secondary" className="text-xs font-semibold">
                                  {client._count.chantiers}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center hidden sm:table-cell">
                                <Badge variant="secondary" className="text-xs">
                                  {client._count.contrats}
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
                                    <DropdownMenuItem onClick={() => openClientDetail(client)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Voir détails
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditDialog(client)}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => confirmDelete(client)}
                                      className="text-red-600 focus:text-red-600"
                                    >
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

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        {(pagination.page - 1) * pagination.limit + 1}–
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
          </motion.div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2: TABLEAU DE BORD
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-4">
            {/* Stats Cards */}
            {statsLoading ? (
              <StatsSkeleton />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {dashboardStatCards.map((card, index) => {
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 5 clients by revenue */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <CircleDollarSign className="w-4.5 h-4.5 text-emerald-500" />
                    Top 5 Clients — Chiffre d&apos;affaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : stats?.topRevenue && stats.topRevenue.length > 0 ? (
                    <div className="space-y-3">
                      {stats.topRevenue.map((client, idx) => {
                        const maxRevenue = stats.topRevenue[0]?.revenue || 1
                        const percentage = (client.revenue / maxRevenue) * 100
                        return (
                          <div key={client.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground truncate flex-1 mr-4">
                                <span className="text-muted-foreground mr-2">#{idx + 1}</span>
                                {client.raisonSociale}
                              </span>
                              <span className="text-foreground font-semibold shrink-0">
                                {formatFCFA(client.revenue)}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                className="h-full bg-emerald-500 rounded-full"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Aucune donnée de revenus disponible</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 clients by chantiers count */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <ClipboardList className="w-4.5 h-4.5 text-amber-500" />
                    Top 5 Clients — Chantiers
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                      ))}
                    </div>
                  ) : stats?.topChantiers && stats.topChantiers.length > 0 ? (
                    <div className="space-y-3">
                      {stats.topChantiers.map((client, idx) => {
                        const maxCount = stats.topChantiers[0]?.count || 1
                        const percentage = (client.count / maxCount) * 100
                        return (
                          <div key={client.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground truncate flex-1 mr-4">
                                <span className="text-muted-foreground mr-2">#{idx + 1}</span>
                                {client.raisonSociale}
                              </span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {client.count} chantier{client.count > 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                className="h-full bg-amber-500 rounded-full"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <ClipboardList className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Aucune donnée de chantiers disponible</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent clients */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Calendar className="w-4.5 h-4.5 text-sky-500" />
                    Clients récents
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-lg" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : stats?.recentClients && stats.recentClients.length > 0 ? (
                    <ScrollArea className="max-h-72">
                      <div className="space-y-2">
                        {stats.recentClients.map((client) => {
                          const statut = getStatutBadge(client.statut)
                          const typeInfo = getTypeBadge(client.type)
                          const TypeIcon = typeInfo.icon
                          return (
                            <button
                              key={client.id}
                              onClick={() => openClientDetail(client)}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left"
                            >
                              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <TypeIcon className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {client.raisonSociale}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatRelativeTime(client.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statut.className)}>
                                  {statut.label}
                                </Badge>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Users className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Aucun client récent</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue by type */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-violet-500" />
                    Répartition par type
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {statsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-6 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : stats?.revenueByType && stats.revenueByType.length > 0 ? (
                    <div className="space-y-4">
                      {stats.revenueByType.map((item) => {
                        const typeInfo = getTypeBadge(item.type)
                        const totalRevenue = stats.revenueByType.reduce((sum, r) => sum + r.revenue, 0) || 1
                        const percentage = (item.revenue / totalRevenue) * 100
                        const barColors: Record<string, string> = {
                          ENTREPRISE: 'bg-violet-500',
                          PARTICULIER: 'bg-sky-500',
                          INSTITUTION: 'bg-orange-500',
                        }
                        return (
                          <div key={item.type} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <Badge variant="outline" className={cn('text-xs', typeInfo.className)}>
                                {typeInfo.label}
                              </Badge>
                              <span className="font-semibold text-foreground">
                                {formatFCFA(item.revenue)}
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className={cn('h-full rounded-full', barColors[item.type] || 'bg-gray-500')}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-right">
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Aucune donnée de revenus disponible</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 3: DÉTAILS CLIENT
        ═══════════════════════════════════════════════════════ */}
        <TabsContent value="detail">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
            {/* Back button */}
            <Button variant="outline" onClick={handleBackToList} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à la liste
            </Button>

            {detailLoading ? (
              <div className="space-y-4">
                <Card className="border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-14 w-14 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="border shadow-sm">
                    <CardContent className="p-6">
                      <Skeleton className="h-5 w-32 mb-4" />
                      <div className="space-y-2">
                        {[...Array(3)].map((_, j) => (
                          <Skeleton key={j} className="h-4 w-full" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : selectedClient ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedClient.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Client Info Card */}
                  <Card className="border shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                            {(() => {
                              const typeInfo = getTypeBadge(selectedClient.type)
                              const TypeIcon = typeInfo.icon
                              return <TypeIcon className="w-7 h-7 text-emerald-600" />
                            })()}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-foreground">
                              {selectedClient.raisonSociale}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className={cn('text-xs', getTypeBadge(selectedClient.type).className)}>
                                {getTypeBadge(selectedClient.type).label}
                              </Badge>
                              <Badge variant="outline" className={cn('text-xs', getStatutBadge(selectedClient.statut).className)}>
                                {getStatutBadge(selectedClient.statut).label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            onClick={() => openEditDialog(selectedClient as unknown as ClientList)}
                            className="gap-2"
                          >
                            <Pencil className="w-4 h-4" />
                            Modifier
                          </Button>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        {selectedClient.nomContact && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserCircle className="w-4 h-4 shrink-0" />
                            <span className="truncate">{selectedClient.nomContact}</span>
                          </div>
                        )}
                        {selectedClient.telephone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4 shrink-0" />
                            <span className="truncate">{selectedClient.telephone}</span>
                          </div>
                        )}
                        {selectedClient.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4 shrink-0" />
                            <span className="truncate">{selectedClient.email}</span>
                          </div>
                        )}
                        {selectedClient.adresse && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{selectedClient.adresse}</span>
                          </div>
                        )}
                        {selectedClient.rccm && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <ScrollText className="w-4 h-4 shrink-0" />
                            <span className="truncate">RCCM: {selectedClient.rccm}</span>
                          </div>
                        )}
                        {selectedClient.nif && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">NIF: {selectedClient.nif}</span>
                          </div>
                        )}
                      </div>

                      {selectedClient.notes && (
                        <>
                          <Separator className="my-4" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{selectedClient.notes}</p>
                          </div>
                        </>
                      )}

                      <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">
                        Créé le {format(new Date(selectedClient.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        {selectedClient.updatedAt !== selectedClient.createdAt && (
                          <span>
                            {' '}· Mis à jour{' '}
                            {formatRelativeTime(selectedClient.updatedAt)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Chantiers', value: selectedClient.chantiers?.length || 0, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200' },
                      { label: 'Devis', value: selectedClient.devis?.length || 0, icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200' },
                      { label: 'Contrats', value: selectedClient.contrats?.length || 0, icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200' },
                      { label: 'Factures', value: selectedClient.factures?.length || 0, icon: Receipt, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200' },
                    ].map((stat) => {
                      const Icon = stat.icon
                      return (
                        <Card key={stat.label} className="border shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                                <p className="text-xl font-bold text-foreground mt-1">{stat.value}</p>
                              </div>
                              <div className={cn('p-2 rounded-lg border', stat.bg, stat.border)}>
                                <Icon className={cn('w-4 h-4', stat.color)} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Related Chantiers */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 px-5 pt-5">
                      <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                        <Briefcase className="w-4.5 h-4.5 text-amber-500" />
                        Chantiers associés
                        <Badge variant="secondary" className="text-xs ml-1">
                          {selectedClient.chantiers?.length || 0}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {selectedClient.chantiers && selectedClient.chantiers.length > 0 ? (
                        <ScrollArea className="max-h-48">
                          <div className="space-y-2">
                            {selectedClient.chantiers.map((chantier) => {
                              const chantierStatut = getStatutBadge(chantier.statut)
                              return (
                                <div
                                  key={chantier.id}
                                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium text-foreground truncate">
                                      {chantier.nom}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', chantierStatut.className)}>
                                      {chantierStatut.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                      {formatDate(chantier.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                          <Briefcase className="w-6 h-6 mb-1.5 opacity-50" />
                          <p className="text-sm">Aucun chantier associé</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Related Devis */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 px-5 pt-5">
                      <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                        <FileText className="w-4.5 h-4.5 text-sky-500" />
                        Devis associés
                        <Badge variant="secondary" className="text-xs ml-1">
                          {selectedClient.devis?.length || 0}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {selectedClient.devis && selectedClient.devis.length > 0 ? (
                        <ScrollArea className="max-h-48">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>N° Devis</TableHead>
                                <TableHead className="text-right hidden sm:table-cell">Montant TTC</TableHead>
                                <TableHead className="text-center">Statut</TableHead>
                                <TableHead className="hidden sm:table-cell">Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClient.devis.map((devis) => {
                                const devisStatut = getStatutBadge(devis.statut)
                                return (
                                  <TableRow key={devis.id}>
                                    <TableCell className="text-sm font-medium">{devis.numero}</TableCell>
                                    <TableCell className="text-right hidden sm:table-cell text-sm">
                                      {formatFCFA(devis.montantTTC)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', devisStatut.className)}>
                                        {devisStatut.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                      {formatDate(devis.createdAt)}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                          <FileText className="w-6 h-6 mb-1.5 opacity-50" />
                          <p className="text-sm">Aucun devis associé</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Related Contrats */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 px-5 pt-5">
                      <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                        <Receipt className="w-4.5 h-4.5 text-emerald-500" />
                        Contrats associés
                        <Badge variant="secondary" className="text-xs ml-1">
                          {selectedClient.contrats?.length || 0}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {selectedClient.contrats && selectedClient.contrats.length > 0 ? (
                        <ScrollArea className="max-h-48">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Objet</TableHead>
                                <TableHead className="text-right hidden sm:table-cell">Montant HT</TableHead>
                                <TableHead className="text-center">Statut</TableHead>
                                <TableHead className="hidden sm:table-cell">Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClient.contrats.map((contrat) => {
                                const contratStatut = getStatutBadge(contrat.statut)
                                return (
                                  <TableRow key={contrat.id}>
                                    <TableCell className="text-sm font-medium truncate max-w-[200px]">
                                      {contrat.objet}
                                    </TableCell>
                                    <TableCell className="text-right hidden sm:table-cell text-sm">
                                      {formatFCFA(contrat.montantHT)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', contratStatut.className)}>
                                        {contratStatut.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                      {formatDate(contrat.createdAt)}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                          <Receipt className="w-6 h-6 mb-1.5 opacity-50" />
                          <p className="text-sm">Aucun contrat associé</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Related Factures */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 px-5 pt-5">
                      <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                        <Receipt className="w-4.5 h-4.5 text-violet-500" />
                    Factures associées
                    <Badge variant="secondary" className="text-xs ml-1">
                      {selectedClient.factures?.length || 0}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {selectedClient.factures && selectedClient.factures.length > 0 ? (
                    <ScrollArea className="max-h-48">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>N° Facture</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Montant TTC</TableHead>
                            <TableHead className="text-center">Statut</TableHead>
                            <TableHead className="hidden sm:table-cell">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedClient.factures.map((facture) => {
                            const factureStatut = getStatutBadge(facture.statut)
                            return (
                              <TableRow key={facture.id}>
                                <TableCell className="text-sm font-medium">{facture.numero}</TableCell>
                                <TableCell className="text-right hidden sm:table-cell text-sm">
                                  {formatFCFA(facture.montantTTC)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', factureStatut.className)}>
                                    {factureStatut.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                  {formatDate(facture.createdAt)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Receipt className="w-6 h-6 mb-1.5 opacity-50" />
                      <p className="text-sm">Aucune facture associée</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        ) : (
          <Card className="border shadow-sm">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                <UserCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Aucun client sélectionné</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sélectionnez un client dans la liste pour voir ses détails.
              </p>
              <Button
                onClick={handleBackToList}
                variant="outline"
                className="mt-4 gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voir la liste des clients
              </Button>
            </CardContent>
          </Card>
        )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════
          CREATE / EDIT DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => !open && setFormDialogOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClientId ? 'Modifier le client' : 'Nouveau client'}
            </DialogTitle>
            <DialogDescription>
              {editingClientId
                ? 'Modifiez les informations du client ci-dessous.'
                : 'Remplissez les informations pour ajouter un nouveau client.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Raison sociale */}
            <div className="grid gap-2">
              <Label htmlFor="clientRaisonSociale">
                Raison sociale <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientRaisonSociale"
                placeholder="Ex: SOGEA SATOM CI"
                value={formData.raisonSociale}
                onChange={(e) => setFormData({ ...formData, raisonSociale: e.target.value })}
              />
            </div>

            {/* Nom du contact */}
            <div className="grid gap-2">
              <Label htmlFor="clientNomContact">Nom du contact</Label>
              <Input
                id="clientNomContact"
                placeholder="Ex: M. Koné Ibrahim"
                value={formData.nomContact}
                onChange={(e) => setFormData({ ...formData, nomContact: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Téléphone */}
              <div className="grid gap-2">
                <Label htmlFor="clientTelephone">Téléphone</Label>
                <Input
                  id="clientTelephone"
                  placeholder="Ex: +225 07 08 09 10 11"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="Ex: contact@sogea.ci"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Adresse */}
            <div className="grid gap-2">
              <Label htmlFor="clientAdresse">Adresse</Label>
              <Input
                id="clientAdresse"
                placeholder="Ex: 10 Bd de France, Plateau, Abidjan"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* RCCM */}
              <div className="grid gap-2">
                <Label htmlFor="clientRccm">N° RCCM</Label>
                <Input
                  id="clientRccm"
                  placeholder="Ex: CI-ABI-2000-B-12345"
                  value={formData.rccm}
                  onChange={(e) => setFormData({ ...formData, rccm: e.target.value })}
                />
              </div>

              {/* NIF */}
              <div className="grid gap-2">
                <Label htmlFor="clientNif">NIF</Label>
                <Input
                  id="clientNif"
                  placeholder="Ex: 1234567890A"
                  value={formData.nif}
                  onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as ClientType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTREPRISE">Entreprise</SelectItem>
                    <SelectItem value="PARTICULIER">Particulier</SelectItem>
                    <SelectItem value="INSTITUTION">Institution</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Statut */}
              <div className="grid gap-2">
                <Label>Statut</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(v) => setFormData({ ...formData, statut: v as ClientStatut })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSPECT">Prospect</SelectItem>
                    <SelectItem value="ACTIF">Actif</SelectItem>
                    <SelectItem value="INACTIF">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="clientNotes">Notes</Label>
              <Textarea
                id="clientNotes"
                placeholder="Notes complémentaires sur le client..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFormDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingClientId ? 'Enregistrer' : 'Créer le client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DELETE CONFIRMATION DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer le client
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le client &quot;{deleteTarget?.raisonSociale}&quot; ?
              Cette action est réversible. Le client sera désactivé.
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
    </div>
  )
}


