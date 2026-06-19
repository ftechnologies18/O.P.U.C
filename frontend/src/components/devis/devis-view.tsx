'use client'

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
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
  Printer,
  Send,
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  Phone,
  Mail,
  MapPin,
  Percent,
  RotateCcw,
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

interface Client {
  id: string
  raisonSociale: string
  telephone?: string | null
  email?: string | null
  adresse?: string | null
}

interface LigneDevis {
  id?: string
  designation: string
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
  totalHT: number
}

interface Devis {
  id: string
  numero: string
  clientId: string
  client: Client
  dateEmission: string
  dateValidite: string
  remiseGlobale: number
  tauxTVA: number
  conditions: string | null
  notes: string | null
  statut: string
  totalHT: number
  remise: number
  sousTotal: number
  montantTVA: number
  totalTTC: number
  createdAt: string
  updatedAt: string
  _count: {
    lignes: number
  }
  lignes?: LigneDevis[]
}

interface DevisFormData {
  clientId: string
  dateValidite: string
  remiseGlobale: number
  tauxTVA: number
  conditions: string
  notes: string
  lignes: LigneDevisForm[]
}

interface LigneDevisForm {
  id: string
  designation: string
  description: string
  quantite: number
  unite: string
  prixUnitaire: number
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  BROUILLON: { label: 'Brouillon', className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/30 dark:text-stone-400' },
  ENVOYE: { label: 'Envoyé', className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400' },
  ACCEPTE: { label: 'Accepté', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  REFUSE: { label: 'Refusé', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  EXPIRE: { label: 'Expiré', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
}

const STATUT_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ENVOYE', label: 'Envoyé' },
  { value: 'ACCEPTE', label: 'Accepté' },
  { value: 'REFUSE', label: 'Refusé' },
  { value: 'EXPIRE', label: 'Expiré' },
]

const ITEMS_PER_PAGE = 10

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const EMPTY_LIGNE = (): LigneDevisForm => ({
  id: generateTempId(),
  designation: '',
  description: '',
  quantite: 1,
  unite: 'u',
  prixUnitaire: 0,
})

const EMPTY_FORM = (): DevisFormData => ({
  clientId: '',
  dateValidite: '',
  remiseGlobale: 0,
  tauxTVA: 18,
  conditions: '',
  notes: '',
  lignes: [EMPTY_LIGNE()],
})

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatFCFA(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
}

function formatFCFACurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' F'
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
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
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

export function DevisView() {
  // ── List State ──
  const [devisList, setDevisList] = useState<Devis[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)

  // ── Detail Dialog ──
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Create / Edit Dialog ──
  const [formOpen, setFormOpen] = useState(false)
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null)
  const [form, setForm] = useState<DevisFormData>(EMPTY_FORM())
  const [formSaving, setFormSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)

  // ── Delete Confirmation ──
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Devis | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Status Change Confirmation ──
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Devis | null>(null)
  const [statusAction, setStatusAction] = useState<string>('')
  const [statusChanging, setStatusChanging] = useState(false)

  // ═══════════════════════════════════════════════════════════════
  // FETCH LIST
  // ═══════════════════════════════════════════════════════════════

  const fetchDevis = useCallback(async (page: number = 1, search?: string, statut?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(ITEMS_PER_PAGE))
      if (search) params.set('search', search)
      if (statut && statut !== 'TOUS') params.set('statut', statut)

      const res = await fetch(`/api/v1/devis?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDevisList(data.devis || [])
        setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 })
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevis(currentPage, searchQuery, statutFilter)
  }, [currentPage, fetchDevis, searchQuery, statutFilter])

  // ═══════════════════════════════════════════════════════════════
  // FETCH CLIENTS (for select)
  // ═══════════════════════════════════════════════════════════════

  const fetchClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const res = await fetch('/api/v1/clients?limit=200')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des clients')
    } finally {
      setClientsLoading(false)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // CALCULATE TOTALS
  // ═══════════════════════════════════════════════════════════════

  const totals = useMemo(() => {
    const totalHT = form.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0)
    const remise = totalHT * (form.remiseGlobale / 100)
    const sousTotal = totalHT - remise
    const montantTVA = sousTotal * (form.tauxTVA / 100)
    const totalTTC = sousTotal + montantTVA
    return { totalHT, remise, sousTotal, montantTVA, totalTTC }
  }, [form.lignes, form.remiseGlobale, form.tauxTVA])

  // ═══════════════════════════════════════════════════════════════
  // FORM HELPERS
  // ═══════════════════════════════════════════════════════════════

  const updateLigne = (id: string, field: keyof LigneDevisForm, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    }))
  }

  const addLigne = () => {
    setForm((prev) => ({ ...prev, lignes: [...prev.lignes, EMPTY_LIGNE()] }))
  }

  const removeLigne = (id: string) => {
    if (form.lignes.length <= 1) return
    setForm((prev) => ({ ...prev, lignes: prev.lignes.filter((l) => l.id !== id) }))
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleSearch = () => {
    setCurrentPage(1)
    fetchDevis(1, searchQuery, statutFilter)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatutFilter('')
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || statutFilter

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // ── Open Create ──
  const openCreate = () => {
    setEditingDevis(null)
    setForm(EMPTY_FORM())
    fetchClients()
    setFormOpen(true)
  }

  // ── Open Edit ──
  const openEdit = (devis: Devis) => {
    fetchClients()
    setEditingDevis(devis)
    setForm({
      clientId: devis.clientId,
      dateValidite: format(new Date(devis.dateValidite), 'yyyy-MM-dd'),
      remiseGlobale: devis.remiseGlobale,
      tauxTVA: devis.tauxTVA,
      conditions: devis.conditions || '',
      notes: devis.notes || '',
      lignes: (devis.lignes || []).map((l) => ({
        id: l.id || generateTempId(),
        designation: l.designation,
        description: l.description,
        quantite: l.quantite,
        unite: l.unite,
        prixUnitaire: l.prixUnitaire,
      })),
    })
    setFormOpen(true)
  }

  // ── Open Detail ──
  const openDetail = async (devis: Devis) => {
    setSelectedDevis(devis)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/v1/devis/${devis.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedDevis(data)
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Save Form ──
  const handleSave = async () => {
    if (!form.clientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (!form.dateValidite) {
      toast.error('Veuillez indiquer une date de validité')
      return
    }
    const hasValidLigne = form.lignes.some((l) => l.designation.trim() !== '' && l.prixUnitaire > 0)
    if (!hasValidLigne) {
      toast.error('Ajoutez au moins une ligne avec une désignation et un prix')
      return
    }

    setFormSaving(true)
    try {
      const payload = {
        clientId: form.clientId,
        dateValidite: form.dateValidite,
        remiseGlobale: form.remiseGlobale,
        tauxTVA: form.tauxTVA,
        conditions: form.conditions || null,
        notes: form.notes || null,
        lignes: form.lignes
          .filter((l) => l.designation.trim() !== '')
          .map((l) => ({
            designation: l.designation,
            description: l.description,
            quantite: l.quantite,
            unite: l.unite,
            prixUnitaire: l.prixUnitaire,
          })),
      }

      const isEdit = editingDevis !== null
      const res = await fetch(isEdit ? `/api/devis/${editingDevis.id}` : '/api/devis', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(isEdit ? 'Devis modifié avec succès' : 'Devis créé avec succès')
        setFormOpen(false)
        fetchDevis(currentPage, searchQuery, statutFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setFormSaving(false)
    }
  }

  // ── Delete ──
  const confirmDelete = (devis: Devis) => {
    setDeleteTarget(devis)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/devis/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Devis "${deleteTarget.numero}" supprimé`)
        setDeleteOpen(false)
        fetchDevis(currentPage, searchQuery, statutFilter)
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

  // ── Status Change ──
  const confirmStatusChange = (devis: Devis, action: string) => {
    setStatusTarget(devis)
    setStatusAction(action)
    setStatusOpen(true)
  }

  const handleStatusChange = async () => {
    if (!statusTarget || !statusAction) return
    setStatusChanging(true)
    try {
      const res = await fetch(`/api/v1/devis/${statusTarget.id}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: statusAction }),
      })
      if (res.ok) {
        const statusLabel = STATUS_CONFIG[statusAction]?.label || statusAction
        toast.success(`Devis "${statusTarget.numero}" → ${statusLabel}`)
        setStatusOpen(false)
        setDetailOpen(false)
        fetchDevis(currentPage, searchQuery, statutFilter)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setStatusChanging(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Gestion des Devis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination.total} devis{pagination.total !== 1 ? '' : ''}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Devis
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
                placeholder="Rechercher par numéro, client..."
                className="pl-9"
              />
            </div>
            <Select value={statutFilter || 'TOUS'} onValueChange={(v) => setStatutFilter(v === 'TOUS' ? '' : v)}>
              <SelectTrigger className="sm:w-[180px]">
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
        <TableSkeleton rows={5} />
      ) : devisList.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? 'Aucun résultat' : 'Aucun devis'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters
                ? 'Aucun devis ne correspond à vos filtres.'
                : 'Commencez par créer un devis.'}
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
                    <TableHead className="pl-4">Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Client</TableHead>
                    <TableHead className="hidden md:table-cell">Émission</TableHead>
                    <TableHead className="hidden lg:table-cell">Validité</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Lignes</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devisList.map((devis, index) => {
                    const statusCfg = STATUS_CONFIG[devis.statut] || STATUS_CONFIG.BROUILLON
                    return (
                      <motion.tr
                        key={devis.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                        onClick={() => openDetail(devis)}
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{devis.numero}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{devis.client.raisonSociale}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{devis.client?.raisonSociale || '—'}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(devis.dateEmission), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(devis.dateValidite), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-foreground">
                            {formatFCFACurrency(devis.totalTTC)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {devis._count?.lignes || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', statusCfg.className)}>
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(devis)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir
                              </DropdownMenuItem>
                              {devis.statut === 'BROUILLON' && (
                                <>
                                  <DropdownMenuItem onClick={() => openEdit(devis)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => confirmStatusChange(devis, 'ENVOYE')} className="text-sky-600 focus:text-sky-600">
                                    <Send className="w-4 h-4 mr-2" />
                                    Envoyer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => confirmDelete(devis)} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                              {devis.statut === 'ENVOYE' && (
                                <>
                                  <DropdownMenuItem onClick={() => confirmStatusChange(devis, 'ACCEPTE')} className="text-emerald-600 focus:text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Accepter
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => confirmStatusChange(devis, 'REFUSE')} className="text-red-600 focus:text-red-600">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Refuser
                                  </DropdownMenuItem>
                                </>
                              )}
                              {devis.statut === 'EXPIRE' && (
                                <DropdownMenuItem onClick={() => confirmStatusChange(devis, 'BROUILLON')} className="text-amber-600 focus:text-amber-600">
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Remettre en brouillon
                                </DropdownMenuItem>
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

      {/* ═══════════════════════════════════════════════════════════════
          CREATE / EDIT DIALOG
          ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              {editingDevis ? `Modifier le devis ${editingDevis.numero}` : 'Nouveau Devis'}
            </DialogTitle>
            <DialogDescription>
              {editingDevis ? 'Modifiez les informations du devis ci-dessous.' : 'Remplissez les informations pour créer un nouveau devis.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6 py-2">
              {/* ── Section 1: Info devis ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Informations du devis
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-select">Client *</Label>
                    <Select
                      value={form.clientId}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, clientId: v }))}
                    >
                      <SelectTrigger id="client-select">
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
                  <div className="space-y-2">
                    <Label htmlFor="date-validite">Date de validité *</Label>
                    <Input
                      id="date-validite"
                      type="date"
                      value={form.dateValidite}
                      onChange={(e) => setForm((prev) => ({ ...prev, dateValidite: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remise-globale">Remise globale (%)</Label>
                    <div className="relative">
                      <Input
                        id="remise-globale"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={form.remiseGlobale}
                        onChange={(e) => setForm((prev) => ({ ...prev, remiseGlobale: parseFloat(e.target.value) || 0 }))}
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taux-tva">Taux TVA (%)</Label>
                    <div className="relative">
                      <Input
                        id="taux-tva"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={form.tauxTVA}
                        onChange={(e) => setForm((prev) => ({ ...prev, tauxTVA: parseFloat(e.target.value) || 0 }))}
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conditions">Conditions</Label>
                  <Textarea
                    id="conditions"
                    value={form.conditions}
                    onChange={(e) => setForm((prev) => ({ ...prev, conditions: e.target.value }))}
                    placeholder="Conditions de paiement, délais..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes internes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes internes..."
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* ── Section 2: Lignes du devis ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Lignes du devis ({form.lignes.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={addLigne} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter une ligne
                  </Button>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Désignation</TableHead>
                        <TableHead className="hidden lg:table-cell">Description</TableHead>
                        <TableHead className="w-[80px] text-center">Qté</TableHead>
                        <TableHead className="w-[60px] text-center">Unité</TableHead>
                        <TableHead className="w-[120px] text-right">Prix unit.</TableHead>
                        <TableHead className="w-[120px] text-right">Total HT</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.lignes.map((ligne) => {
                        const lineTotal = ligne.quantite * ligne.prixUnitaire
                        return (
                          <TableRow key={ligne.id}>
                            <TableCell className="py-2">
                              <Input
                                value={ligne.designation}
                                onChange={(e) => updateLigne(ligne.id, 'designation', e.target.value)}
                                placeholder="Désignation"
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell className="hidden lg:table-cell py-2">
                              <Input
                                value={ligne.description}
                                onChange={(e) => updateLigne(ligne.id, 'description', e.target.value)}
                                placeholder="Description"
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={ligne.quantite}
                                onChange={(e) => updateLigne(ligne.id, 'quantite', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-center"
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                value={ligne.unite}
                                onChange={(e) => updateLigne(ligne.id, 'unite', e.target.value)}
                                placeholder="u"
                                className="h-8 text-sm text-center"
                              />
                            </TableCell>
                            <TableCell className="py-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={ligne.prixUnitaire}
                                onChange={(e) => updateLigne(ligne.id, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-right"
                              />
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <span className="text-sm font-medium text-foreground">
                                {formatFCFACurrency(lineTotal)}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeLigne(ligne.id)}
                                disabled={form.lignes.length <= 1}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Totals Summary ── */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total HT</span>
                      <span className="font-medium">{formatFCFACurrency(totals.totalHT)}</span>
                    </div>
                    {totals.remise > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Remise ({form.remiseGlobale}%)
                        </span>
                        <span className="text-red-600 font-medium">-{formatFCFACurrency(totals.remise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span className="font-medium">{formatFCFACurrency(totals.sousTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        TVA ({form.tauxTVA}%)
                      </span>
                      <span className="font-medium">{formatFCFACurrency(totals.montantTVA)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total TTC</span>
                      <span className="text-emerald-600">{formatFCFACurrency(totals.totalTTC)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={formSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {editingDevis ? 'Enregistrer' : 'Créer le devis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          DETAIL DIALOG
          ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedDevis ? (
            <>
              <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      {selectedDevis.numero}
                    </DialogTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 border',
                        STATUS_CONFIG[selectedDevis.statut]?.className || STATUS_CONFIG.BROUILLON.className
                      )}
                    >
                      {STATUS_CONFIG[selectedDevis.statut]?.label || selectedDevis.statut}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedDevis.statut === 'BROUILLON' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit(selectedDevis) }} className="gap-2">
                          <Pencil className="w-4 h-4" />
                          Modifier
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmStatusChange(selectedDevis, 'ENVOYE')} className="gap-2 text-sky-600 border-sky-300 hover:bg-sky-50">
                          <Send className="w-4 h-4" />
                          Envoyer
                        </Button>
                      </>
                    )}
                    {selectedDevis.statut === 'ENVOYE' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => confirmStatusChange(selectedDevis, 'ACCEPTE')} className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                          <CheckCircle2 className="w-4 h-4" />
                          Accepter
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmStatusChange(selectedDevis, 'REFUSE')} className="gap-2 text-red-600 border-red-300 hover:bg-red-50">
                          <XCircle className="w-4 h-4" />
                          Refuser
                        </Button>
                      </>
                    )}
                    {selectedDevis.statut === 'EXPIRE' && (
                      <Button variant="outline" size="sm" onClick={() => confirmStatusChange(selectedDevis, 'BROUILLON')} className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
                        <RotateCcw className="w-4 h-4" />
                        Brouillon
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-2">
                      <Printer className="w-4 h-4" />
                      Imprimer
                    </Button>
                  </div>
                </div>
                <DialogDescription className="mt-1">
                  Émis le {format(new Date(selectedDevis.dateEmission), 'dd MMMM yyyy', { locale: fr })}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-6 py-2">
                  {detailLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-40 w-full" />
                      <Skeleton className="h-24 w-48 ml-auto" />
                    </div>
                  ) : (
                    <>
                      {/* Client Info */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Client
                          </h4>
                          <div className="space-y-2">
                            <p className="font-medium text-foreground text-sm">
                              {selectedDevis.client?.raisonSociale || '—'}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              {selectedDevis.client?.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5" />
                                  {selectedDevis.client.email}
                                </span>
                              )}
                              {selectedDevis.client?.telephone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  {selectedDevis.client.telephone}
                                </span>
                              )}
                              {selectedDevis.client?.adresse && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {selectedDevis.client.adresse}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dates + Conditions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border">
                          <CardContent className="p-4 space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Dates
                            </h4>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                Émission : {format(new Date(selectedDevis.dateEmission), 'dd/MM/yyyy', { locale: fr })}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                Validité : {format(new Date(selectedDevis.dateValidite), 'dd/MM/yyyy', { locale: fr })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        {(selectedDevis.conditions || selectedDevis.notes) && (
                          <Card className="border">
                            <CardContent className="p-4 space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Conditions & Notes
                              </h4>
                              {selectedDevis.conditions && (
                                <p className="text-sm text-muted-foreground">{selectedDevis.conditions}</p>
                              )}
                              {selectedDevis.notes && (
                                <p className="text-sm text-muted-foreground italic">{selectedDevis.notes}</p>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Lignes Table */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Lignes du devis
                        </h4>
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Désignation</TableHead>
                                <TableHead className="hidden sm:table-cell">Description</TableHead>
                                <TableHead className="text-center">Qté</TableHead>
                                <TableHead className="hidden sm:table-cell text-center">Unité</TableHead>
                                <TableHead className="text-right">Prix unit.</TableHead>
                                <TableHead className="text-right">Total HT</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(selectedDevis.lignes || []).map((ligne, idx) => (
                                <TableRow key={ligne.id || idx}>
                                  <TableCell className="font-medium text-sm">
                                    {ligne.designation}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                    {ligne.description || '—'}
                                  </TableCell>
                                  <TableCell className="text-center text-sm">
                                    {ligne.quantite}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-center text-sm text-muted-foreground">
                                    {ligne.unite}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {formatFCFACurrency(ligne.prixUnitaire)}
                                  </TableCell>
                                  <TableCell className="text-right text-sm font-medium">
                                    {formatFCFACurrency(ligne.totalHT)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {(!selectedDevis.lignes || selectedDevis.lignes.length === 0) && (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                                    Aucune ligne
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end">
                        <div className="w-full sm:w-72 space-y-2 p-4 rounded-lg bg-muted/50 border">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total HT</span>
                            <span className="font-medium">{formatFCFACurrency(selectedDevis.totalHT)}</span>
                          </div>
                          {selectedDevis.remise > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Remise</span>
                              <span className="text-red-600 font-medium">-{formatFCFACurrency(selectedDevis.remise)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sous-total</span>
                            <span className="font-medium">{formatFCFACurrency(selectedDevis.sousTotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              TVA ({selectedDevis.tauxTVA}%)
                            </span>
                            <span className="font-medium">{formatFCFACurrency(selectedDevis.montantTVA)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total TTC</span>
                            <span className="text-emerald-600">{formatFCFACurrency(selectedDevis.totalTTC)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
          ═══════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer le devis
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le devis &quot;{deleteTarget?.numero}&quot; ?
              Seuls les devis en brouillon peuvent être supprimés. Cette action est irréversible.
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

      {/* ═══════════════════════════════════════════════════════════════
          STATUS CHANGE CONFIRMATION
          ═══════════════════════════════════════════════════════════════ */}
      <AlertDialog open={statusOpen} onOpenChange={setStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {statusAction === 'ACCEPTE' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {statusAction === 'REFUSE' && <XCircle className="w-5 h-5 text-red-500" />}
              {statusAction === 'ENVOYE' && <Send className="w-5 h-5 text-sky-500" />}
              {statusAction === 'BROUILLON' && <RotateCcw className="w-5 h-5 text-amber-500" />}
              Changer le statut
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction === 'ACCEPTE' && `Voulez-vous accepter le devis "${statusTarget?.numero}" ? Le client sera notifié.`}
              {statusAction === 'REFUSE' && `Voulez-vous refuser le devis "${statusTarget?.numero}" ? Le client sera notifié.`}
              {statusAction === 'ENVOYE' && `Voulez-vous envoyer le devis "${statusTarget?.numero}" au client "${statusTarget?.client?.raisonSociale}" ?`}
              {statusAction === 'BROUILLON' && `Voulez-vous remettre le devis "${statusTarget?.numero}" en brouillon ? Vous pourrez le modifier.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusChanging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStatusChange}
              disabled={statusChanging}
              className={cn(
                statusAction === 'ACCEPTE' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                statusAction === 'REFUSE' && 'bg-red-600 hover:bg-red-700 text-white',
                statusAction === 'ENVOYE' && 'bg-sky-600 hover:bg-sky-700 text-white',
                statusAction === 'BROUILLON' && 'bg-amber-600 hover:bg-amber-700 text-white',
                !['ACCEPTE', 'REFUSE', 'ENVOYE', 'BROUILLON'].includes(statusAction) && 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              {statusChanging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {statusAction === 'ACCEPTE' && 'Accepter'}
              {statusAction === 'REFUSE' && 'Refuser'}
              {statusAction === 'ENVOYE' && 'Envoyer'}
              {statusAction === 'BROUILLON' && 'Remettre en brouillon'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
