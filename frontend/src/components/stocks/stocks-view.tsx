'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Search,
  Filter,
  TrendingUp,
  Warehouse,
  X,
  CalendarDays,
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
import { useAppStore } from '@/store/app-store'

// ─── Types ───────────────────────────────────────────────────────────
interface Chantier {
  id: string
  nom: string
  statut: string
}

interface StockItem {
  id: string
  reference: string
  designation: string
  categorie: string | null
  unite: string
  seuilAlerte: number
  chantierId: string
  quantiteDisponible: number
  valeurStock: number
  avgPrix: number
  enAlerte: boolean
  _count: { entrees: number; sorties: number }
  createdAt: string
  updatedAt: string
}

interface EntreeItem {
  id: string
  stockId: string
  chantierId: string
  quantite: number
  prixUnitaire: number
  fournisseur: string | null
  numeroBL: string | null
  dateEntree: string
  stock: { id: string; reference: string; designation: string; unite: string }
}

interface SortieItem {
  id: string
  stockId: string
  chantierId: string
  quantite: number
  tacheId: string | null
  operateur: string | null
  motif: string | null
  dateSortie: string
  stock: { id: string; reference: string; designation: string; unite: string }
  tache: { id: string; nom: string } | null
}

interface StockKpi {
  totalMateriaux: number
  valeurTotale: number
  articlesEnAlerte: number
}

interface Tache {
  id: string
  nom: string
}

// ─── Constants ───────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'gros_oeuvre', label: 'Gros œuvre' },
  { value: 'finition', label: 'Finition' },
  { value: 'electricite', label: 'Électricité' },
  { value: 'plomberie', label: 'Plomberie' },
  { value: 'divers', label: 'Divers' },
]

const UNITES = [
  'm3', 'kg', 'sac', 'ml', 'u', 'm2', 'litre', 'lot', 'rouleau',
]

const CATEGORIE_LABELS: Record<string, string> = {
  gros_oeuvre: 'Gros œuvre',
  finition: 'Finition',
  electricite: 'Électricité',
  plomberie: 'Plomberie',
  divers: 'Divers',
}

const frFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function fmtN(n: number) {
  return frFmt.format(n)
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' FCFA'
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd MMM yyyy', { locale: fr })
}

// ─── Component ───────────────────────────────────────────────────────
export function StocksView() {
  const { selectedChantierId } = useAppStore()

  // State
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [activeChantierId, setActiveChantierId] = useState<string>('')
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [entrees, setEntrees] = useState<EntreeItem[]>([])
  const [sorties, setSorties] = useState<SortieItem[]>([])
  const [taches, setTaches] = useState<Tache[]>([])
  const [kpi, setKpi] = useState<StockKpi>({
    totalMateriaux: 0,
    valeurTotale: 0,
    articlesEnAlerte: 0,
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('inventaire')
  const [categorieFilter, setCategorieFilter] = useState('TOUS')
  const [searchQuery, setSearchQuery] = useState('')
  const [stockIdFilter, setStockIdFilter] = useState('TOUS')

  // Dialog states
  const [materielDialogOpen, setMaterielDialogOpen] = useState(false)
  const [editingMateriel, setEditingMateriel] = useState<StockItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null)

  // Form states
  const [form, setForm] = useState({
    reference: '',
    designation: '',
    categorie: '',
    unite: 'u',
    seuilAlerte: '0',
  })
  const [entreeForm, setEntreeForm] = useState({
    stockId: '',
    quantite: '',
    prixUnitaire: '',
    fournisseur: '',
    numeroBL: '',
    dateEntree: format(new Date(), 'yyyy-MM-dd'),
  })
  const [sortieForm, setSortieForm] = useState({
    stockId: '',
    quantite: '',
    tacheId: '',
    operateur: '',
    motif: '',
    dateSortie: format(new Date(), 'yyyy-MM-dd'),
  })
  const [formSubmitting, setFormSubmitting] = useState(false)

  // ─── Fetch chantiers ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchChantiers() {
      try {
        const res = await fetch('/api/v1/chantiers')
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

  // Auto-select chantier from global store
  useEffect(() => {
    if (selectedChantierId && !activeChantierId) {
      setActiveChantierId(selectedChantierId)
    }
  }, [selectedChantierId, activeChantierId])

  // ─── Fetch stocks ──────────────────────────────────────────────────
  const fetchStocks = useCallback(async () => {
    if (!activeChantierId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ chantierId: activeChantierId })
      if (categorieFilter !== 'TOUS') params.set('categorie', categorieFilter)
      const res = await fetch(`/api/v1/stocks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStocks(data.stocks || [])
        setKpi(data.kpi || { totalMateriaux: 0, valeurTotale: 0, articlesEnAlerte: 0 })
      }
    } catch {
      toast.error('Erreur lors du chargement des stocks')
    } finally {
      setLoading(false)
    }
  }, [activeChantierId, categorieFilter])

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  // ─── Fetch entrees ─────────────────────────────────────────────────
  const fetchEntrees = useCallback(async () => {
    if (!activeChantierId) return
    try {
      const params = new URLSearchParams({ chantierId: activeChantierId })
      if (stockIdFilter !== 'TOUS') params.set('stockId', stockIdFilter)
      const res = await fetch(`/api/v1/stocks/entrees?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntrees(data.entrees || [])
      }
    } catch {
      // silent
    }
  }, [activeChantierId, stockIdFilter])

  // ─── Fetch sorties ─────────────────────────────────────────────────
  const fetchSorties = useCallback(async () => {
    if (!activeChantierId) return
    try {
      const params = new URLSearchParams({ chantierId: activeChantierId })
      if (stockIdFilter !== 'TOUS') params.set('stockId', stockIdFilter)
      const res = await fetch(`/api/v1/stocks/sorties?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSorties(data.sorties || [])
      }
    } catch {
      // silent
    }
  }, [activeChantierId, stockIdFilter])

  // ─── Fetch taches for sortie form ──────────────────────────────────
  const fetchTaches = useCallback(async () => {
    if (!activeChantierId) return
    try {
      const res = await fetch(`/api/v1/chantiers/${activeChantierId}`)
      if (res.ok) {
        const data = await res.json()
        // Flatten tasks from phases
        const allTaches: Tache[] = []
        for (const phase of data.phases || []) {
          for (const t of phase.taches || []) {
            allTaches.push({ id: t.id, nom: t.nom })
          }
        }
        setTaches(allTaches)
      }
    } catch {
      // silent
    }
  }, [activeChantierId])

  useEffect(() => {
    if (activeTab === 'entrees') {
      fetchEntrees()
      fetchTaches()
    }
    if (activeTab === 'sorties') {
      fetchSorties()
      fetchTaches()
    }
  }, [activeTab, fetchEntrees, fetchSorties, fetchTaches])

  // ─── Filtered stocks for display ───────────────────────────────────
  const filteredStocks = stocks.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.designation.toLowerCase().includes(q) ||
      s.reference.toLowerCase().includes(q) ||
      (s.categorie || '').toLowerCase().includes(q)
    )
  })

  const alertStocks = stocks.filter((s) => s.enAlerte)

  // ─── Stock level color helper ──────────────────────────────────────
  function getStockLevel(item: StockItem) {
    if (item.quantiteDisponible <= item.seuilAlerte) return 'red'
    if (item.quantiteDisponible <= item.seuilAlerte * 2) return 'amber'
    return 'green'
  }

  function StockLevelBadge({ item }: { item: StockItem }) {
    const level = getStockLevel(item)
    const config = {
      red: {
        bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        dot: 'bg-red-500',
        label: 'Critique',
      },
      amber: {
        bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Faible',
      },
      green: {
        bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'OK',
      },
    }[level]
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    )
  }

  // ─── CRUD handlers ─────────────────────────────────────────────────

  // Create / Edit material
  function openCreateDialog() {
    setEditingMateriel(null)
    setForm({
      reference: '',
      designation: '',
      categorie: '',
      unite: 'u',
      seuilAlerte: '0',
    })
    setMaterielDialogOpen(true)
  }

  function openEditDialog(item: StockItem) {
    setEditingMateriel(item)
    setForm({
      reference: item.reference,
      designation: item.designation,
      categorie: item.categorie || '',
      unite: item.unite,
      seuilAlerte: String(item.seuilAlerte),
    })
    setMaterielDialogOpen(true)
  }

  async function handleSaveMateriel() {
    if (!form.designation.trim()) {
      toast.error('La désignation est requise')
      return
    }
    if (!form.unite.trim()) {
      toast.error("L'unité est requise")
      return
    }

    setFormSubmitting(true)
    try {
      const body = {
        chantierId: activeChantierId,
        reference: form.reference,
        designation: form.designation,
        categorie: form.categorie || null,
        unite: form.unite,
        seuilAlerte: parseFloat(form.seuilAlerte) || 0,
      }

      if (editingMateriel) {
        const res = await fetch(`/api/v1/stocks/${editingMateriel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          toast.success('Matériau mis à jour')
          setMaterielDialogOpen(false)
          fetchStocks()
        } else {
          const data = await res.json()
          toast.error(data.error || 'Erreur lors de la mise à jour')
        }
      } else {
        const res = await fetch('/api/v1/stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          toast.success('Matériau créé')
          setMaterielDialogOpen(false)
          fetchStocks()
        } else {
          const data = await res.json()
          toast.error(data.error || 'Erreur lors de la création')
        }
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete material
  function confirmDelete(item: StockItem) {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingItem) return
    setFormSubmitting(true)
    try {
      const res = await fetch(`/api/v1/stocks/${deletingItem.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Matériau supprimé')
        setDeleteDialogOpen(false)
        setDeletingItem(null)
        fetchStocks()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Create entree
  async function handleCreateEntree() {
    if (!entreeForm.stockId) {
      toast.error('Veuillez sélectionner un matériau')
      return
    }
    if (!entreeForm.quantite || parseFloat(entreeForm.quantite) <= 0) {
      toast.error('La quantité doit être positive')
      return
    }

    setFormSubmitting(true)
    try {
      const res = await fetch('/api/v1/stocks/entrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entreeForm,
          quantite: parseFloat(entreeForm.quantite),
          prixUnitaire: parseFloat(entreeForm.prixUnitaire) || 0,
          chantierId: activeChantierId,
        }),
      })
      if (res.ok) {
        toast.success('Entrée enregistrée')
        setEntreeForm({
          stockId: '',
          quantite: '',
          prixUnitaire: '',
          fournisseur: '',
          numeroBL: '',
          dateEntree: format(new Date(), 'yyyy-MM-dd'),
        })
        fetchStocks()
        fetchEntrees()
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

  // Create sortie
  async function handleCreateSortie() {
    if (!sortieForm.stockId) {
      toast.error('Veuillez sélectionner un matériau')
      return
    }
    if (!sortieForm.quantite || parseFloat(sortieForm.quantite) <= 0) {
      toast.error('La quantité doit être positive')
      return
    }

    setFormSubmitting(true)
    try {
      const res = await fetch('/api/v1/stocks/sorties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sortieForm,
          quantite: parseFloat(sortieForm.quantite),
          chantierId: activeChantierId,
        }),
      })
      if (res.ok) {
        toast.success('Sortie enregistrée')
        setSortieForm({
          stockId: '',
          quantite: '',
          tacheId: '',
          operateur: '',
          motif: '',
          dateSortie: format(new Date(), 'yyyy-MM-dd'),
        })
        fetchStocks()
        fetchSorties()
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

  // Delete entree
  async function handleDeleteEntree(id: string) {
    try {
      const res = await fetch(`/api/v1/stocks/entrees/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entrée supprimée')
        fetchStocks()
        fetchEntrees()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // Delete sortie
  async function handleDeleteSortie(id: string) {
    try {
      const res = await fetch(`/api/v1/stocks/sorties/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Sortie supprimée')
        fetchStocks()
        fetchSorties()
      } else {
        toast.error('Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" />
            Stocks
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            Gestion des matériaux et du stock
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          disabled={!activeChantierId}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un matériau
        </Button>
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
          </div>
        </CardContent>
      </Card>

      {!activeChantierId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Package className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-[15px]">
              Sélectionnez un chantier pour voir le stock
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total matériaux
                    </p>
                    <p className="text-2xl font-bold">{kpi.totalMateriaux}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Valeur totale du stock
                    </p>
                    <p className="text-2xl font-bold">
                      {fmtMoney(kpi.valeurTotale)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card
                className={
                  kpi.articlesEnAlerte > 0
                    ? 'border-red-200 dark:border-red-800/40'
                    : ''
                }
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`p-2.5 rounded-lg ${
                      kpi.articlesEnAlerte > 0
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-5 h-5 ${
                        kpi.articlesEnAlerte > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Articles en alerte
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        kpi.articlesEnAlerte > 0
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                      }`}
                    >
                      {kpi.articlesEnAlerte}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Alerts banner */}
          <AnimatePresence>
            {alertStocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-[15px] font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Alertes de stock ({alertStocks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {alertStocks.map((s) => (
                        <Badge
                          key={s.id}
                          variant="outline"
                          className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20 cursor-pointer hover:bg-red-200/50 dark:hover:bg-red-900/40"
                          onClick={() => {
                            setActiveTab('inventaire')
                            setSearchQuery(s.designation)
                          }}
                        >
                          {s.designation} — {fmtN(s.quantiteDisponible)}{' '}
                          {s.unite} (seuil: {fmtN(s.seuilAlerte)})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inventaire" className="text-sm sm:text-[15px]">
                <Package className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                Inventaire
              </TabsTrigger>
              <TabsTrigger value="entrees" className="text-sm sm:text-[15px]">
                <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                Entrées
              </TabsTrigger>
              <TabsTrigger value="sorties" className="text-sm sm:text-[15px]">
                <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" />
                Sorties
              </TabsTrigger>
            </TabsList>

            {/* ─── Tab 1: Inventaire ─────────────────────────────────── */}
            <TabsContent value="inventaire" className="space-y-4 mt-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par désignation, référence..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categorieFilter} onValueChange={setCategorieFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOUS">Toutes catégories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inventory table */}
              {filteredStocks.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                    <Package className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-[15px] text-center">
                      {searchQuery || categorieFilter !== 'TOUS'
                        ? 'Aucun matériau trouvé pour ces filtres'
                        : 'Aucun matériau enregistré sur ce chantier'}
                    </p>
                    {!searchQuery && categorieFilter === 'TOUS' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openCreateDialog}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Ajouter un matériau
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">Réf.</TableHead>
                          <TableHead className="text-sm">Désignation</TableHead>
                          <TableHead className="text-sm hidden md:table-cell">
                            Catégorie
                          </TableHead>
                          <TableHead className="text-sm hidden sm:table-cell">
                            Unité
                          </TableHead>
                          <TableHead className="text-sm text-right">
                            Stock dispo.
                          </TableHead>
                          <TableHead className="text-sm text-right hidden lg:table-cell">
                            Seuil
                          </TableHead>
                          <TableHead className="text-sm text-right hidden xl:table-cell">
                            Valeur
                          </TableHead>
                          <TableHead className="text-sm text-center">
                            Statut
                          </TableHead>
                          <TableHead className="text-sm text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStocks.map((item, idx) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="group border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell className="text-sm font-mono text-muted-foreground">
                              {item.reference || '—'}
                            </TableCell>
                            <TableCell className="text-[15px] font-medium">
                              {item.designation}
                            </TableCell>
                            <TableCell className="text-sm hidden md:table-cell">
                              {item.categorie
                                ? CATEGORIE_LABELS[item.categorie] || item.categorie
                                : '—'}
                            </TableCell>
                            <TableCell className="text-sm hidden sm:table-cell">
                              {item.unite}
                            </TableCell>
                            <TableCell className="text-[15px] font-semibold text-right">
                              {fmtN(item.quantiteDisponible)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground text-right hidden lg:table-cell">
                              {fmtN(item.seuilAlerte)}
                            </TableCell>
                            <TableCell className="text-sm text-right hidden xl:table-cell">
                              {fmtMoney(item.valeurStock)}
                            </TableCell>
                            <TableCell className="text-center">
                              <StockLevelBadge item={item} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setEntreeForm((prev) => ({
                                      ...prev,
                                      stockId: item.id,
                                    }))
                                    setActiveTab('entrees')
                                  }}
                                  title="Ajouter une entrée"
                                >
                                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditDialog(item)}
                                  title="Modifier"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => confirmDelete(item)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* ─── Tab 2: Entrées ─────────────────────────────────────── */}
            <TabsContent value="entrees" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Entry Form */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                      <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                      Nouvelle entrée (livraison)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm">Matériau *</Label>
                      <Select
                        value={entreeForm.stockId}
                        onValueChange={(v) =>
                          setEntreeForm((prev) => ({ ...prev, stockId: v }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stocks.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.reference
                                ? `[${s.reference}] `
                                : ''}
                              {s.designation} ({s.unite})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">Quantité *</Label>
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
                        <Label className="text-sm">Prix unitaire (FCFA)</Label>
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
                      <Label className="text-sm">N° Bon de livraison</Label>
                      <Input
                        placeholder="Numéro BL"
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

                    <Button
                      onClick={handleCreateEntree}
                      disabled={formSubmitting || !entreeForm.stockId}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <ArrowDownToLine className="w-4 h-4 mr-2" />
                      Enregistrer l&apos;entrée
                    </Button>
                  </CardContent>
                </Card>

                {/* Entries Table */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-[15px] font-medium">
                        Historique des entrées
                      </CardTitle>
                      <Select
                        value={stockIdFilter}
                        onValueChange={setStockIdFilter}
                      >
                        <SelectTrigger className="w-full sm:w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TOUS">Tous les matériaux</SelectItem>
                          {stocks.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.designation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {entrees.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <ArrowDownToLine className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-[15px] text-muted-foreground">
                          Aucune entrée enregistrée
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-sm">Date</TableHead>
                              <TableHead className="text-sm">Matériau</TableHead>
                              <TableHead className="text-sm text-right">
                                Qté
                              </TableHead>
                              <TableHead className="text-sm text-right hidden sm:table-cell">
                                Prix U.
                              </TableHead>
                              <TableHead className="text-sm hidden md:table-cell">
                                Fournisseur
                              </TableHead>
                              <TableHead className="text-sm hidden lg:table-cell">
                                N° BL
                              </TableHead>
                              <TableHead className="text-sm text-right">
                                <X className="w-3 h-3" />
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entrees.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {fmtDate(e.dateEntree)}
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {e.stock.designation}
                                </TableCell>
                                <TableCell className="text-sm text-right font-semibold">
                                  {fmtN(e.quantite)} {e.stock.unite}
                                </TableCell>
                                <TableCell className="text-sm text-right hidden sm:table-cell">
                                  {fmtMoney(e.prixUnitaire * e.quantite)}
                                </TableCell>
                                <TableCell className="text-sm hidden md:table-cell">
                                  {e.fournisseur || '—'}
                                </TableCell>
                                <TableCell className="text-sm font-mono hidden lg:table-cell">
                                  {e.numeroBL || '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500 hover:text-red-700"
                                    onClick={() => handleDeleteEntree(e.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ─── Tab 3: Sorties ─────────────────────────────────────── */}
            <TabsContent value="sorties" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sortie Form */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px] font-medium flex items-center gap-2">
                      <ArrowUpFromLine className="w-4 h-4 text-orange-600" />
                      Nouvelle sortie (consommation)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm">Matériau *</Label>
                      <Select
                        value={sortieForm.stockId}
                        onValueChange={(v) =>
                          setSortieForm((prev) => ({ ...prev, stockId: v }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stocks.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.reference
                                ? `[${s.reference}] `
                                : ''}
                              {s.designation} ({fmtN(s.quantiteDisponible)}{' '}
                              {s.unite})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Quantité *</Label>
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
                      {sortieForm.stockId && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Stock disponible :{' '}
                          <span className="font-medium">
                            {fmtN(
                              stocks.find((s) => s.id === sortieForm.stockId)
                                ?.quantiteDisponible || 0
                            )}{' '}
                            {
                              stocks.find((s) => s.id === sortieForm.stockId)
                                ?.unite || ''
                            }
                          </span>
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm">Tâche (optionnel)</Label>
                      <Select
                        value={sortieForm.tacheId}
                        onValueChange={(v) =>
                          setSortieForm((prev) => ({ ...prev, tacheId: v }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Aucune tâche" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune</SelectItem>
                          {taches.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nom}
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
                        value={sortieForm.operateur}
                        onChange={(e) =>
                          setSortieForm((prev) => ({
                            ...prev,
                            operateur: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Motif</Label>
                      <Textarea
                        placeholder="Raison de la sortie..."
                        className="mt-1 resize-none"
                        rows={2}
                        value={sortieForm.motif}
                        onChange={(e) =>
                          setSortieForm((prev) => ({
                            ...prev,
                            motif: e.target.value,
                          }))
                        }
                      />
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

                    <Button
                      onClick={handleCreateSortie}
                      disabled={formSubmitting || !sortieForm.stockId}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <ArrowUpFromLine className="w-4 h-4 mr-2" />
                      Enregistrer la sortie
                    </Button>
                  </CardContent>
                </Card>

                {/* Sorties Table */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-[15px] font-medium">
                        Historique des sorties
                      </CardTitle>
                      <Select
                        value={stockIdFilter}
                        onValueChange={setStockIdFilter}
                      >
                        <SelectTrigger className="w-full sm:w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TOUS">Tous les matériaux</SelectItem>
                          {stocks.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.designation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sorties.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <ArrowUpFromLine className="w-8 h-8 text-muted-foreground/40" />
                        <p className="text-[15px] text-muted-foreground">
                          Aucune sortie enregistrée
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-sm">Date</TableHead>
                              <TableHead className="text-sm">Matériau</TableHead>
                              <TableHead className="text-sm text-right">
                                Qté
                              </TableHead>
                              <TableHead className="text-sm hidden md:table-cell">
                                Opérateur
                              </TableHead>
                              <TableHead className="text-sm hidden lg:table-cell">
                                Motif
                              </TableHead>
                              <TableHead className="text-sm hidden xl:table-cell">
                                Tâche
                              </TableHead>
                              <TableHead className="text-sm text-right">
                                <X className="w-3 h-3" />
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sorties.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {fmtDate(s.dateSortie)}
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {s.stock.designation}
                                </TableCell>
                                <TableCell className="text-sm text-right font-semibold">
                                  {fmtN(s.quantite)} {s.stock.unite}
                                </TableCell>
                                <TableCell className="text-sm hidden md:table-cell">
                                  {s.operateur || '—'}
                                </TableCell>
                                <TableCell className="text-sm hidden lg:table-cell max-w-32 truncate">
                                  {s.motif || '—'}
                                </TableCell>
                                <TableCell className="text-sm hidden xl:table-cell">
                                  {s.tache ? (
                                    <Badge variant="secondary" className="text-xs">
                                      {s.tache.nom}
                                    </Badge>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500 hover:text-red-700"
                                    onClick={() => handleDeleteSortie(s.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── Create / Edit Material Dialog ──────────────────────────── */}
      <Dialog
        open={materielDialogOpen}
        onOpenChange={setMaterielDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMateriel
                ? 'Modifier le matériau'
                : 'Nouveau matériau'}
            </DialogTitle>
            <DialogDescription>
              {editingMateriel
                ? 'Modifiez les informations du matériau.'
                : 'Ajoutez un nouveau matériau au stock.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm">Référence</Label>
              <Input
                placeholder="Ex: CEM-001"
                className="mt-1"
                value={form.reference}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reference: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-sm">Désignation *</Label>
              <Input
                placeholder="Ex: Ciment Portland CPJ 42.5"
                className="mt-1"
                value={form.designation}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    designation: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Catégorie</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, categorie: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Unité *</Label>
                <Select
                  value={form.unite}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, unite: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm">Seuil d&apos;alerte</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                className="mt-1"
                value={form.seuilAlerte}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, seuilAlerte: e.target.value }))
                }
              />
              <p className="text-sm text-muted-foreground mt-1">
                Alerte déclenchée quand le stock disponible est &le; au seuil
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMaterielDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveMateriel}
              disabled={formSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {editingMateriel ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le matériau ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les entrées et sorties
              associées à{' '}
              <span className="font-semibold text-foreground">
                {deletingItem?.designation}
              </span>{' '}
              seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={formSubmitting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={formSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
