'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
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
  Briefcase,
  CreditCard,
  CheckCircle2,
  X,
  CalendarDays,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ScrollText,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChantierInfo {
  id: string
  nom: string
  statut: string
}

interface Contrat {
  id: string
  sousTraitantId: string
  chantierId: string
  objetTravaux: string
  montantHT: number
  dateDebut: string | null
  dateFin: string | null
  conditions: string | null
  statut: string
  createdAt: string
  chantier: ChantierInfo
}

interface SousTraitantList {
  id: string
  raisonSociale: string
  rccm: string | null
  contact: string | null
  specialite: string | null
  rib: string | null
  entrepriseId: string | null
  createdAt: string
  _count: {
    contrats: number
  }
}

interface SousTraitantDetail {
  id: string
  raisonSociale: string
  rccm: string | null
  contact: string | null
  specialite: string | null
  rib: string | null
  entrepriseId: string | null
  createdAt: string
  contrats: Contrat[]
}

interface ChantierOption {
  id: string
  nom: string
}

interface KpiData {
  totalSousTraitants: number
  contratsEnCours: number
  montantTotalEngage: number
}

interface SousTraitantFormData {
  raisonSociale: string
  rccm: string
  contact: string
  specialite: string
  rib: string
}

interface ContratFormData {
  chantierId: string
  objetTravaux: string
  montantHT: string
  dateDebut: string
  dateFin: string
  conditions: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  EN_COURS: {
    label: 'En cours',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  RECEPTIONNE: {
    label: 'Réceptionné',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  SOLDE: {
    label: 'Soldé',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  ANNULE: {
    label: 'Annulé',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
}

const EMPTY_ST_FORM: SousTraitantFormData = {
  raisonSociale: '',
  rccm: '',
  contact: '',
  specialite: '',
  rib: '',
}

const EMPTY_CONTRAT_FORM: ContratFormData = {
  chantierId: '',
  objetTravaux: '',
  montantHT: '',
  dateDebut: '',
  dateFin: '',
  conditions: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: fr })
  } catch {
    return '—'
  }
}

function maskRIB(rib: string | null): string {
  if (!rib) return '—'
  const cleaned = rib.replace(/\s/g, '')
  if (cleaned.length <= 8) return rib
  const first4 = cleaned.substring(0, 4)
  const last4 = cleaned.substring(cleaned.length - 4)
  return `${first4} **** **** ${last4}`
}

function getStatutBadge(statut: string): { label: string; className: string } {
  return STATUT_CONFIG[statut] || {
    label: statut,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SousTraitantsView() {
  // ── State ──────────────────────────────────────────────────────────────
  const [sousTraitants, setSousTraitants] = useState<SousTraitantList[]>([])
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Sous-traitant form dialog
  const [stFormOpen, setStFormOpen] = useState(false)
  const [editingStId, setEditingStId] = useState<string | null>(null)
  const [stForm, setStForm] = useState<SousTraitantFormData>(EMPTY_ST_FORM)
  const [stSubmitting, setStSubmitting] = useState(false)

  // Delete sous-traitant dialog
  const [deleteStOpen, setDeleteStOpen] = useState(false)
  const [deletingStId, setDeletingStId] = useState<string | null>(null)
  const [deletingStName, setDeletingStName] = useState('')
  const [deletingSt, setDeletingSt] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSt, setDetailSt] = useState<SousTraitantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Contrat form dialog
  const [contratFormOpen, setContratFormOpen] = useState(false)
  const [contratForm, setContratForm] = useState<ContratFormData>(EMPTY_CONTRAT_FORM)
  const [contratSubmitting, setContratSubmitting] = useState(false)

  // Contrat statut edit
  const [editingContratStatut, setEditingContratStatut] = useState<string | null>(null)
  const [newStatut, setNewStatut] = useState('')

  // Delete contrat dialog
  const [deleteContratOpen, setDeleteContratOpen] = useState(false)
  const [deletingContratId, setDeletingContratId] = useState<string | null>(null)
  const [deletingContratObjet, setDeletingContratObjet] = useState('')
  const [deletingContrat, setDeletingContrat] = useState(false)

  // ── Fetch data ─────────────────────────────────────────────────────────

  const fetchSousTraitants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/sous-traitants?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setSousTraitants(json.sousTraitants)
        setKpi(json.kpi)
      } else {
        toast.error('Erreur lors du chargement des sous-traitants')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchChantiers = useCallback(async () => {
    try {
      const res = await fetch('/api/chantiers')
      if (res.ok) {
        const json = await res.json()
        setChantiers(
          (json.chantiers || []).map((c: { id: string; nom: string }) => ({
            id: c.id,
            nom: c.nom,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchSousTraitants()
  }, [fetchSousTraitants])

  useEffect(() => {
    fetchChantiers()
  }, [fetchChantiers])

  // ── Sous-traitant CRUD ────────────────────────────────────────────────

  const openCreateSt = () => {
    setEditingStId(null)
    setStForm(EMPTY_ST_FORM)
    setStFormOpen(true)
  }

  const openEditSt = (st: SousTraitantList) => {
    setEditingStId(st.id)
    setStForm({
      raisonSociale: st.raisonSociale,
      rccm: st.rccm || '',
      contact: st.contact || '',
      specialite: st.specialite || '',
      rib: st.rib || '',
    })
    setStFormOpen(true)
  }

  const handleSubmitSt = async () => {
    if (!stForm.raisonSociale.trim()) {
      toast.error('La raison sociale est requise')
      return
    }

    setStSubmitting(true)
    try {
      const body = {
        raisonSociale: stForm.raisonSociale.trim(),
        rccm: stForm.rccm.trim() || null,
        contact: stForm.contact.trim() || null,
        specialite: stForm.specialite.trim() || null,
        rib: stForm.rib.trim() || null,
      }

      let res: Response
      if (editingStId) {
        res = await fetch(`/api/sous-traitants/${editingStId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/sous-traitants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingStId
            ? 'Sous-traitant mis à jour avec succès'
            : 'Sous-traitant créé avec succès'
        )
        setStFormOpen(false)
        fetchSousTraitants()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setStSubmitting(false)
    }
  }

  const confirmDeleteSt = (st: SousTraitantList) => {
    setDeletingStId(st.id)
    setDeletingStName(st.raisonSociale)
    setDeleteStOpen(true)
  }

  const handleDeleteSt = async () => {
    if (!deletingStId) return

    setDeletingSt(true)
    try {
      const res = await fetch(`/api/sous-traitants/${deletingStId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Sous-traitant supprimé avec succès')
        setDeleteStOpen(false)
        setDeletingStId(null)
        setDeletingStName('')
        fetchSousTraitants()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeletingSt(false)
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────

  const openDetail = async (st: SousTraitantList) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailSt(null)
    try {
      const res = await fetch(`/api/sous-traitants/${st.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailSt(data)
      } else {
        toast.error('Erreur lors du chargement des détails')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Contrat CRUD ──────────────────────────────────────────────────────

  const openCreateContrat = () => {
    if (!detailSt) return
    setContratForm(EMPTY_CONTRAT_FORM)
    setContratFormOpen(true)
  }

  const handleSubmitContrat = async () => {
    if (!detailSt) return
    if (!contratForm.chantierId) {
      toast.error('Veuillez sélectionner un chantier')
      return
    }
    if (!contratForm.objetTravaux.trim()) {
      toast.error("L'objet des travaux est requis")
      return
    }
    if (!contratForm.montantHT || parseFloat(contratForm.montantHT) < 0) {
      toast.error('Le montant HT doit être un nombre positif')
      return
    }

    setContratSubmitting(true)
    try {
      const body = {
        chantierId: contratForm.chantierId,
        objetTravaux: contratForm.objetTravaux.trim(),
        montantHT: parseFloat(contratForm.montantHT),
        dateDebut: contratForm.dateDebut || null,
        dateFin: contratForm.dateFin || null,
        conditions: contratForm.conditions.trim() || null,
      }

      const res = await fetch(`/api/sous-traitants/${detailSt.id}/contrats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Contrat créé avec succès')
        setContratFormOpen(false)
        // Refresh detail
        const detailRes = await fetch(`/api/sous-traitants/${detailSt.id}`)
        if (detailRes.ok) {
          setDetailSt(await detailRes.json())
        }
        fetchSousTraitants()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setContratSubmitting(false)
    }
  }

  const handleChangeStatut = async (contratId: string) => {
    if (!detailSt || !newStatut) return

    try {
      const res = await fetch(
        `/api/sous-traitants/${detailSt.id}/contrats/${contratId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: newStatut }),
        }
      )

      if (res.ok) {
        toast.success('Statut du contrat mis à jour')
        setEditingContratStatut(null)
        setNewStatut('')
        // Refresh detail
        const detailRes = await fetch(`/api/sous-traitants/${detailSt.id}`)
        if (detailRes.ok) {
          setDetailSt(await detailRes.json())
        }
        fetchSousTraitants()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const confirmDeleteContrat = (contrat: Contrat) => {
    setDeletingContratId(contrat.id)
    setDeletingContratObjet(contrat.objetTravaux)
    setDeleteContratOpen(true)
  }

  const handleDeleteContrat = async () => {
    if (!detailSt || !deletingContratId) return

    setDeletingContrat(true)
    try {
      const res = await fetch(
        `/api/sous-traitants/${detailSt.id}/contrats/${deletingContratId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        toast.success('Contrat supprimé avec succès')
        setDeleteContratOpen(false)
        setDeletingContratId(null)
        // Refresh detail
        const detailRes = await fetch(`/api/sous-traitants/${detailSt.id}`)
        if (detailRes.ok) {
          setDetailSt(await detailRes.json())
        }
        fetchSousTraitants()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeletingContrat(false)
    }
  }

  // ── KPI Cards ─────────────────────────────────────────────────────────

  const kpiCards = kpi
    ? [
        {
          label: 'Total sous-traitants',
          value: kpi.totalSousTraitants,
          icon: Users,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Contrats en cours',
          value: kpi.contratsEnCours,
          icon: FileText,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
        {
          label: 'Montant total engagé',
          value: formatFCFA(kpi.montantTotalEngage),
          icon: CircleDollarSign,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          border: 'border-violet-200',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sous-traitants</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les sous-traitants et leurs contrats
          </p>
        </div>
        <Button
          onClick={openCreateSt}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau sous-traitant
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {card.label}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'p-2 rounded-lg border',
                        card.bg,
                        card.border
                      )}
                    >
                      <Icon className={cn('w-4 h-4', card.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Search */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par raison sociale ou spécialité..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sous-traitant List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sousTraitants.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Aucun sous-traitant trouvé
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? 'Aucun sous-traitant ne correspond à votre recherche.'
              : 'Commencez par ajouter votre premier sous-traitant.'}
          </p>
          {!search && (
            <Button
              onClick={openCreateSt}
              className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un sous-traitant
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={search}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {sousTraitants.map((st, index) => (
              <motion.div
                key={st.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Card className="border shadow-sm hover:shadow-md transition-shadow group h-full">
                  <CardContent className="p-4 flex flex-col gap-3">
                    {/* Raison sociale + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-violet-600" />
                        </div>
                        <h3 className="font-semibold text-foreground text-sm truncate">
                          {st.raisonSociale}
                        </h3>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                          onClick={() => openDetail(st)}
                          title="Voir les détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                          onClick={() => openEditSt(st)}
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => confirmDeleteSt(st)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Info details */}
                    <div className="space-y-1.5 text-xs">
                      {st.rccm && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ScrollText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                          <span className="truncate">RCCM: {st.rccm}</span>
                        </div>
                      )}
                      {st.contact && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                          <span className="truncate">{st.contact}</span>
                        </div>
                      )}
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {st.specialite && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-violet-50 text-violet-700 border-violet-200"
                        >
                          {st.specialite}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          st._count.contrats > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        )}
                      >
                        <FileText className="w-3 h-3 mr-0.5" />
                        {st._count.contrats} contrat{st._count.contrats > 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {/* RIB masked */}
                    {st.rib && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                        <CreditCard className="w-3 h-3 shrink-0" />
                        <span className="font-mono">{maskRIB(st.rib)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Create/Edit Sous-traitant Dialog ─────────────────────────────── */}
      <Dialog
        open={stFormOpen}
        onOpenChange={(open) => !open && setStFormOpen(false)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStId
                ? 'Modifier le sous-traitant'
                : 'Nouveau sous-traitant'}
            </DialogTitle>
            <DialogDescription>
              {editingStId
                ? 'Modifiez les informations du sous-traitant ci-dessous.'
                : 'Remplissez les informations pour ajouter un nouveau sous-traitant.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Raison sociale */}
            <div className="grid gap-2">
              <Label htmlFor="raisonSociale">
                Raison sociale <span className="text-red-500">*</span>
              </Label>
              <Input
                id="raisonSociale"
                placeholder="Ex: BatiConseil SARL"
                value={stForm.raisonSociale}
                onChange={(e) =>
                  setStForm({ ...stForm, raisonSociale: e.target.value })
                }
              />
            </div>

            {/* RCCM */}
            <div className="grid gap-2">
              <Label htmlFor="rccm">N° RCCM</Label>
              <Input
                id="rccm"
                placeholder="Ex: CD/KIN/RCCM/23-A-12345"
                value={stForm.rccm}
                onChange={(e) =>
                  setStForm({ ...stForm, rccm: e.target.value })
                }
              />
            </div>

            {/* Contact */}
            <div className="grid gap-2">
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                placeholder="Ex: +243 812 345 678"
                value={stForm.contact}
                onChange={(e) =>
                  setStForm({ ...stForm, contact: e.target.value })
                }
              />
            </div>

            {/* Spécialité */}
            <div className="grid gap-2">
              <Label htmlFor="specialite">Spécialité</Label>
              <Input
                id="specialite"
                placeholder="Ex: Électricité générale, Maçonnerie..."
                value={stForm.specialite}
                onChange={(e) =>
                  setStForm({ ...stForm, specialite: e.target.value })
                }
              />
            </div>

            {/* RIB */}
            <div className="grid gap-2">
              <Label htmlFor="rib">RIB</Label>
              <Input
                id="rib"
                placeholder="Ex: 0001 0002 0003 0004"
                value={stForm.rib}
                onChange={(e) =>
                  setStForm({ ...stForm, rib: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStFormOpen(false)}
              disabled={stSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitSt}
              disabled={stSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {stSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {editingStId ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {editingStId ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Sous-traitant Confirmation ────────────────────────────── */}
      <AlertDialog
        open={deleteStOpen}
        onOpenChange={(open) => !open && setDeleteStOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Supprimer {deletingStName} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les contrats associés à ce
              sous-traitant seront également supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSt}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSt}
              disabled={deletingSt}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingSt ? (
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

      {/* ── Detail Dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false)
            setDetailSt(null)
            setEditingContratStatut(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-600" />
              {detailSt?.raisonSociale || 'Détails du sous-traitant'}
            </DialogTitle>
            <DialogDescription>
              Informations détaillées et contrats associés
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : detailSt ? (
            <div className="flex-1 overflow-y-auto">
              {/* Sous-traitant info */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailSt.rccm && (
                    <div className="flex items-center gap-2 text-sm">
                      <ScrollText className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">RCCM:</span>
                      <span className="font-medium">{detailSt.rccm}</span>
                    </div>
                  )}
                  {detailSt.contact && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="font-medium">{detailSt.contact}</span>
                    </div>
                  )}
                  {detailSt.specialite && (
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">Spécialité:</span>
                      <Badge
                        variant="outline"
                        className="bg-violet-50 text-violet-700 border-violet-200"
                      >
                        {detailSt.specialite}
                      </Badge>
                    </div>
                  )}
                  {detailSt.rib && (
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">RIB:</span>
                      <span className="font-mono text-xs">
                        {maskRIB(detailSt.rib)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="mb-4" />

              {/* Contrats section */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Contrats ({detailSt.contrats.length})
                </h3>
                <Button
                  size="sm"
                  onClick={openCreateContrat}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </Button>
              </div>

              {detailSt.contrats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun contrat pour ce sous-traitant</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="space-y-3 pr-3">
                    {detailSt.contrats.map((contrat) => {
                      const statutBadge = getStatutBadge(contrat.statut)

                      return (
                        <Card
                          key={contrat.id}
                          className="border shadow-sm hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header: objet + statut + actions */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                <h4 className="font-medium text-sm text-foreground truncate">
                                  {contrat.objetTravaux}
                                </h4>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                  onClick={() => confirmDeleteContrat(contrat)}
                                  title="Supprimer le contrat"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Statut badge (clickable to edit) */}
                            <div
                              className="cursor-pointer inline-block"
                              onClick={() => {
                                setEditingContratStatut(contrat.id)
                                setNewStatut(contrat.statut)
                              }}
                              title="Cliquer pour changer le statut"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[11px] cursor-pointer hover:opacity-80 transition-opacity',
                                  statutBadge.className
                                )}
                              >
                                {statutBadge.label}
                              </Badge>
                            </div>

                            {/* Inline statut editor */}
                            {editingContratStatut === contrat.id && (
                              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                                <Select
                                  value={newStatut}
                                  onValueChange={setNewStatut}
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EN_COURS">
                                      En cours
                                    </SelectItem>
                                    <SelectItem value="RECEPTIONNE">
                                      Réceptionné
                                    </SelectItem>
                                    <SelectItem value="SOLDE">
                                      Soldé
                                    </SelectItem>
                                    <SelectItem value="ANNULE">
                                      Annulé
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                                  onClick={() =>
                                    handleChangeStatut(contrat.id)
                                  }
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingContratStatut(null)
                                    setNewStatut('')
                                  }}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}

                            {/* Details grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <CircleDollarSign className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-medium text-foreground">
                                  {formatFCFA(contrat.montantHT)}
                                </span>
                                <span>HT</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Building2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {contrat.chantier.nom}
                                </span>
                              </div>
                              {contrat.dateDebut && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {formatDate(contrat.dateDebut)}
                                    {contrat.dateFin
                                      ? ` → ${formatDate(contrat.dateFin)}`
                                      : ' → en cours'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Conditions */}
                            {contrat.conditions && (
                              <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 border">
                                {contrat.conditions}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : null}

          <DialogFooter className="mt-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setDetailOpen(false)
                setDetailSt(null)
              }}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Contrat Dialog ───────────────────────────────────────── */}
      <Dialog
        open={contratFormOpen}
        onOpenChange={(open) => !open && setContratFormOpen(false)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              Nouveau contrat
            </DialogTitle>
            <DialogDescription>
              Créez un contrat pour{' '}
              <span className="font-semibold text-foreground">
                {detailSt?.raisonSociale}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Chantier */}
            <div className="grid gap-2">
              <Label>
                Chantier <span className="text-red-500">*</span>
              </Label>
              <Select
                value={contratForm.chantierId}
                onValueChange={(value) =>
                  setContratForm({ ...contratForm, chantierId: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un chantier" />
                </SelectTrigger>
                <SelectContent>
                  {chantiers.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Aucun chantier disponible
                    </SelectItem>
                  ) : (
                    chantiers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nom}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Objet des travaux */}
            <div className="grid gap-2">
              <Label htmlFor="objetTravaux">
                Objet des travaux <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="objetTravaux"
                placeholder="Ex: Réalisation des fondations profondes du bâtiment A"
                value={contratForm.objetTravaux}
                onChange={(e) =>
                  setContratForm({
                    ...contratForm,
                    objetTravaux: e.target.value,
                  })
                }
                rows={2}
              />
            </div>

            {/* Montant HT */}
            <div className="grid gap-2">
              <Label htmlFor="montantHT" className="flex items-center gap-1.5">
                <CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />
                Montant HT (FCFA) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="montantHT"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 15000000"
                value={contratForm.montantHT}
                onChange={(e) =>
                  setContratForm({ ...contratForm, montantHT: e.target.value })
                }
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="contratDateDebut"
                  className="flex items-center gap-1.5"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  Date de début
                </Label>
                <Input
                  id="contratDateDebut"
                  type="date"
                  value={contratForm.dateDebut}
                  onChange={(e) =>
                    setContratForm({
                      ...contratForm,
                      dateDebut: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="contratDateFin"
                  className="flex items-center gap-1.5"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  Date de fin
                </Label>
                <Input
                  id="contratDateFin"
                  type="date"
                  value={contratForm.dateFin}
                  onChange={(e) =>
                    setContratForm({
                      ...contratForm,
                      dateFin: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="grid gap-2">
              <Label htmlFor="conditions">Conditions</Label>
              <Textarea
                id="conditions"
                placeholder="Ex: Paiement à 30 jours, retenue de garantie 5%..."
                value={contratForm.conditions}
                onChange={(e) =>
                  setContratForm({
                    ...contratForm,
                    conditions: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContratFormOpen(false)}
              disabled={contratSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitContrat}
              disabled={contratSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {contratSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Créer le contrat
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Contrat Confirmation ──────────────────────────────────── */}
      <AlertDialog
        open={deleteContratOpen}
        onOpenChange={(open) => !open && setDeleteContratOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Supprimer le contrat ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous supprimer le contrat{' '}
              <span className="font-semibold text-foreground">
                &quot;{deletingContratObjet}&quot;
              </span>{' '}
              ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingContrat}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContrat}
              disabled={deletingContrat}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingContrat ? (
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
