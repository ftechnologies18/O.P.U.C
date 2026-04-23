'use client'

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2,
  Users,
  ClipboardList,
  DollarSign,
  TrendingUp,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
  Lock,
  Unlock,
  Shield,
  Settings,
  ScrollText,
  BarChart3,
  Search,
  FilterX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Globe,
  Bell,
  Calendar,
  Info,
  ChevronDown,
  Download,
  UserCog,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

interface Entreprise {
  id: string
  nom: string
  adresse: string | null
  telephone: string | null
  email: string | null
  createdAt: string
  updatedAt: string
  _count: {
    users: number
    chantiers: number
  }
}

interface PlatformUser {
  id: string
  email: string
  name: string
  role: string
  telephone: string | null
  active: boolean
  entrepriseId: string | null
  entreprise: { id: string; nom: string } | null
  lastLoginAt: string | null
  createdAt: string
}

interface AuditLogEntry {
  id: string
  userId: string
  utilisateur: {
    id: string
    name: string
    email: string
    role: string | null
  }
  entrepriseId: string | null
  action: string
  module: string
  entityId: string | null
  entityType: string | null
  details: string | null
  adresseIp: string | null
  createdAt: string
}

interface PlatformStats {
  totalEntreprises: number
  totalUtilisateurs: number
  chantiersActifs: number
  revenusMensuels: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface EntrepriseFormData {
  nom: string
  adresse: string
  telephone: string
  email: string
  gerantName: string
  gerantEmail: string
  gerantPassword: string
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  GERANT: { label: 'Gérant', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  CHEF_PROJET: { label: 'Chef de Projet', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  SOUS_TRAITANT: { label: 'Sous-traitant', className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400' },
}

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
  CREATE: { label: 'Création', className: 'bg-emerald-100 text-emerald-700' },
  UPDATE: { label: 'Modification', className: 'bg-amber-100 text-amber-700' },
  DELETE: { label: 'Suppression', className: 'bg-red-100 text-red-700' },
  LOGIN: { label: 'Connexion', className: 'bg-sky-100 text-sky-700' },
  LOGOUT: { label: 'Déconnexion', className: 'bg-slate-100 text-slate-600' },
  BLOCK: { label: 'Blocage', className: 'bg-red-100 text-red-700' },
  UNBLOCK: { label: 'Déblocage', className: 'bg-emerald-100 text-emerald-700' },
  ROLE_CHANGE: { label: 'Changement rôle', className: 'bg-violet-100 text-violet-700' },
  PASSWORD_RESET: { label: 'Réinit. mdp', className: 'bg-amber-100 text-amber-700' },
  VALIDATE: { label: 'Validation', className: 'bg-emerald-100 text-emerald-700' },
}

const MODULE_LABELS: Record<string, string> = {
  auth: 'Authentification',
  users: 'Utilisateurs',
  chantiers: 'Chantiers',
  entreprises: 'Entreprises',
  personnel: 'Personnel',
  pointage: 'Pointage',
  stocks: 'Stocks',
  carburant: 'Carburant',
  engins: 'Engins',
  rapports: 'Rapports',
  budget: 'Budget',
  documents: 'Documents',
  permissions: 'Permissions',
}

const AUDIT_MODULE_FILTERS = [
  { value: '', label: 'Tous les modules' },
  { value: 'entreprises', label: 'Entreprises' },
  { value: 'users', label: 'Utilisateurs' },
  { value: 'auth', label: 'Authentification' },
  { value: 'chantiers', label: 'Chantiers' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'permissions', label: 'Permissions' },
]

const AUDIT_ACTION_FILTERS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'LOGIN', label: 'Connexion' },
  { value: 'BLOCK', label: 'Blocage' },
  { value: 'UNBLOCK', label: 'Déblocage' },
]

const EMPTY_ENTREPRISE_FORM: EntrepriseFormData = {
  nom: '',
  adresse: '',
  telephone: '',
  email: '',
  gerantName: '',
  gerantEmail: '',
  gerantPassword: '',
}

const ITEMS_PER_PAGE = 10

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getEntrepriseStatus(users: number): { label: string; className: string } {
  // Derive status based on active users vs total
  if (users === 0) return { label: 'Essai', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: 'Active', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
}

function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

function formatExactDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy à HH:mm', { locale: fr })
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
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

// ═══════════════════════════════════════════════════════════════
// TAB 1: VUE D'ENSEMBLE (Overview)
// ═══════════════════════════════════════════════════════════════

function OverviewTab({
  stats,
  loading,
  recentActivity,
  onCreateEntreprise,
  onSendAnnouncement,
}: {
  stats: PlatformStats | null
  loading: boolean
  recentActivity: AuditLogEntry[]
  onCreateEntreprise: () => void
  onSendAnnouncement: () => void
}) {
  const statCards = [
    {
      title: 'Total Entreprises',
      value: stats?.totalEntreprises ?? 0,
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: 'Total Utilisateurs',
      value: stats?.totalUtilisateurs ?? 0,
      icon: Users,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'Chantiers Actifs',
      value: stats?.chantiersActifs ?? 0,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      border: 'border-orange-200 dark:border-orange-500/20',
    },
    {
      title: 'Revenus Mensuels',
      value: stats ? `${formatFCFA(stats.revenusMensuels)} F` : '0 F',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            Vue d&apos;ensemble Plateforme
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Panneau de contrôle de la plateforme O.P.U.C.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSendAnnouncement} className="gap-2">
            <Megaphone className="w-4 h-4" />
            Annonce
          </Button>
          <Button onClick={onCreateEntreprise} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle Entreprise
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
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
                        <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground">{card.value}</p>
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

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-emerald-500" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nouvelle Entreprise', icon: Building2, onClick: onCreateEntreprise, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20' },
                { label: 'Envoyer Annonce', icon: Megaphone, onClick: onSendAnnouncement, color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20' },
              ].map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    className={cn('h-auto py-4 flex flex-col items-center gap-2 transition-colors', action.bg)}
                    onClick={action.onClick}
                  >
                    <Icon className={cn('w-5 h-5', action.color)} />
                    <span className="text-sm font-medium text-center leading-tight">{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-amber-500" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentActivity.length > 0 ? (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {recentActivity.slice(0, 8).map((log) => {
                    const actionBadge = ACTION_BADGES[log.action] || { label: log.action, className: 'bg-gray-100 text-gray-600' }
                    return (
                      <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-muted-foreground">
                            {getInitials(log.utilisateur.name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">{log.utilisateur.name}</span>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', actionBadge.className)}>
                              {actionBadge.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.details || `${log.module} — ${log.action}`}</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune activité récente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: ENTREPRISES (Tenant Management)
// ═══════════════════════════════════════════════════════════════

function EntreprisesTab({
  onCreateEntreprise,
}: {
  onCreateEntreprise: () => void
}) {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedEntreprise, setSelectedEntreprise] = useState<Entreprise | null>(null)

  // Suspend confirmation
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<Entreprise | null>(null)
  const [suspendAction, setSuspendAction] = useState<'suspend' | 'activate'>('suspend')
  const [suspending, setSuspending] = useState(false)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Entreprise | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchEntreprises = useCallback(async (page: number = 1, search?: string, statut?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(ITEMS_PER_PAGE))
      if (search) params.set('search', search)
      if (statut && statut !== 'TOUS') params.set('statut', statut)

      const res = await fetch(`/api/entreprises?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEntreprises(data.entreprises || [])
        setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 })
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntreprises(currentPage, searchQuery, statusFilter)
  }, [currentPage, fetchEntreprises, searchQuery, statusFilter])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchEntreprises(1, searchQuery, statusFilter)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statusFilter

  // Suspend/Activate
  const confirmSuspend = (entreprise: Entreprise) => {
    setSuspendTarget(entreprise)
    setSuspendAction('suspend')
    setSuspendDialogOpen(true)
  }

  const confirmActivate = (entreprise: Entreprise) => {
    setSuspendTarget(entreprise)
    setSuspendAction('activate')
    setSuspendDialogOpen(true)
  }

  const handleStatusChange = async () => {
    if (!suspendTarget) return
    setSuspending(true)
    try {
      const res = await fetch(`/api/entreprises/${suspendTarget.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: suspendAction }),
      })
      if (res.ok) {
        toast.success(suspendAction === 'suspend'
          ? `Entreprise "${suspendTarget.nom}" suspendue`
          : `Entreprise "${suspendTarget.nom}" activée`
        )
        setSuspendDialogOpen(false)
        fetchEntreprises(currentPage, searchQuery, statusFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSuspending(false)
    }
  }

  // Delete
  const confirmDelete = (entreprise: Entreprise) => {
    setDeleteTarget(entreprise)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/entreprises/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success(`Entreprise "${deleteTarget.nom}" supprimée`)
        setDeleteDialogOpen(false)
        fetchEntreprises(currentPage, searchQuery, statusFilter)
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Gestion des Entreprises
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} entreprise{pagination.total !== 1 ? 's' : ''} inscrite{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onCreateEntreprise} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle Entreprise
        </Button>
      </div>

      {/* Search & Filter */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher par nom, email, téléphone..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || 'TOUS'} onValueChange={(v) => { setStatusFilter(v === 'TOUS' ? '' : v) }}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOUS">Tous les statuts</SelectItem>
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

      {/* Entreprises Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : entreprises.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucune entreprise'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters ? 'Aucune entreprise ne correspond à vos filtres.' : 'Commencez par créer une entreprise.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Entreprise</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Chantiers</TableHead>
                    <TableHead className="hidden sm:table-cell">Créé le</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entreprises.map((entreprise, index) => {
                    const status = getEntrepriseStatus(entreprise._count.users)
                    return (
                      <motion.tr
                        key={entreprise.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{entreprise.nom}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">{entreprise.adresse || '—'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm space-y-0.5">
                            {entreprise.email && (
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {entreprise.email}
                              </p>
                            )}
                            {entreprise.telephone && (
                              <p className="text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {entreprise.telephone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {entreprise._count.users}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs">
                            {entreprise._count.chantiers}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entreprise.createdAt), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedEntreprise(entreprise); setDetailDialogOpen(true) }}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => confirmSuspend(entreprise)} className="text-red-600 focus:text-red-600">
                                <Lock className="w-4 h-4 mr-2" />
                                Suspendre
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => confirmActivate(entreprise)} className="text-emerald-600 focus:text-emerald-600">
                                <Unlock className="w-4 h-4 mr-2" />
                                Activer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => confirmDelete(entreprise)} className="text-red-600 focus:text-red-600">
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Détails de l&apos;entreprise
            </DialogTitle>
          </DialogHeader>
          {selectedEntreprise && (
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedEntreprise.nom}</h3>
                    <Badge variant="outline" className="text-xs mt-1">
                      {getEntrepriseStatus(selectedEntreprise._count.users).label}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  {selectedEntreprise.adresse && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {selectedEntreprise.adresse}
                    </div>
                  )}
                  {selectedEntreprise.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      {selectedEntreprise.email}
                    </div>
                  )}
                  {selectedEntreprise.telephone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {selectedEntreprise.telephone}
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-foreground">{selectedEntreprise._count.users}</p>
                    <p className="text-xs text-muted-foreground">Utilisateurs</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-foreground">{selectedEntreprise._count.chantiers}</p>
                    <p className="text-xs text-muted-foreground">Chantiers</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center pt-2">
                  Créée le {format(new Date(selectedEntreprise.createdAt), 'dd MMMM yyyy', { locale: fr })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend/Activate Dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {suspendAction === 'suspend' ? (
                <Lock className="w-5 h-5 text-red-500" />
              ) : (
                <Unlock className="w-5 h-5 text-emerald-500" />
              )}
              {suspendAction === 'suspend' ? 'Suspendre l\'entreprise' : 'Activer l\'entreprise'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendAction === 'suspend'
                ? `Voulez-vous vraiment suspendre l'entreprise "${suspendTarget?.nom}" ? Tous les utilisateurs de cette entreprise seront désactivés et ne pourront plus se connecter.`
                : `Voulez-vous vraiment réactiver l'entreprise "${suspendTarget?.nom}" ? Tous les utilisateurs de cette entreprise seront réactivés.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={suspending}
              className={cn(suspendAction === 'suspend'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              {suspending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {suspendAction === 'suspend' ? 'Suspendre' : 'Activer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer l&apos;entreprise
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;entreprise &quot;{deleteTarget?.nom}&quot; ? Cette action supprimera également toutes les données associées (utilisateurs, chantiers, etc.). Cette action est irréversible.
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

// ═══════════════════════════════════════════════════════════════
// TAB 3: UTILISATEURS GLOBAUX
// ═══════════════════════════════════════════════════════════════

function GlobalUsersTab() {
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [entrepriseFilter, setEntrepriseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Edit role dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<PlatformUser | null>(null)
  const [editRole, setEditRole] = useState('')
  const [savingRole, setSavingRole] = useState(false)

  // Toggle active
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false)
  const [toggleUser, setToggleUser] = useState<PlatformUser | null>(null)
  const [toggling, setToggling] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Get unique entreprises for filter
  const entreprises = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => {
      if (u.entreprise) {
        map.set(u.entreprise.id, u.entreprise.nom)
      }
    })
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }))
  }, [users])

  // Filter users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return users.filter((u) => {
      const matchSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.entreprise?.nom || '').toLowerCase().includes(q)
      const matchRole = !roleFilter || u.role === roleFilter
      const matchEntreprise = !entrepriseFilter || u.entrepriseId === entrepriseFilter
      const matchStatus = !statusFilter ||
        (statusFilter === 'active' ? u.active : !u.active)
      return matchSearch && matchRole && matchEntreprise && matchStatus
    })
  }, [users, searchQuery, roleFilter, entrepriseFilter, statusFilter])

  // Role stats
  const stats = useMemo(() => ({
    total: users.length,
    actifs: users.filter((u) => u.active).length,
    inactifs: users.filter((u) => !u.active).length,
  }), [users])

  // Edit role
  const openEditRole = (user: PlatformUser) => {
    setEditUser(user)
    setEditRole(user.role)
    setEditDialogOpen(true)
  }

  const handleSaveRole = async () => {
    if (!editUser) return
    setSavingRole(true)
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editUser.name, email: editUser.email, role: editRole, telephone: '' }),
      })
      if (res.ok) {
        toast.success(`Rôle de ${editUser.name} mis à jour`)
        setEditDialogOpen(false)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSavingRole(false)
    }
  }

  // Toggle active
  const confirmToggle = (user: PlatformUser) => {
    setToggleUser(user)
    setToggleDialogOpen(true)
  }

  const handleToggle = async () => {
    if (!toggleUser) return
    setToggling(true)
    try {
      const res = await fetch(`/api/users/${toggleUser.id}/toggle-active`, { method: 'PATCH' })
      if (res.ok) {
        toast.success(toggleUser.active ? `${toggleUser.name} désactivé` : `${toggleUser.name} activé`)
        setToggleDialogOpen(false)
        fetchUsers()
      } else {
        toast.error('Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setToggling(false)
    }
  }

  const hasFilters = searchQuery || roleFilter || entrepriseFilter || statusFilter

  const ROLE_OPTIONS = [
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'GERANT', label: 'Gérant' },
    { value: 'ADMIN_ENTREPRISE', label: 'Admin Entreprise' },
    { value: 'ADMIN', label: 'Administrateur' },
    { value: 'CHEF_ENTREPRISE', label: "Chef d'Entreprise" },
    { value: 'CONDUCTEUR', label: 'Conducteur' },
    { value: 'CHEF_CHANTIER', label: 'Chef Chantier' },
    { value: 'SOUS_TRAITANT', label: 'Sous-traitant' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600" />
          Utilisateurs Globaux
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tous les utilisateurs de la plateforme — {stats.total} au total
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Actifs</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.actifs}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Inactifs</p>
            <p className="text-2xl font-bold text-red-600">{stats.inactifs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email ou entreprise..."
                className="pl-9"
              />
            </div>
            <Select value={roleFilter || '__all__'} onValueChange={(v) => setRoleFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entrepriseFilter || '__all__'} onValueChange={(v) => setEntrepriseFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder="Entreprise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes</SelectItem>
                {entreprises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[120px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="outline" onClick={() => { setSearchQuery(''); setRoleFilter(''); setEntrepriseFilter(''); setStatusFilter('') }} className="gap-2 shrink-0">
                <FilterX className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredUsers.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucun utilisateur'}
            </h3>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Utilisateur</TableHead>
                      <TableHead className="hidden md:table-cell">Entreprise</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead className="hidden sm:table-cell">Statut</TableHead>
                      <TableHead className="hidden lg:table-cell">Dernière connexion</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const roleBadge = ROLE_CONFIG[user.role] || { label: user.role, className: 'bg-gray-100 text-gray-600 border-gray-200' }
                      return (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell className="pl-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              )}>
                                {getInitials(user.name)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {user.entreprise?.nom || (
                              <span className="text-xs text-muted-foreground/60 italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[11px]', roleBadge.className)}>
                              {roleBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className={cn(
                              'text-[11px]',
                              user.active
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            )}>
                              {user.active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {user.lastLoginAt
                                ? formatRelativeTime(user.lastLoginAt)
                                : 'Jamais connecté'
                              }
                            </span>
                          </TableCell>
                          <TableCell className="pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditRole(user)}>
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Modifier le rôle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => confirmToggle(user)}>
                                  {user.active ? (
                                    <><XCircle className="w-4 h-4 mr-2" />Désactiver</>
                                  ) : (
                                    <><CheckCircle2 className="w-4 h-4 mr-2" />Activer</>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            <div className="px-4 py-3 border-t bg-muted/20 text-sm text-muted-foreground">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} affiché{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              Changer le rôle de {editUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Rôle actuel</Label>
              <Badge variant="outline" className="w-fit">
                {ROLE_CONFIG[editUser?.role || '']?.label || editUser?.role}
              </Badge>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-role">Nouveau rôle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleSaveRole}
              disabled={savingRole || editRole === editUser?.role}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Dialog */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleUser?.active ? 'Désactiver l\'utilisateur' : 'Activer l\'utilisateur'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.active
                ? `Voulez-vous désactiver "${toggleUser?.name}" ? L'utilisateur ne pourra plus se connecter.`
                : `Voulez-vous réactiver "${toggleUser?.name}" ?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              disabled={toggling}
              className={toggleUser?.active
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: PARAMÈTRES PLATEFORME
// ═══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [saving, setSaving] = useState(false)

  // Security settings
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5')
  const [lockoutDuration, setLockoutDuration] = useState('30')
  const [passwordMinLength, setPasswordMinLength] = useState('8')
  const [passwordRequireUppercase, setPasswordRequireUppercase] = useState(true)
  const [passwordRequireNumbers, setPasswordRequireNumbers] = useState(true)
  const [passwordRequireSpecial, setPasswordRequireSpecial] = useState(false)

  // Announcement
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'urgent'>('info')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

  const handleSaveSecurity = async () => {
    setSaving(true)
    // Simulate save
    await new Promise((r) => setTimeout(r, 800))
    toast.success('Paramètres de sécurité enregistrés')
    setSaving(false)
  }

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.error('Le titre et le message sont requis')
      return
    }
    setSendingAnnouncement(true)
    await new Promise((r) => setTimeout(r, 800))
    toast.success('Annonce envoyée à tous les utilisateurs')
    setAnnouncementTitle('')
    setAnnouncementMessage('')
    setSendingAnnouncement(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          Paramètres Plateforme
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration globale de la plateforme
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Shield className="w-4.5 h-4.5 text-amber-500" />
              Sécurité
            </CardTitle>
            <CardDescription>
              Politique de connexion et mots de passe
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {/* Max login attempts */}
            <div className="grid gap-2">
              <Label htmlFor="max-login" className="text-sm font-medium">
                Tentatives de connexion max
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="max-login"
                  type="number"
                  min={1}
                  max={20}
                  value={maxLoginAttempts}
                  onChange={(e) => setMaxLoginAttempts(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">avant verrouillage</span>
              </div>
            </div>

            {/* Lockout duration */}
            <div className="grid gap-2">
              <Label htmlFor="lockout-duration" className="text-sm font-medium">
                Durée de verrouillage
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="lockout-duration"
                  type="number"
                  min={1}
                  max={1440}
                  value={lockoutDuration}
                  onChange={(e) => setLockoutDuration(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>

            <Separator />

            {/* Password policy */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Politique de mot de passe</p>

              <div className="grid gap-2">
                <Label htmlFor="pwd-min-length" className="text-sm">
                  Longueur minimale
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="pwd-min-length"
                    type="number"
                    min={6}
                    max={32}
                    value={passwordMinLength}
                    onChange={(e) => setPasswordMinLength(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">caractères</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pwd-upper" className="text-sm">Exiger des majuscules</Label>
                <Switch
                  id="pwd-upper"
                  checked={passwordRequireUppercase}
                  onCheckedChange={setPasswordRequireUppercase}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pwd-numbers" className="text-sm">Exiger des chiffres</Label>
                <Switch
                  id="pwd-numbers"
                  checked={passwordRequireNumbers}
                  onCheckedChange={setPasswordRequireNumbers}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pwd-special" className="text-sm">Exiger des caractères spéciaux</Label>
                <Switch
                  id="pwd-special"
                  checked={passwordRequireSpecial}
                  onCheckedChange={setPasswordRequireSpecial}
                />
              </div>
            </div>

            <Button
              onClick={handleSaveSecurity}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        {/* Announcement System */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Megaphone className="w-4.5 h-4.5 text-amber-500" />
              Annonce Plateforme
            </CardTitle>
            <CardDescription>
              Envoyer une annonce à tous les utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="ann-type" className="text-sm font-medium">Type d&apos;annonce</Label>
              <Select value={announcementType} onValueChange={(v: any) => setAnnouncementType(v)}>
                <SelectTrigger id="ann-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-sky-500" />
                      Information
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Avertissement
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      Urgent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ann-title" className="text-sm font-medium">Titre</Label>
              <Input
                id="ann-title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Titre de l'annonce"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ann-message" className="text-sm font-medium">Message</Label>
              <Textarea
                id="ann-message"
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Contenu de l'annonce..."
                rows={4}
              />
            </div>

            <div className={cn(
              'rounded-lg p-3 text-sm',
              announcementType === 'info' && 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200',
              announcementType === 'warning' && 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200',
              announcementType === 'urgent' && 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-400 border border-red-200',
            )}>
              <div className="flex items-center gap-2 mb-1">
                {announcementType === 'info' && <Info className="w-4 h-4" />}
                {announcementType === 'warning' && <AlertTriangle className="w-4 h-4" />}
                {announcementType === 'urgent' && <AlertTriangle className="w-4 h-4" />}
                <span className="font-semibold">
                  {announcementTitle || 'Titre de l\'annonce'}
                </span>
              </div>
              <p className="text-sm opacity-80">
                {announcementMessage || 'Aperçu du message...'}
              </p>
            </div>

            <Button
              onClick={handleSendAnnouncement}
              disabled={sendingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()}
              className="w-full gap-2"
              variant={announcementType === 'urgent' ? 'destructive' : 'default'}
            >
              {sendingAnnouncement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              Envoyer à tous les utilisateurs
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: JOURNAL D'AUDIT PLATEFORME
// ═══════════════════════════════════════════════════════════════

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const fetchLogs = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (moduleFilter) params.set('module', moduleFilter)
      if (actionFilter) params.set('action', actionFilter)
      if (searchFilter) params.set('search', searchFilter)

      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 })
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, actionFilter, searchFilter])

  useEffect(() => {
    fetchLogs(currentPage)
  }, [currentPage, fetchLogs])

  const hasFilters = moduleFilter || actionFilter || searchFilter

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-amber-600" />
            Journal d&apos;Audit Plateforme
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} entrée{pagination.total !== 1 ? 's' : ''} dans le journal
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => fetchLogs(currentPage)}
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1) } }}
                placeholder="Rechercher dans les détails..."
                className="pl-9"
              />
            </div>
            <Select value={moduleFilter || '__all__'} onValueChange={(v) => { setModuleFilter(v === '__all__' ? '' : v); setCurrentPage(1) }}>
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_MODULE_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter || '__all__'} onValueChange={(v) => { setActionFilter(v === '__all__' ? '' : v); setCurrentPage(1) }}>
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_ACTION_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="outline" onClick={() => { setModuleFilter(''); setActionFilter(''); setSearchFilter(''); setCurrentPage(1) }} className="gap-2 shrink-0">
                <FilterX className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : logs.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <ScrollText className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucune entrée'}
            </h3>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 w-[120px]">Date</TableHead>
                      <TableHead className="w-[140px]">Utilisateur</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead className="hidden sm:table-cell w-[100px]">Module</TableHead>
                      <TableHead className="hidden md:table-cell">Détails</TableHead>
                      <TableHead className="hidden lg:table-cell w-[100px]">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const actionBadge = ACTION_BADGES[log.action] || { label: log.action, className: 'bg-gray-100 text-gray-600' }
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/50">
                          <TableCell className="pl-4 py-2.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatRelativeTime(log.createdAt)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {formatExactDate(log.createdAt)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {getInitials(log.utilisateur.name)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
                                  {log.utilisateur.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                  {log.utilisateur.role || ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', actionBadge.className)}>
                              {actionBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground py-2.5">
                            {MODULE_LABELS[log.module] || log.module}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground py-2.5 max-w-[200px] truncate">
                            {log.details || '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono py-2.5">
                            {log.adresseIp || '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            {/* Pagination */}
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
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let page = i + 1
                    if (pagination.totalPages > 5) {
                      if (currentPage <= 3) page = i + 1
                      else if (currentPage >= pagination.totalPages - 2) page = pagination.totalPages - 4 + i
                      else page = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className={cn('h-8 w-8 p-0', page === currentPage && 'bg-emerald-600 hover:bg-emerald-700')}
                        onClick={() => setCurrentPage(page)}
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
                    onClick={() => setCurrentPage(currentPage + 1)}
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
  )
}

// ═══════════════════════════════════════════════════════════════
// CREATE ENTREPRISE DIALOG
// ═══════════════════════════════════════════════════════════════

function CreateEntrepriseDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<EntrepriseFormData>(EMPTY_ENTREPRISE_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const resetForm = () => {
    setForm(EMPTY_ENTREPRISE_FORM)
    setShowPassword(false)
  }

  const handleSubmit = async () => {
    if (!form.nom.trim()) {
      toast.error('Le nom de l\'entreprise est requis')
      return
    }

    setSubmitting(true)
    try {
      const body: any = {
        nom: form.nom.trim(),
        adresse: form.adresse.trim() || null,
        telephone: form.telephone.trim() || null,
        email: form.email.trim() || null,
      }

      // Only include gerant fields if name is provided
      if (form.gerantName.trim()) {
        if (!form.gerantEmail.trim() || !form.gerantPassword.trim()) {
          toast.error('Email et mot de passe du gérant requis si un gérant est spécifié')
          setSubmitting(false)
          return
        }
        body.gerantName = form.gerantName.trim()
        body.gerantEmail = form.gerantEmail.trim()
        body.gerantPassword = form.gerantPassword
      }

      const res = await fetch('/api/entreprises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(`Entreprise "${form.nom}" créée avec succès`)
        resetForm()
        onOpenChange(false)
        onSuccess()
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

  const handleGeneratePassword = () => {
    setForm((prev) => ({ ...prev, gerantPassword: generatePassword() }))
    setShowPassword(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Nouvelle Entreprise
          </DialogTitle>
          <DialogDescription>
            Créer une nouvelle entreprise sur la plateforme
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Entreprise Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-foreground">Informations de l&apos;entreprise</h3>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ent-nom">Nom de l&apos;entreprise *</Label>
                <Input
                  id="ent-nom"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  placeholder="Ex: Bâtiment Plus SARL"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ent-email">Email</Label>
                  <Input
                    id="ent-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@entreprise.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ent-tel">Téléphone</Label>
                  <Input
                    id="ent-tel"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="+225 00 00 00 00"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ent-addr">Adresse</Label>
                <Input
                  id="ent-addr"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Gerant Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-foreground">Gérant (optionnel)</h3>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ger-name">Nom du gérant</Label>
                <Input
                  id="ger-name"
                  value={form.gerantName}
                  onChange={(e) => setForm({ ...form, gerantName: e.target.value })}
                  placeholder="Nom complet du gérant"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ger-email">Email du gérant</Label>
                  <Input
                    id="ger-email"
                    type="email"
                    value={form.gerantEmail}
                    onChange={(e) => setForm({ ...form, gerantEmail: e.target.value })}
                    placeholder="gerant@entreprise.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ger-pwd">Mot de passe</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="ger-pwd"
                        type={showPassword ? 'text' : 'password'}
                        value={form.gerantPassword}
                        onChange={(e) => setForm({ ...form, gerantPassword: e.target.value })}
                        placeholder="Mot de passe"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={handleGeneratePassword}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Générer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.nom.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer l&apos;entreprise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// ANNOUNCEMENT DIALOG
// ═══════════════════════════════════════════════════════════════

function AnnouncementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'info' | 'warning' | 'urgent'>('info')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Le titre et le message sont requis')
      return
    }
    setSending(true)
    await new Promise((r) => setTimeout(r, 800))
    toast.success('Annonce envoyée à tous les utilisateurs')
    setTitle('')
    setMessage('')
    setType('info')
    onOpenChange(false)
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            Envoyer une annonce
          </DialogTitle>
          <DialogDescription>
            Cette annonce sera visible par tous les utilisateurs de la plateforme
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Information</SelectItem>
                <SelectItem value="warning">Avertissement</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de l'annonce" />
          </div>
          <div className="grid gap-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Contenu..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className={cn('gap-2', type === 'urgent' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700', 'text-white')}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN: ADMIN PLATEFORME VIEW
// ═══════════════════════════════════════════════════════════════

export function AdminPlateformeView() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('overview')

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false)

  // Platform stats
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Recent activity for overview
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([])

  // Fetch stats & recent activity
  const fetchOverviewData = useCallback(async () => {
    setStatsLoading(true)
    try {
      // Fetch entreprises for stats
      const entRes = await fetch('/api/entreprises?limit=1')
      const usersRes = await fetch('/api/users')
      const auditRes = await fetch('/api/audit-logs?limit=10')

      const [entData, usersData, auditData] = await Promise.all([
        entRes.ok ? entRes.json() : null,
        usersRes.ok ? usersRes.json() : null,
        auditRes.ok ? auditRes.json() : null,
      ])

      // Calculate stats from data
      const totalEntreprises = entData?.pagination?.total || 0
      const totalUtilisateurs = (usersData?.users || []).length

      // Count active chantiers
      let chantiersActifs = 0
      try {
        const chantRes = await fetch('/api/chantiers')
        if (chantRes.ok) {
          const chantData = await chantRes.json()
          chantiersActifs = chantData.kpi?.actifs || 0
        }
      } catch {}

      setStats({
        totalEntreprises,
        totalUtilisateurs,
        chantiersActifs,
        revenusMensuels: 0,
      })

      setRecentActivity(auditData?.logs || [])
    } catch {
      // Silent fail for overview stats
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverviewData()
  }, [fetchOverviewData])

  const handleCreateSuccess = () => {
    fetchOverviewData()
  }

  const TABS = [
    { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
    { id: 'entreprises', label: 'Entreprises', icon: Building2 },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings },
    { id: 'audit', label: "Journal d'audit", icon: ScrollText },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
              SUPER_ADMIN
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-2 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Admin Plateforme
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion globale de la plateforme O.P.U.C.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full flex bg-muted/50 p-1 h-auto rounded-xl">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 data-[state=active]:dark:text-emerald-400 transition-all"
              >
                <Icon className="w-4 h-4 hidden sm:block" />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <TabsContent value="overview" forceMount>
              <OverviewTab
                stats={stats}
                loading={statsLoading}
                recentActivity={recentActivity}
                onCreateEntreprise={() => setCreateDialogOpen(true)}
                onSendAnnouncement={() => setAnnouncementDialogOpen(true)}
              />
            </TabsContent>
          )}

          {activeTab === 'entreprises' && (
            <TabsContent value="entreprises" forceMount>
              <EntreprisesTab onCreateEntreprise={() => setCreateDialogOpen(true)} />
            </TabsContent>
          )}

          {activeTab === 'users' && (
            <TabsContent value="users" forceMount>
              <GlobalUsersTab />
            </TabsContent>
          )}

          {activeTab === 'settings' && (
            <TabsContent value="settings" forceMount>
              <SettingsTab />
            </TabsContent>
          )}

          {activeTab === 'audit' && (
            <TabsContent value="audit" forceMount>
              <AuditLogTab />
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Dialogs */}
      <CreateEntrepriseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
      <AnnouncementDialog
        open={announcementDialogOpen}
        onOpenChange={setAnnouncementDialogOpen}
      />
    </div>
  )
}
