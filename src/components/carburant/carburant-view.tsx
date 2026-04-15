'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Fuel,
  Droplets,
  Plus,
  Search,
  Trash2,
  Pencil,
  AlertTriangle,
  TrendingUp,
  Building,
  Truck,
  Gauge,
  CalendarDays,
  ArrowDownToLine,
  ArrowUpFromLine,
  ReceiptText,
  Warehouse,
  X,
  Loader2,
  CircleDollarSign,
  BarChart3,
  Zap,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────
interface Chantier {
  id: string
  nom: string
  statut: string
}

interface EnginOption {
  id: string
  designation: string
  typeEquipement: string | null
}

interface StockCarburant {
  id: string
  typeCarburant: string
  capacite: number
  quantiteDisponible: number
  seuilAlerte: number
  chantierId: string
  createdAt: string
}

interface EntreeCarburant {
  id: string
  stockCarburantId: string
  chantierId: string
  dateEntree: string
  quantite: number
  prixUnitaire: number
  prixTotal: number
  fournisseur: string | null
  numeroBL: string | null
  observation: string | null
  stockCarburant: { id: string; typeCarburant: string }
}

interface SortieCarburant {
  id: string
  stockCarburantId: string
  chantierId: string
  enginId: string | null
  dateSortie: string
  quantite: number
  operateur: string | null
  compteurAvant: number | null
  compteurApres: number | null
  observation: string | null
  stockCarburant: { id: string; typeCarburant: string }
  engin: { id: string; designation: string } | null
}

interface BonAchatCarburant {
  id: string
  chantierId: string
  enginId: string | null
  dateAchat: string
  typeCarburant: string
  quantite: number
  prixUnitaire: number
  prixTotal: number
  stationService: string | null
  numeroRecu: string | null
  operateur: string | null
  compteurAvant: number | null
  compteurApres: number | null
  observation: string | null
  engin: { id: string; designation: string } | null
}

interface ReleveCompteur {
  id: string
  chantierId: string
  enginId: string
  dateReleve: string
  heuresKm: number
  observation: string | null
  engin: { id: string; designation: string }
}

interface CarburantKpi {
  stockDisponible: number
  coutMois: number
  litresConsommes: number
  prixMoyenLitre: number
}

interface ConsoEngin {
  enginId: string
  enginDesignation: string
  litresConsommes: number
  heuresFonctionnement: number
  litresParHeure: number
  coutTotal: number
}

// ─── Constants ───────────────────────────────────────────────────────
const TYPES_CARBURANT = [
  { value: 'GASOIL', label: 'Gasoil' },
  { value: 'ESSENCE', label: 'Essence' },
]

const frFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function fmtN(n: number) {
  return frFmt.format(n)
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' FCFA'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd MMM yyyy', { locale: fr })
}

// ─── Component ───────────────────────────────────────────────────────
export function CarburantView() {
  // ─── State ─────────────────────────────────────────────────────────
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [activeChantierId, setActiveChantierId] = useState<string>('')
  const [engins, setEngins] = useState<EnginOption[]>([])
  const [modeCarburant, setModeCarburant] = useState<string>('STOCK_PHYSIQUE')

  // Data
  const [stocks, setStocks] = useState<StockCarburant[]>([])
  const [recentSorties, setRecentSorties] = useState<SortieCarburant[]>([])
  const [recentAchats, setRecentAchats] = useState<BonAchatCarburant[]>([])
  const [releves, setReleves] = useState<ReleveCompteur[]>([])
  const [entrees, setEntrees] = useState<EntreeCarburant[]>([])
  const [sorties, setSorties] = useState<SortieCarburant[]>([])
  const [achats, setAchats] = useState<BonAchatCarburant[]>([])
  const [consoParEngin, setConsoParEngin] = useState<ConsoEngin[]>([])
  const [kpi, setKpi] = useState<CarburantKpi>({
    stockDisponible: 0,
    coutMois: 0,
    litresConsommes: 0,
    prixMoyenLitre: 0,
  })

  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('stock')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [changingMode, setChangingMode] = useState(false)

  // Dialog states
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingInfo, setDeletingInfo] = useState<{
    id: string
    label: string
    type: string
  } | null>(null)

  // Stock form
  const [stockForm, setStockForm] = useState({
    typeCarburant: 'GASOIL',
    capacite: '',
    seuilAlerte: '',
  })

  // Entrée form
  const [entreeForm, setEntreeForm] = useState({
    stockCarburantId: '',
    dateEntree: format(new Date(), 'yyyy-MM-dd'),
    quantite: '',
    prixUnitaire: '',
    fournisseur: '',
    numeroBL: '',
    observation: '',
  })

  // Sortie form
  const [sortieForm, setSortieForm] = useState({
    stockCarburantId: '',
    enginId: '',
    dateSortie: format(new Date(), 'yyyy-MM-dd'),
    quantite: '',
    operateur: '',
    compteurAvant: '',
    compteurApres: '',
    observation: '',
  })

  // Achat form
  const [achatForm, setAchatForm] = useState({
    dateAchat: format(new Date(), 'yyyy-MM-dd'),
    typeCarburant: 'GASOIL',
    quantite: '',
    prixUnitaire: '',
    stationService: '',
    numeroRecu: '',
    enginId: '',
    operateur: '',
    compteurAvant: '',
    compteurApres: '',
    observation: '',
  })

  // Relevé form
  const [releveForm, setReleveForm] = useState({
    enginId: '',
    dateReleve: format(new Date(), 'yyyy-MM-dd'),
    heuresKm: '',
    observation: '',
  })

  // ─── Fetch chantiers ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchChantiers() {
      try {
        const res = await fetch('/api/chantiers')
        if (res.ok) {
          const data = await res.json()
          setChantiers(data.chantiers || [])
        }
      } catch {
        // silent
      }
    }
    fetchChantiers()
  }, [])

  // ─── Fetch engins ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchEngins() {
      try {
        const res = await fetch('/api/engins')
        if (res.ok) {
          const data = await res.json()
          setEngins(
            (data.engins || []).map((e: EnginOption) => ({
              id: e.id,
              designation: e.designation,
              typeEquipement: e.typeEquipement,
            }))
          )
        }
      } catch {
        // silent
      }
    }
    fetchEngins()
  }, [])

  // ─── Fetch main carburant data ─────────────────────────────────────
  const fetchCarburantData = useCallback(async () => {
    if (!activeChantierId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/carburant?chantierId=${activeChantierId}`)
      if (res.ok) {
        const data = await res.json()
        setModeCarburant(data.modeCarburant || 'STOCK_PHYSIQUE')
        setStocks(data.stocks || [])
        setRecentSorties(data.recentSorties || [])
        setRecentAchats(data.recentAchats || [])
        setReleves(data.releves || [])
        setEntrees(data.entrees || [])
        setSorties(data.sorties || [])
        setAchats(data.achats || [])
        setKpi(
          data.kpi || {
            stockDisponible: 0,
            coutMois: 0,
            litresConsommes: 0,
            prixMoyenLitre: 0,
          }
        )
      }
    } catch {
      toast.error('Erreur lors du chargement des données carburant')
    } finally {
      setLoading(false)
    }
  }, [activeChantierId])

  useEffect(() => {
    fetchCarburantData()
  }, [fetchCarburantData])

  // ─── Fetch stats ───────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!activeChantierId) return
    try {
      const now = new Date()
      const params = new URLSearchParams({
        chantierId: activeChantierId,
        mois: String(now.getMonth() + 1),
        annee: String(now.getFullYear()),
      })
      const res = await fetch(`/api/carburant/stats?${params}`)
      if (res.ok) {
        const data = await res.json()
        setConsoParEngin(data.stats || [])
      }
    } catch {
      // silent
    }
  }, [activeChantierId])

  useEffect(() => {
    if (activeTab === 'consommation') {
      fetchStats()
    }
  }, [activeTab, fetchStats])

  // ─── Auto-set activeTab based on mode ─────────────────────────────
  useEffect(() => {
    if (modeCarburant === 'ACHAT_DIRECT' && activeTab === 'stock') {
      setActiveTab('achats')
    } else if (modeCarburant === 'STOCK_PHYSIQUE' && activeTab === 'achats') {
      setActiveTab('stock')
    }
  }, [modeCarburant])

  // ─── Stock level helpers ──────────────────────────────────────────
  function getStockStatus(item: StockCarburant) {
    if (item.quantiteDisponible <= item.seuilAlerte) return 'critique'
    if (item.quantiteDisponible <= item.seuilAlerte * 1.5) return 'faible'
    return 'ok'
  }

  function StockStatusBadge({ item }: { item: StockCarburant }) {
    const status = getStockStatus(item)
    const config = {
      ok: {
        bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'OK',
      },
      faible: {
        bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Faible',
      },
      critique: {
        bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        dot: 'bg-red-500',
        label: 'Critique',
      },
    }[status]
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          config.bg
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
        {config.label}
      </span>
    )
  }

  // ─── CRUD: Stock Carburant ────────────────────────────────────────
  function openCreateStock() {
    setStockForm({ typeCarburant: 'GASOIL', capacite: '', seuilAlerte: '' })
    setStockDialogOpen(true)
  }

  async function handleCreateStock() {
    if (!stockForm.capacite || parseFloat(stockForm.capacite) <= 0) {
      toast.error('La capacité doit être positive')
      return
    }
    setFormSubmitting(true)
    try {
      const res = await fetch('/api/carburant/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: activeChantierId,
          typeCarburant: stockForm.typeCarburant,
          capacite: parseFloat(stockForm.capacite),
          seuilAlerte: parseFloat(stockForm.seuilAlerte) || 0,
        }),
      })
      if (res.ok) {
        toast.success('Stock carburant créé')
        setStockDialogOpen(false)
        fetchCarburantData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de la création")
      }
    } catch {
      toast.error("Erreur lors de la création")
    } finally {
      setFormSubmitting(false)
    }
  }

  // ─── CRUD: Entrées ────────────────────────────────────────────────
  async function handleCreateEntree() {
    if (!entreeForm.stockCarburantId) {
      toast.error('Veuillez sélectionner un stock')
      return
    }
    if (!entreeForm.quantite || parseFloat(entreeForm.quantite) <= 0) {
      toast.error('La quantité doit être positive')
      return
    }
    setFormSubmitting(true)
    try {
      const qte = parseFloat(entreeForm.quantite)
      const pu = parseFloat(entreeForm.prixUnitaire) || 0
      const res = await fetch('/api/carburant/entrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: activeChantierId,
          stockCarburantId: entreeForm.stockCarburantId,
          dateEntree: entreeForm.dateEntree,
          quantite: qte,
          prixUnitaire: pu,
          prixTotal: qte * pu,
          fournisseur: entreeForm.fournisseur.trim() || null,
          numeroBL: entreeForm.numeroBL.trim() || null,
          observation: entreeForm.observation.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Entrée enregistrée')
        setEntreeForm({
          stockCarburantId: '',
          dateEntree: format(new Date(), 'yyyy-MM-dd'),
          quantite: '',
          prixUnitaire: '',
          fournisseur: '',
          numeroBL: '',
          observation: '',
        })
        fetchCarburantData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDeleteEntree(id: string) {
    try {
      const res = await fetch(`/api/carburant/entrees/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Entrée supprimée')
        fetchCarburantData()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── CRUD: Sorties ────────────────────────────────────────────────
  async function handleCreateSortie() {
    if (!sortieForm.stockCarburantId) {
      toast.error('Veuillez sélectionner un stock')
      return
    }
    if (!sortieForm.quantite || parseFloat(sortieForm.quantite) <= 0) {
      toast.error('La quantité doit être positive')
      return
    }
    setFormSubmitting(true)
    try {
      const res = await fetch('/api/carburant/sorties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: activeChantierId,
          stockCarburantId: sortieForm.stockCarburantId,
          enginId: sortieForm.enginId || null,
          dateSortie: sortieForm.dateSortie,
          quantite: parseFloat(sortieForm.quantite),
          operateur: sortieForm.operateur.trim() || null,
          compteurAvant: sortieForm.compteurAvant
            ? parseFloat(sortieForm.compteurAvant)
            : null,
          compteurApres: sortieForm.compteurApres
            ? parseFloat(sortieForm.compteurApres)
            : null,
          observation: sortieForm.observation.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Sortie enregistrée')
        setSortieForm({
          stockCarburantId: '',
          enginId: '',
          dateSortie: format(new Date(), 'yyyy-MM-dd'),
          quantite: '',
          operateur: '',
          compteurAvant: '',
          compteurApres: '',
          observation: '',
        })
        fetchCarburantData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDeleteSortie(id: string) {
    try {
      const res = await fetch(`/api/carburant/sorties/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Sortie supprimée')
        fetchCarburantData()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── CRUD: Achats Station ─────────────────────────────────────────
  async function handleCreateAchat() {
    if (!achatForm.quantite || parseFloat(achatForm.quantite) <= 0) {
      toast.error('La quantité doit être positive')
      return
    }
    setFormSubmitting(true)
    try {
      const qte = parseFloat(achatForm.quantite)
      const pu = parseFloat(achatForm.prixUnitaire) || 0
      const res = await fetch('/api/carburant/achats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: activeChantierId,
          dateAchat: achatForm.dateAchat,
          typeCarburant: achatForm.typeCarburant,
          quantite: qte,
          prixUnitaire: pu,
          prixTotal: qte * pu,
          stationService: achatForm.stationService.trim() || null,
          numeroRecu: achatForm.numeroRecu.trim() || null,
          enginId: achatForm.enginId || null,
          operateur: achatForm.operateur.trim() || null,
          compteurAvant: achatForm.compteurAvant
            ? parseFloat(achatForm.compteurAvant)
            : null,
          compteurApres: achatForm.compteurApres
            ? parseFloat(achatForm.compteurApres)
            : null,
          observation: achatForm.observation.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Achat enregistré')
        setAchatForm({
          dateAchat: format(new Date(), 'yyyy-MM-dd'),
          typeCarburant: 'GASOIL',
          quantite: '',
          prixUnitaire: '',
          stationService: '',
          numeroRecu: '',
          enginId: '',
          operateur: '',
          compteurAvant: '',
          compteurApres: '',
          observation: '',
        })
        fetchCarburantData()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDeleteAchat(id: string) {
    try {
      const res = await fetch(`/api/carburant/achats/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Achat supprimé')
        fetchCarburantData()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── CRUD: Relevés ────────────────────────────────────────────────
  async function handleCreateReleve() {
    if (!releveForm.enginId) {
      toast.error("Veuillez sélectionner un engin")
      return
    }
    if (!releveForm.heuresKm || parseFloat(releveForm.heuresKm) < 0) {
      toast.error("Les heures/km doivent être positifs")
      return
    }
    setFormSubmitting(true)
    try {
      const res = await fetch('/api/carburant/releves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: activeChantierId,
          enginId: releveForm.enginId,
          dateReleve: releveForm.dateReleve,
          heuresKm: parseFloat(releveForm.heuresKm),
          observation: releveForm.observation.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success('Relevé enregistré')
        setReleveForm({
          enginId: '',
          dateReleve: format(new Date(), 'yyyy-MM-dd'),
          heuresKm: '',
          observation: '',
        })
        fetchCarburantData()
        fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleDeleteReleve(id: string) {
    try {
      const res = await fetch(`/api/carburant/releves/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Relevé supprimé')
        fetchCarburantData()
        fetchStats()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── Delete confirmation ──────────────────────────────────────────
  function confirmDelete(id: string, label: string, type: string) {
    setDeletingInfo({ id, label, type })
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deletingInfo) return
    setFormSubmitting(true)
    try {
      let res: Response
      switch (deletingInfo.type) {
        case 'entree':
          res = await fetch(`/api/carburant/entrees/${deletingInfo.id}`, {
            method: 'DELETE',
          })
          break
        case 'sortie':
          res = await fetch(`/api/carburant/sorties/${deletingInfo.id}`, {
            method: 'DELETE',
          })
          break
        case 'achat':
          res = await fetch(`/api/carburant/achats/${deletingInfo.id}`, {
            method: 'DELETE',
          })
          break
        case 'releve':
          res = await fetch(`/api/carburant/releves/${deletingInfo.id}`, {
            method: 'DELETE',
          })
          break
        case 'stock':
          res = await fetch(`/api/carburant/stock/${deletingInfo.id}`, {
            method: 'DELETE',
          })
          break
        default:
          setFormSubmitting(false)
          return
      }
      if (res.ok) {
        toast.success(`${deletingInfo.label} supprimé(e)`)
        setDeleteDialogOpen(false)
        setDeletingInfo(null)
        fetchCarburantData()
        fetchStats()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setFormSubmitting(false)
    }
  }

  // ─── Toggle mode carburant ──────────────────────────────────────
  async function handleChangeMode(newMode: string) {
    if (!activeChantierId || changingMode) return
    setChangingMode(true)
    try {
      const res = await fetch(`/api/chantiers/${activeChantierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modeCarburant: newMode }),
      })
      if (res.ok) {
        setModeCarburant(newMode)
        toast.success(
          newMode === 'STOCK_PHYSIQUE'
            ? 'Mode changé : Stock physique'
            : 'Mode changé : Achat direct'
        )
      } else {
        toast.error('Erreur lors du changement de mode')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setChangingMode(false)
    }
  }

  // ─── Computed values ──────────────────────────────────────────────
  const entreePrixTotal =
    (parseFloat(entreeForm.quantite) || 0) *
    (parseFloat(entreeForm.prixUnitaire) || 0)

  const achatPrixTotal =
    (parseFloat(achatForm.quantite) || 0) *
    (parseFloat(achatForm.prixUnitaire) || 0)

  const alertStocks = stocks.filter((s) => getStockStatus(s) !== 'ok')

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Fuel className="w-6 h-6 text-amber-500" />
            Carburant
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            Gestion du carburant et suivi de consommation
          </p>
        </div>
        {modeCarburant === 'STOCK_PHYSIQUE' && (
          <Button
            onClick={openCreateStock}
            disabled={!activeChantierId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un stock
          </Button>
        )}
      </div>

      {/* Chantier selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Label className="text-[15px] font-medium whitespace-nowrap">
              <Warehouse className="w-4 h-4 inline mr-1.5 text-amber-500" />
              Chantier :
            </Label>
            <Select
              value={activeChantierId}
              onValueChange={(v) => {
                setActiveChantierId(v)
                setStocks([])
                setEntrees([])
                setSorties([])
                setAchats([])
                setReleves([])
                setConsoParEngin([])
              }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Sélectionner un chantier..." />
              </SelectTrigger>
              <SelectContent>
                {chantiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeChantierId && (
              <>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium',
                    modeCarburant === 'STOCK_PHYSIQUE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40'
                  )}
                >
                  {modeCarburant === 'STOCK_PHYSIQUE' ? (
                    <>
                      <Gauge className="w-3 h-3 mr-1" />
                      Stock physique
                    </>
                  ) : (
                    <>
                      <ReceiptText className="w-3 h-3 mr-1" />
                      Achat direct
                    </>
                  )}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground hover:text-amber-600"
                  onClick={() => handleChangeMode(modeCarburant === 'STOCK_PHYSIQUE' ? 'ACHAT_DIRECT' : 'STOCK_PHYSIQUE')}
                  disabled={changingMode}
                  title="Changer le mode de gestion carburant"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', changingMode && 'animate-spin')} />
                  <span className="text-xs hidden sm:inline">Changer mode</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty state — no chantier selected */}
      {!activeChantierId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Fuel className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-[15px]">
              Sélectionnez un chantier pour gérer le carburant
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : (
        <>
          {/* ACHAT_DIRECT info banner */}
          {modeCarburant === 'ACHAT_DIRECT' && (
            <Card className="border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <ReceiptText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-amber-800 dark:text-amber-300">
                    Achat direct en station-service
                  </p>
                  <p className="text-sm text-amber-700/70 dark:text-amber-400/70">
                    Ce chantier fonctionne en achat direct en station-service.
                    Enregistrez vos achats dans l&apos;onglet &quot;Achats
                    Station&quot;.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Stock disponible */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Droplets className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Stock disponible
                    </p>
                    {modeCarburant === 'STOCK_PHYSIQUE' ? (
                      <p className="text-2xl font-bold truncate">
                        {fmtN(kpi.stockDisponible)} L
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">
                        Achat direct
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* KPI 2: Coût carburant (mois) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <CircleDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Coût carburant (mois)
                    </p>
                    <p className="text-2xl font-bold truncate">
                      {fmtFCFA(kpi.coutMois)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* KPI 3: Litres consommés (mois) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Litres consommés (mois)
                    </p>
                    <p className="text-2xl font-bold truncate">
                      {fmtN(kpi.litresConsommes)} L
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* KPI 4: Prix moyen / litre */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Prix moyen / litre
                    </p>
                    <p className="text-2xl font-bold truncate">
                      {kpi.prixMoyenLitre > 0
                        ? fmtFCFA(kpi.prixMoyenLitre)
                        : '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Alerts banner */}
          <AnimatePresence>
            {modeCarburant === 'STOCK_PHYSIQUE' && alertStocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-[15px] font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Alertes de stock carburant ({alertStocks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {alertStocks.map((s) => (
                        <Badge
                          key={s.id}
                          variant="outline"
                          className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20"
                        >
                          {s.typeCarburant} — {fmtN(s.quantiteDisponible)} L
                          (seuil: {fmtN(s.seuilAlerte)})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Tabs ────────────────────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className={cn(
                'grid',
                modeCarburant === 'STOCK_PHYSIQUE'
                  ? 'grid-cols-3'
                  : 'grid-cols-2'
              )}
            >
              {modeCarburant === 'STOCK_PHYSIQUE' && (
                <TabsTrigger
                  value="stock"
                  className="text-sm sm:text-[15px]"
                >
                  <Droplets className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                  Stock Carburant
                </TabsTrigger>
              )}
              {modeCarburant === 'ACHAT_DIRECT' && (
                <TabsTrigger
                  value="achats"
                  className="text-sm sm:text-[15px]"
                >
                  <ReceiptText className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                  Achats Station
                </TabsTrigger>
              )}
              <TabsTrigger
                value="consommation"
                className="text-sm sm:text-[15px]"
              >
                <Gauge className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                Consommation & Compteurs
              </TabsTrigger>
            </TabsList>

            {/* ─── Tab: Stock Carburant (STOCK_PHYSIQUE only) ──────── */}
            {modeCarburant === 'STOCK_PHYSIQUE' && (
              <TabsContent value="stock" className="space-y-6 mt-4">
                {/* Stock tanks table */}
                {stocks.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                      <Droplets className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground text-[15px]">
                        Aucun stock carburant défini
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openCreateStock}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Ajouter un stock
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-sm">Type</TableHead>
                              <TableHead className="text-sm text-right hidden sm:table-cell">
                                Capacité
                              </TableHead>
                              <TableHead className="text-sm text-right">
                                Stock dispo.
                              </TableHead>
                              <TableHead className="text-sm text-right hidden md:table-cell">
                                Seuil alerte
                              </TableHead>
                              <TableHead className="text-sm text-center">
                                Statut
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stocks.map((item) => (
                              <motion.tr
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="border-b transition-colors hover:bg-muted/50"
                              >
                                <TableCell className="text-[15px] font-medium">
                                  <div className="flex items-center gap-2">
                                    <Fuel
                                      className={cn(
                                        'w-4 h-4',
                                        item.typeCarburant === 'GASOIL'
                                          ? 'text-amber-600'
                                          : 'text-red-500'
                                      )}
                                    />
                                    {item.typeCarburant}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-right hidden sm:table-cell">
                                  {fmtN(item.capacite)} L
                                </TableCell>
                                <TableCell className="text-[15px] font-semibold text-right">
                                  {fmtN(item.quantiteDisponible)} L
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground text-right hidden md:table-cell">
                                  {fmtN(item.seuilAlerte)} L
                                </TableCell>
                                <TableCell className="text-center">
                                  <StockStatusBadge item={item} />
                                </TableCell>
                              </motion.tr>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {/* Entrées (Réapprovisionnement) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold">
                      Entrées (Réapprovisionnement)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Entrée form */}
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                          <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                          Nouvelle entrée
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-sm">Stock *</Label>
                          <Select
                            value={entreeForm.stockCarburantId}
                            onValueChange={(v) =>
                              setEntreeForm((prev) => ({
                                ...prev,
                                stockCarburantId: v,
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {stocks.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.typeCarburant} ({fmtN(s.quantiteDisponible)}{' '}
                                  L)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm">Date</Label>
                          <Input
                            type="date"
                            className="mt-1"
                            value={entreeForm.dateEntree}
                            onChange={(e) =>
                              setEntreeForm((prev) => ({
                                ...prev,
                                dateEntree: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">Quantité (L) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              className="mt-1"
                              value={entreeForm.quantite}
                              onChange={(e) =>
                                setEntreeForm((prev) => ({
                                  ...prev,
                                  quantite: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-sm">
                              Prix unitaire (FCFA/L)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              className="mt-1"
                              value={entreeForm.prixUnitaire}
                              onChange={(e) =>
                                setEntreeForm((prev) => ({
                                  ...prev,
                                  prixUnitaire: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        {entreePrixTotal > 0 && (
                          <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-sm">
                            <span className="text-muted-foreground">
                              Prix total :{' '}
                            </span>
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              {fmtFCFA(entreePrixTotal)}
                            </span>
                          </div>
                        )}

                        <div>
                          <Label className="text-sm">Fournisseur</Label>
                          <Input
                            placeholder="Nom du fournisseur"
                            className="mt-1"
                            value={entreeForm.fournisseur}
                            onChange={(e) =>
                              setEntreeForm((prev) => ({
                                ...prev,
                                fournisseur: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <Label className="text-sm">N° BL</Label>
                          <Input
                            placeholder="Numéro bon de livraison"
                            className="mt-1"
                            value={entreeForm.numeroBL}
                            onChange={(e) =>
                              setEntreeForm((prev) => ({
                                ...prev,
                                numeroBL: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <Label className="text-sm">Observation</Label>
                          <Textarea
                            placeholder="Observation..."
                            className="mt-1"
                            rows={2}
                            value={entreeForm.observation}
                            onChange={(e) =>
                              setEntreeForm((prev) => ({
                                ...prev,
                                observation: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <Button
                          onClick={handleCreateEntree}
                          disabled={formSubmitting}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {formSubmitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Enregistrer l&apos;entrée
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Entrées table */}
                    <Card className="lg:col-span-2">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                          {entrees.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                              <ArrowDownToLine className="w-10 h-10 text-muted-foreground/30" />
                              <p className="text-muted-foreground text-sm">
                                Aucune entrée enregistrée
                              </p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-sm">Date</TableHead>
                                  <TableHead className="text-sm">Stock</TableHead>
                                  <TableHead className="text-sm text-right">
                                    Quantité
                                  </TableHead>
                                  <TableHead className="text-sm text-right hidden sm:table-cell">
                                    Prix total
                                  </TableHead>
                                  <TableHead className="text-sm hidden md:table-cell">
                                    Fournisseur
                                  </TableHead>
                                  <TableHead className="text-sm hidden lg:table-cell">
                                    BL
                                  </TableHead>
                                  <TableHead className="text-sm text-right">
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {entrees.map((e) => (
                                  <TableRow key={e.id}>
                                    <TableCell className="text-sm">
                                      {fmtDate(e.dateEntree)}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                      {e.stockCarburant?.typeCarburant || '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-right font-semibold">
                                      {fmtN(e.quantite)} L
                                    </TableCell>
                                    <TableCell className="text-sm text-right hidden sm:table-cell">
                                      {fmtFCFA(e.prixTotal)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                      {e.fournisseur || '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                                      {e.numeroBL || '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-500 hover:text-red-700"
                                        onClick={() =>
                                          confirmDelete(
                                            e.id,
                                            'Entrée du ' + fmtDate(e.dateEntree),
                                            'entree'
                                          )
                                        }
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Sorties (Distribution) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpFromLine className="w-5 h-5 text-red-500" />
                    <h3 className="text-lg font-semibold">
                      Sorties (Distribution)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sortie form */}
                    <Card className="lg:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                          <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                          Nouvelle sortie
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-sm">Stock *</Label>
                          <Select
                            value={sortieForm.stockCarburantId}
                            onValueChange={(v) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                stockCarburantId: v,
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {stocks.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.typeCarburant} ({fmtN(s.quantiteDisponible)}{' '}
                                  L)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm">Engin</Label>
                          <Select
                            value={sortieForm.enginId}
                            onValueChange={(v) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                enginId: v,
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              {engins.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.designation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm">Date</Label>
                          <Input
                            type="date"
                            className="mt-1"
                            value={sortieForm.dateSortie}
                            onChange={(e) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                dateSortie: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <Label className="text-sm">Quantité (L) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className="mt-1"
                            value={sortieForm.quantite}
                            onChange={(e) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                quantite: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div>
                          <Label className="text-sm">Opérateur</Label>
                          <Input
                            placeholder="Nom de l'opérateur"
                            className="mt-1"
                            value={sortieForm.operateur}
                            onChange={(e) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                operateur: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">Compteur avant (h)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              className="mt-1"
                              value={sortieForm.compteurAvant}
                              onChange={(e) =>
                                setSortieForm((prev) => ({
                                  ...prev,
                                  compteurAvant: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Compteur après (h)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              className="mt-1"
                              value={sortieForm.compteurApres}
                              onChange={(e) =>
                                setSortieForm((prev) => ({
                                  ...prev,
                                  compteurApres: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">Observation</Label>
                          <Textarea
                            placeholder="Observation..."
                            className="mt-1"
                            rows={2}
                            value={sortieForm.observation}
                            onChange={(e) =>
                              setSortieForm((prev) => ({
                                ...prev,
                                observation: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <Button
                          onClick={handleCreateSortie}
                          disabled={formSubmitting}
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          {formSubmitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Enregistrer la sortie
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Sorties table */}
                    <Card className="lg:col-span-2">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                          {sorties.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                              <ArrowUpFromLine className="w-10 h-10 text-muted-foreground/30" />
                              <p className="text-muted-foreground text-sm">
                                Aucune sortie enregistrée
                              </p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-sm">Date</TableHead>
                                  <TableHead className="text-sm">Engin</TableHead>
                                  <TableHead className="text-sm text-right">
                                    Quantité
                                  </TableHead>
                                  <TableHead className="text-sm hidden sm:table-cell">
                                    Opérateur
                                  </TableHead>
                                  <TableHead className="text-sm hidden md:table-cell">
                                    Compteur
                                  </TableHead>
                                  <TableHead className="text-sm text-right">
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sorties.map((s) => (
                                  <TableRow key={s.id}>
                                    <TableCell className="text-sm">
                                      {fmtDate(s.dateSortie)}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                      {s.engin?.designation || '—'}
                                    </TableCell>
                                    <TableCell className="text-sm text-right font-semibold">
                                      {fmtN(s.quantite)} L
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                      {s.operateur || '—'}
                                    </TableCell>
                                    <TableCell className="text-sm hidden md:table-cell">
                                      {s.compteurAvant !== null &&
                                      s.compteurApres !== null ? (
                                        <span>
                                          {fmtN(s.compteurAvant)} →{' '}
                                          {fmtN(s.compteurApres)} h
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-500 hover:text-red-700"
                                        onClick={() =>
                                          confirmDelete(
                                            s.id,
                                            'Sortie du ' + fmtDate(s.dateSortie),
                                            'sortie'
                                          )
                                        }
                                        title="Supprimer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ─── Tab: Achats Station (ACHAT_DIRECT only) ─────────── */}
            {modeCarburant === 'ACHAT_DIRECT' && (
              <TabsContent value="achats" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Achat form */}
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                        <ReceiptText className="w-4 h-4 text-amber-600" />
                        Nouvel achat station
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm">Date</Label>
                        <Input
                          type="date"
                          className="mt-1"
                          value={achatForm.dateAchat}
                          onChange={(e) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              dateAchat: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Type carburant *</Label>
                        <Select
                          value={achatForm.typeCarburant}
                          onValueChange={(v) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              typeCarburant: v,
                            }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPES_CARBURANT.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Quantité (L) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className="mt-1"
                            value={achatForm.quantite}
                            onChange={(e) =>
                              setAchatForm((prev) => ({
                                ...prev,
                                quantite: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm">
                            Prix unitaire (FCFA/L)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className="mt-1"
                            value={achatForm.prixUnitaire}
                            onChange={(e) =>
                              setAchatForm((prev) => ({
                                ...prev,
                                prixUnitaire: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {achatPrixTotal > 0 && (
                        <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-sm">
                          <span className="text-muted-foreground">
                            Prix total :{' '}
                          </span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {fmtFCFA(achatPrixTotal)}
                          </span>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm">Station service</Label>
                        <Input
                          placeholder="Nom de la station"
                          className="mt-1"
                          value={achatForm.stationService}
                          onChange={(e) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              stationService: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-sm">N° Reçu</Label>
                        <Input
                          placeholder="Numéro du reçu"
                          className="mt-1"
                          value={achatForm.numeroRecu}
                          onChange={(e) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              numeroRecu: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Engin</Label>
                        <Select
                          value={achatForm.enginId}
                          onValueChange={(v) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              enginId: v,
                            }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {engins.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.designation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">Opérateur</Label>
                        <Input
                          placeholder="Nom de l'opérateur"
                          className="mt-1"
                          value={achatForm.operateur}
                          onChange={(e) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              operateur: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Compteur avant (h)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className="mt-1"
                            value={achatForm.compteurAvant}
                            onChange={(e) =>
                              setAchatForm((prev) => ({
                                ...prev,
                                compteurAvant: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Compteur après (h)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            className="mt-1"
                            value={achatForm.compteurApres}
                            onChange={(e) =>
                              setAchatForm((prev) => ({
                                ...prev,
                                compteurApres: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">Observation</Label>
                        <Textarea
                          placeholder="Observation..."
                          className="mt-1"
                          rows={2}
                          value={achatForm.observation}
                          onChange={(e) =>
                            setAchatForm((prev) => ({
                              ...prev,
                              observation: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <Button
                        onClick={handleCreateAchat}
                        disabled={formSubmitting}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {formSubmitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Enregistrer l&apos;achat
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Achats table */}
                  <Card className="lg:col-span-2">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        {achats.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <ReceiptText className="w-10 h-10 text-muted-foreground/30" />
                            <p className="text-muted-foreground text-sm">
                              Aucun achat enregistré
                            </p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">Date</TableHead>
                                <TableHead className="text-sm">Type</TableHead>
                                <TableHead className="text-sm text-right">
                                  Quantité
                                </TableHead>
                                <TableHead className="text-sm text-right hidden sm:table-cell">
                                  Prix total
                                </TableHead>
                                <TableHead className="text-sm hidden md:table-cell">
                                  Station
                                </TableHead>
                                <TableHead className="text-sm hidden lg:table-cell">
                                  Engin
                                </TableHead>
                                <TableHead className="text-sm hidden xl:table-cell">
                                  Opérateur
                                </TableHead>
                                <TableHead className="text-sm hidden xl:table-cell">
                                  N° Reçu
                                </TableHead>
                                <TableHead className="text-sm text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {achats.map((a) => (
                                <TableRow key={a.id}>
                                  <TableCell className="text-sm">
                                    {fmtDate(a.dateAchat)}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <Fuel
                                        className={cn(
                                          'w-3.5 h-3.5',
                                          a.typeCarburant === 'GASOIL'
                                            ? 'text-amber-600'
                                            : 'text-red-500'
                                        )}
                                      />
                                      {a.typeCarburant}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-right font-semibold">
                                    {fmtN(a.quantite)} L
                                  </TableCell>
                                  <TableCell className="text-sm text-right hidden sm:table-cell">
                                    {fmtFCFA(a.prixTotal)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                    {a.stationService || '—'}
                                  </TableCell>
                                  <TableCell className="text-sm hidden lg:table-cell">
                                    {a.engin?.designation || '—'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground hidden xl:table-cell">
                                    {a.operateur || '—'}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground hidden xl:table-cell">
                                    {a.numeroRecu || '—'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-red-500 hover:text-red-700"
                                      onClick={() =>
                                        confirmDelete(
                                          a.id,
                                          'Achat du ' + fmtDate(a.dateAchat),
                                          'achat'
                                        )
                                      }
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* ─── Tab: Consommation & Compteurs ───────────────────── */}
            <TabsContent value="consommation" className="space-y-6 mt-4">
              {/* Rélevés compteur */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-violet-600" />
                  <h3 className="text-lg font-semibold">
                    Relevés compteur
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Relevé form */}
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-violet-600" />
                        Nouveau relevé
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm">Engin *</Label>
                        <Select
                          value={releveForm.enginId}
                          onValueChange={(v) =>
                            setReleveForm((prev) => ({
                              ...prev,
                              enginId: v,
                            }))
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {engins.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.designation}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">Date</Label>
                        <Input
                          type="date"
                          className="mt-1"
                          value={releveForm.dateReleve}
                          onChange={(e) =>
                            setReleveForm((prev) => ({
                              ...prev,
                              dateReleve: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Heures / Km *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          className="mt-1"
                          value={releveForm.heuresKm}
                          onChange={(e) =>
                            setReleveForm((prev) => ({
                              ...prev,
                              heuresKm: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-sm">Observation</Label>
                        <Textarea
                          placeholder="Observation..."
                          className="mt-1"
                          rows={2}
                          value={releveForm.observation}
                          onChange={(e) =>
                            setReleveForm((prev) => ({
                              ...prev,
                              observation: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <Button
                        onClick={handleCreateReleve}
                        disabled={formSubmitting}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        {formSubmitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Enregistrer le relevé
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Relevés table */}
                  <Card className="lg:col-span-2">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        {releves.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Gauge className="w-10 h-10 text-muted-foreground/30" />
                            <p className="text-muted-foreground text-sm">
                              Aucun relevé enregistré
                            </p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-sm">Date</TableHead>
                                <TableHead className="text-sm">Engin</TableHead>
                                <TableHead className="text-sm text-right">
                                  Heures/Km
                                </TableHead>
                                <TableHead className="text-sm hidden md:table-cell">
                                  Observation
                                </TableHead>
                                <TableHead className="text-sm text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {releves.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="text-sm">
                                    {fmtDate(r.dateReleve)}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                                      {r.engin?.designation || '—'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-right font-semibold">
                                    {fmtN(r.heuresKm)}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                                    {r.observation || '—'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-red-500 hover:text-red-700"
                                      onClick={() =>
                                        confirmDelete(
                                          r.id,
                                          'Relevé du ' + fmtDate(r.dateReleve),
                                          'releve'
                                        )
                                      }
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Résumé consommation par engin */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold">
                    Résumé consommation par engin
                  </h3>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      {consoParEngin.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
                          <p className="text-muted-foreground text-sm">
                            Aucune donnée de consommation disponible
                          </p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-sm">Engin</TableHead>
                              <TableHead className="text-sm text-right">
                                Litres consommés
                              </TableHead>
                              <TableHead className="text-sm text-right hidden sm:table-cell">
                                Heures fonct.
                              </TableHead>
                              <TableHead className="text-sm text-right hidden md:table-cell">
                                L/h
                              </TableHead>
                              <TableHead className="text-sm text-right">
                                Coût total
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {consoParEngin.map((c) => (
                              <TableRow key={c.enginId}>
                                <TableCell className="text-[15px] font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="w-4 h-4 text-amber-500" />
                                    {c.enginDesignation}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-right font-semibold">
                                  {fmtN(c.litresConsommes)} L
                                </TableCell>
                                <TableCell className="text-sm text-right hidden sm:table-cell">
                                  {fmtN(c.heuresFonctionnement)} h
                                </TableCell>
                                <TableCell className="text-sm text-right hidden md:table-cell">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'font-mono',
                                      c.litresParHeure > 15
                                        ? 'bg-red-50 text-red-600 border-red-200'
                                        : c.litresParHeure > 8
                                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    )}
                                  >
                                    {fmtN(c.litresParHeure)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-right font-semibold">
                                  {fmtFCFA(c.coutTotal)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Totals row */}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell className="text-sm">Total</TableCell>
                              <TableCell className="text-sm text-right">
                                {fmtN(
                                  consoParEngin.reduce(
                                    (s, c) => s + c.litresConsommes,
                                    0
                                  )
                                )}{' '}
                                L
                              </TableCell>
                              <TableCell className="text-sm text-right hidden sm:table-cell">
                                {fmtN(
                                  consoParEngin.reduce(
                                    (s, c) => s + c.heuresFonctionnement,
                                    0
                                  )
                                )}{' '}
                                h
                              </TableCell>
                              <TableCell className="text-sm text-right hidden md:table-cell">
                                <Badge variant="outline" className="font-mono">
                                  {fmtN(
                                    consoParEngin.reduce(
                                      (s, c) => s + c.litresConsommes,
                                      0
                                    ) /
                                      Math.max(
                                        1,
                                        consoParEngin.reduce(
                                          (s, c) => s + c.heuresFonctionnement,
                                          0
                                        )
                                      )
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {fmtFCFA(
                                  consoParEngin.reduce(
                                    (s, c) => s + c.coutTotal,
                                    0
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── Dialog: Create Stock ───────────────────────────────────── */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-amber-500" />
              Ajouter un stock carburant
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau stock de carburant pour ce chantier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Type de carburant *</Label>
              <Select
                value={stockForm.typeCarburant}
                onValueChange={(v) =>
                  setStockForm((prev) => ({ ...prev, typeCarburant: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_CARBURANT.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Capacité (L) *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Capacité totale du stock"
                className="mt-1"
                value={stockForm.capacite}
                onChange={(e) =>
                  setStockForm((prev) => ({ ...prev, capacite: e.target.value }))
                }
              />
            </div>

            <div>
              <Label className="text-sm">Seuil d&apos;alerte (L)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                className="mt-1"
                value={stockForm.seuilAlerte}
                onChange={(e) =>
                  setStockForm((prev) => ({
                    ...prev,
                    seuilAlerte: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStockDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateStock}
              disabled={formSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {formSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── AlertDialog: Delete confirmation ──────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer{' '}
              <span className="font-semibold text-foreground">
                {deletingInfo?.label}
              </span>
              ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={formSubmitting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={formSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {formSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
