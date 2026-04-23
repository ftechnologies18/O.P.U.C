'use client'

import { Fragment, useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Headphones,
  Plus,
  Eye,
  MoreHorizontal,
  Search,
  FilterX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  ArrowLeft,
  MessageSquare,
  Paperclip,
  User,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CircleDot,
  CircleCheck,
  CircleOff,
  Ticket,
  Archive,
  Tag,
  UserCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Ticket {
  id: string
  titre: string
  description: string
  categorie: string
  priorite: string
  statut: string
  clientId: string | null
  client: { id: string; raisonSociale: string } | null
  creeParId: string
  creePar: { id: string; name: string; email: string } | null
  assigneAId: string | null
  assigneA: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  _count: {
    messages: number
  }
}

interface TicketMessage {
  id: string
  contenu: string
  pieceJointe: string | null
  expediteurId: string
  expediteur: { id: string; name: string; email: string }
  ticketId: string
  createdAt: string
}

interface TicketStats {
  ouverts: number
  enCours: number
  resolus: number
  fermes: number
  total: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ClientOption {
  id: string
  raisonSociale: string
}

interface UserOption {
  id: string
  name: string
  email: string
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PRIORITE_CONFIG: Record<string, { label: string; className: string; icon: typeof CircleDot }> = {
  BASSE: {
    label: 'Basse',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
    icon: CircleDot,
  },
  MOYENNE: {
    label: 'Moyenne',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    icon: CircleDot,
  },
  HAUTE: {
    label: 'Haute',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    icon: AlertCircle,
  },
  URGENTE: {
    label: 'Urgente',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    icon: AlertCircle,
  },
}

const STATUT_CONFIG: Record<string, { label: string; className: string; icon: typeof CircleDot }> = {
  OUVERT: {
    label: 'Ouvert',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    icon: CircleDot,
  },
  EN_COURS: {
    label: 'En Cours',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    icon: Clock,
  },
  RESOLU: {
    label: 'Résolu',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    icon: CircleCheck,
  },
  FERME: {
    label: 'Fermé',
    className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
    icon: CircleOff,
  },
}

const CATEGORIE_LABELS: Record<string, string> = {
  TECHNIQUE: 'Technique',
  FACTURATION: 'Facturation',
  PLANNING: 'Planning',
  AUTRE: 'Autre',
}

const ITEMS_PER_PAGE = 10

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

function formatExactDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy à HH:mm', { locale: fr })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
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
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-14" />
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
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={cn('flex gap-3', i % 2 === 0 ? '' : 'flex-row-reverse')}>
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className={cn('space-y-2 max-w-[70%]', i % 2 === 0 ? '' : 'text-right')}>
            <Skeleton className="h-3 w-24 mx-auto" />
            <Skeleton className="h-16 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CREATE TICKET DIALOG
// ═══════════════════════════════════════════════════════════════

function CreateTicketDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  users,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    titre: string
    description: string
    clientId?: string
    categorie: string
    priorite: string
    assigneAId?: string
  }) => Promise<void>
  clients: ClientOption[]
  users: UserOption[]
}) {
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [categorie, setCategorie] = useState('TECHNIQUE')
  const [priorite, setPriorite] = useState('MOYENNE')
  const [assigneAId, setAssigneAId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setTitre('')
    setDescription('')
    setClientId('')
    setCategorie('TECHNIQUE')
    setPriorite('MOYENNE')
    setAssigneAId('')
  }

  const handleSubmit = async () => {
    if (!titre.trim()) {
      toast.error('Le titre est obligatoire')
      return
    }
    if (!description.trim()) {
      toast.error('La description est obligatoire')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        titre: titre.trim(),
        description: description.trim(),
        clientId: clientId || undefined,
        categorie,
        priorite,
        assigneAId: assigneAId || undefined,
      })
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Erreur lors de la création du ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Nouveau Ticket
          </DialogTitle>
          <DialogDescription>Créer un nouveau ticket de support.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ticket-titre">
              Titre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ticket-titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Objet du ticket..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez votre problème en détail..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TECHNIQUE">Technique</SelectItem>
                  <SelectItem value="FACTURATION">Facturation</SelectItem>
                  <SelectItem value="PLANNING">Planning</SelectItem>
                  <SelectItem value="AUTRE">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priorite} onValueChange={setPriorite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASSE">Basse</SelectItem>
                  <SelectItem value="MOYENNE">Moyenne</SelectItem>
                  <SelectItem value="HAUTE">Haute</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— Aucun —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigné à</Label>
              <Select value={assigneAId} onValueChange={setAssigneAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— Non assigné —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !titre.trim() || !description.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer le ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// TICKET DETAIL DIALOG (quick view from list)
// ═══════════════════════════════════════════════════════════════

function TicketDetailDialog({
  open,
  onOpenChange,
  ticket,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: Ticket | null
}) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (open && ticket) {
      fetchMessages(ticket.id)
    }
  }, [open, ticket])

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoadingMessages(false)
    }
  }

  if (!ticket) return null

  const statutConfig = STATUT_CONFIG[ticket.statut] || STATUT_CONFIG.OUVERT
  const prioriteConfig = PRIORITE_CONFIG[ticket.priorite] || PRIORITE_CONFIG.MOYENNE
  const StatutIcon = statutConfig.icon
  const PrioriteIcon = prioriteConfig.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Ticket className="w-5 h-5 text-emerald-600" />
            {ticket.titre}
          </DialogTitle>
          <DialogDescription className="sr-only">Détails du ticket</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {/* Ticket metadata */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="outline" className={cn('text-xs gap-1', statutConfig.className)}>
              <StatutIcon className="w-3 h-3" />
              {statutConfig.label}
            </Badge>
            <Badge variant="outline" className={cn('text-xs gap-1', prioriteConfig.className)}>
              <PrioriteIcon className="w-3 h-3" />
              {prioriteConfig.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {CATEGORIE_LABELS[ticket.categorie] || ticket.categorie}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatExactDate(ticket.createdAt)}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {ticket.client && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {ticket.client.raisonSociale}
              </div>
            )}
            {ticket.assigneA && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="w-4 h-4" />
                {ticket.assigneA.name}
              </div>
            )}
            {ticket.creePar && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                {ticket.creePar.name}
              </div>
            )}
          </div>

          <Separator className="my-3" />

          {/* Description */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <Separator className="my-3" />

          {/* Messages */}
          <div className="space-y-1 mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Messages ({messages.length})
            </h4>
          </div>

          {loadingMessages ? (
            <MessagesSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Aucun message pour le moment</p>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-3 pr-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {msg.expediteur.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-0.5">{msg.contenu}</p>
                    {msg.pieceJointe && (
                      <a
                        href={msg.pieceJointe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline ml-1"
                      >
                        <Paperclip className="w-3 h-3" />
                        Pièce jointe
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: TICKETS LIST
// ═══════════════════════════════════════════════════════════════

function TicketsTab({
  stats,
  loadingStats,
  clients,
  users,
  onViewTicket,
  onCreateTicket,
}: {
  stats: TicketStats | null
  loadingStats: boolean
  clients: ClientOption[]
  users: UserOption[]
  onViewTicket: (ticket: Ticket) => void
  onCreateTicket: () => void
}) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [prioriteFilter, setPrioriteFilter] = useState('')
  const [categorieFilter, setCategorieFilter] = useState('')
  const [clientIdFilter, setClientIdFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTickets = useCallback(
    async (page: number = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(ITEMS_PER_PAGE))
        if (searchQuery) params.set('search', searchQuery)
        if (statutFilter) params.set('statut', statutFilter)
        if (prioriteFilter) params.set('priorite', prioriteFilter)
        if (categorieFilter) params.set('categorie', categorieFilter)
        if (clientIdFilter) params.set('clientId', clientIdFilter)

        const res = await fetch(`/api/support?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setTickets(data.tickets || [])
          setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 })
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    },
    [searchQuery, statutFilter, prioriteFilter, categorieFilter, clientIdFilter]
  )

  useEffect(() => {
    fetchTickets(currentPage)
  }, [currentPage, fetchTickets])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchTickets(1)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatutFilter('')
    setPrioriteFilter('')
    setCategorieFilter('')
    setClientIdFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statutFilter || prioriteFilter || categorieFilter || clientIdFilter

  // Delete
  const confirmDelete = (ticket: Ticket) => {
    setDeleteTarget(ticket)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/support/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Ticket "${deleteTarget.titre}" supprimé`)
        setDeleteDialogOpen(false)
        fetchTickets(currentPage)
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

  const statCards = [
    {
      title: 'Ouverts',
      value: stats?.ouverts ?? 0,
      icon: CircleDot,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      border: 'border-blue-200 dark:border-blue-500/20',
    },
    {
      title: 'En Cours',
      value: stats?.enCours ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'Résolus',
      value: stats?.resolus ?? 0,
      icon: CircleCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: 'Fermés',
      value: stats?.fermes ?? 0,
      icon: CircleOff,
      color: 'text-slate-500',
      bg: 'bg-slate-50 dark:bg-slate-500/10',
      border: 'border-slate-200 dark:border-slate-500/20',
    },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Headphones className="w-5 h-5 text-emerald-600" />
            Centre de Support
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} ticket{pagination.total !== 1 ? 's' : ''} au total
          </p>
        </div>
        <Button onClick={onCreateTicket} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Ticket
        </Button>
      </div>

      {/* Stats Mini-cards */}
      {loadingStats ? (
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
                        <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground">
                          {card.value}
                        </p>
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Rechercher par titre..."
                  className="pl-9"
                />
              </div>
              {hasFilters && (
                <Button variant="outline" onClick={handleResetFilters} className="gap-2 shrink-0">
                  <FilterX className="w-4 h-4" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Select value={statutFilter || 'TOUS'} onValueChange={(v) => setStatutFilter(v === 'TOUS' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Tous les statuts</SelectItem>
                  <SelectItem value="OUVERT">Ouvert</SelectItem>
                  <SelectItem value="EN_COURS">En Cours</SelectItem>
                  <SelectItem value="RESOLU">Résolu</SelectItem>
                  <SelectItem value="FERME">Fermé</SelectItem>
                </SelectContent>
              </Select>

              <Select value={prioriteFilter || 'TOUS'} onValueChange={(v) => setPrioriteFilter(v === 'TOUS' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Toutes les priorités</SelectItem>
                  <SelectItem value="BASSE">Basse</SelectItem>
                  <SelectItem value="MOYENNE">Moyenne</SelectItem>
                  <SelectItem value="HAUTE">Haute</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categorieFilter || 'TOUS'} onValueChange={(v) => setCategorieFilter(v === 'TOUS' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOUS">Toutes catégories</SelectItem>
                  <SelectItem value="TECHNIQUE">Technique</SelectItem>
                  <SelectItem value="FACTURATION">Facturation</SelectItem>
                  <SelectItem value="PLANNING">Planning</SelectItem>
                  <SelectItem value="AUTRE">Autre</SelectItem>
                </SelectContent>
              </Select>

              <Select value={clientIdFilter || 'TOUS'} onValueChange={(v) => setClientIdFilter(v === 'TOUS' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : tickets.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
              <Headphones className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucun ticket'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Aucun ticket ne correspond à vos filtres.'
                : 'Commencez par créer un nouveau ticket.'}
            </p>
            {!hasFilters && (
              <Button
                onClick={onCreateTicket}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouveau Ticket
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
                    <TableHead className="pl-4">Ticket</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                    <TableHead className="hidden lg:table-cell">Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Assigné</TableHead>
                    <TableHead className="hidden sm:table-cell">Messages</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket, index) => {
                    const statutCfg = STATUT_CONFIG[ticket.statut] || STATUT_CONFIG.OUVERT
                    const prioriteCfg = PRIORITE_CONFIG[ticket.priorite] || PRIORITE_CONFIG.MOYENNE
                    return (
                      <motion.tr
                        key={ticket.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <Ticket className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm line-clamp-1">
                                {ticket.titre}
                              </p>
                              <p className="text-xs text-muted-foreground hidden sm:block">
                                #{ticket.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {ticket.client?.raisonSociale || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {CATEGORIE_LABELS[ticket.categorie] || ticket.categorie}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className={cn('text-xs', prioriteCfg.className)}>
                            {prioriteCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs gap-1', statutCfg.className)}>
                            {statutCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {ticket.assigneA?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {ticket._count.messages}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(ticket.createdAt)}
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
                              <DropdownMenuItem
                                onClick={() => onViewTicket(ticket)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Voir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTicket(ticket)
                                  setDetailDialogOpen(true)
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Aperçu rapide
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => confirmDelete(ticket)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
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

      {/* Detail Dialog */}
      <TicketDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        ticket={selectedTicket}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Supprimer le ticket
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le ticket &quot;{deleteTarget?.titre}&quot; ? Cette
              action supprimera également tous les messages associés.
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
// TAB 2: CONVERSATION (Ticket Detail + Messages)
// ═══════════════════════════════════════════════════════════════

function ConversationTab({
  ticketId,
  onBack,
}: {
  ticketId: string
  onBack: () => void
}) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch ticket details
  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket || data)
      }
    } catch {
      toast.error('Erreur lors du chargement du ticket')
    }
  }, [ticketId])

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // silently fail
    }
  }, [ticketId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchTicket(), fetchMessages()])
      setLoading(false)
    }
    load()
  }, [fetchTicket, fetchMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Refresh ticket when status changes
  const refreshAfterStatus = async () => {
    await fetchTicket()
    await fetchMessages()
  }

  const handleStatusChange = async (newStatut: string) => {
    if (!ticket) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/support/${ticketId}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (res.ok) {
        toast.success(
          newStatut === 'EN_COURS'
            ? 'Ticket pris en charge'
            : newStatut === 'RESOLU'
              ? 'Ticket résolu'
              : 'Ticket fermé'
        )
        await refreshAfterStatus()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu: newMessage.trim() }),
      })
      if (res.ok) {
        setNewMessage('')
        await fetchMessages()
        // Also refresh ticket to update _count
        await fetchTicket()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l&apos;envoi')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Card className="border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
            <Separator />
            <MessagesSkeleton />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Ticket introuvable</p>
        <Button variant="outline" onClick={onBack} className="mt-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Button>
      </div>
    )
  }

  const statutCfg = STATUT_CONFIG[ticket.statut] || STATUT_CONFIG.OUVERT
  const prioriteCfg = PRIORITE_CONFIG[ticket.priorite] || PRIORITE_CONFIG.MOYENNE
  const StatutIcon = statutCfg.icon
  const PrioriteIcon = prioriteCfg.icon

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />
        Retour aux tickets
      </Button>

      {/* Ticket Header Card */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Left: ticket info */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-emerald-600" />
                  {ticket.titre}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('text-xs gap-1', statutCfg.className)}>
                  <StatutIcon className="w-3 h-3" />
                  {statutCfg.label}
                </Badge>
                <Badge variant="outline" className={cn('text-xs gap-1', prioriteCfg.className)}>
                  <PrioriteIcon className="w-3 h-3" />
                  {prioriteCfg.label}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <Tag className="w-3 h-3" />
                  {CATEGORIE_LABELS[ticket.categorie] || ticket.categorie}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Créé {formatExactDate(ticket.createdAt)}
                </span>
              </div>

              {/* Client & Assigné */}
              <div className="flex flex-wrap gap-4 text-sm">
                {ticket.client && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>
                      <span className="text-xs text-muted-foreground/70">Client: </span>
                      {ticket.client.raisonSociale}
                    </span>
                  </div>
                )}
                {ticket.assigneA && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserCircle className="w-4 h-4" />
                    <span>
                      <span className="text-xs text-muted-foreground/70">Assigné: </span>
                      {ticket.assigneA.name}
                    </span>
                  </div>
                )}
                {ticket.creePar && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>
                      <span className="text-xs text-muted-foreground/70">Créé par: </span>
                      {ticket.creePar.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {ticket.statut === 'OUVERT' && (
                <Button
                  onClick={() => handleStatusChange('EN_COURS')}
                  disabled={updatingStatus}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  {updatingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  Prendre en charge
                </Button>
              )}
              {(ticket.statut === 'OUVERT' || ticket.statut === 'EN_COURS') && (
                <Button
                  onClick={() => handleStatusChange('RESOLU')}
                  disabled={updatingStatus}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {updatingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Résoudre
                </Button>
              )}
              {(ticket.statut === 'OUVERT' || ticket.statut === 'EN_COURS' || ticket.statut === 'RESOLU') && (
                <Button
                  onClick={() => handleStatusChange('FERME')}
                  disabled={updatingStatus}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {updatingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                  Fermer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 lg:p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      {/* Messages Thread */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-5 pt-5">
          <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
            <MessageSquare className="w-4.5 h-4.5 text-emerald-500" />
            Conversation
            <Badge variant="secondary" className="text-xs ml-1">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ScrollArea className="max-h-[400px] lg:max-h-[500px]">
            <div className="p-4 lg:p-5 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">Aucun message pour le moment</p>
                  <p className="text-xs mt-1">Envoyez le premier message ci-dessous</p>
                </div>
              ) : (
                <AnimatePresence>
                  {messages.map((msg, index) => {
                    const isMine = msg.expediteurId === currentUserId
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className={cn('flex gap-3', isMine ? 'flex-row-reverse' : 'flex-row')}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                            isMine
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {getInitials(msg.expediteur.name)}
                        </div>

                        {/* Message bubble */}
                        <div
                          className={cn(
                            'max-w-[75%] sm:max-w-[65%]',
                            isMine ? 'text-right' : 'text-left'
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center gap-2 mb-1',
                              isMine ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <span className="text-xs font-medium text-foreground">
                              {msg.expediteur.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(msg.createdAt)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'rounded-lg px-3 py-2 text-sm',
                              isMine
                                ? 'bg-emerald-600 text-white rounded-tr-none'
                                : 'bg-muted text-foreground rounded-tl-none'
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.contenu}</p>
                          </div>
                          {msg.pieceJointe && (
                            <a
                              href={msg.pieceJointe}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'inline-flex items-center gap-1 text-xs mt-1 hover:underline',
                                isMine
                                  ? 'text-emerald-300'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              )}
                            >
                              <Paperclip className="w-3 h-3" />
                              Pièce jointe
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          {ticket.statut !== 'FERME' && (
            <div className="p-4 lg:p-5 border-t bg-muted/30">
              <div className="flex gap-3">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrire un message..."
                  rows={2}
                  className="min-h-[44px] max-h-32 resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 self-end h-10 px-4"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Envoyer</span>
                </Button>
              </div>
            </div>
          )}

          {ticket.statut === 'FERME' && (
            <div className="p-4 lg:p-5 border-t bg-muted/20 text-center">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CircleOff className="w-4 h-4" />
                Ce ticket est fermé. Vous ne pouvez plus envoyer de messages.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT: SupportView
// ═══════════════════════════════════════════════════════════════

export function SupportView() {
  const [activeTab, setActiveTab] = useState('tickets')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Stats
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Clients & Users for forms
  const [clients, setClients] = useState<ClientOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/support/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      if (res.ok) {
        const data = await res.json()
        setClients(Array.isArray(data) ? data : data.clients || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/entreprise/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : data.users || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchClients()
    fetchUsers()
  }, [fetchStats, fetchClients, fetchUsers])

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id)
    setActiveTab('conversation')
  }

  const handleBackToList = () => {
    setSelectedTicketId(null)
    setActiveTab('tickets')
    // Refresh stats after returning
    fetchStats()
  }

  const handleCreateTicket = async (data: {
    titre: string
    description: string
    clientId?: string
    categorie: string
    priorite: string
    assigneAId?: string
  }) => {
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erreur lors de la création')
    }
    toast.success('Ticket créé avec succès')
    fetchStats()
  }

  return (
    <Fragment>
      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTicket}
        clients={clients}
        users={users}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="w-4 h-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="conversation" className="gap-2" disabled={!selectedTicketId}>
            <MessageSquare className="w-4 h-4" />
            Conversation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <TicketsTab
            stats={stats}
            loadingStats={loadingStats}
            clients={clients}
            users={users}
            onViewTicket={handleViewTicket}
            onCreateTicket={() => setCreateDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="conversation">
          {selectedTicketId && (
            <ConversationTab ticketId={selectedTicketId} onBack={handleBackToList} />
          )}
        </TabsContent>
      </Tabs>
    </Fragment>
  )
}
