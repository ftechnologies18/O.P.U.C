'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Camera,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  LayoutGrid,
  List,
  X,
  Calendar,
  User,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Package,
  FileText,
  Filter,
  ChevronDown,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'

// --- Types ---
interface PhotoItem {
  id: string
  chantierId: string
  phaseId: string | null
  tacheId: string | null
  rapportId: string | null
  priseParId: string
  datePrise: string
  legende: string | null
  categorie: string
  urlOriginale: string
  urlThumbnail: string | null
  createdAt: string
  prisePar: { id: string; name: string }
  phase: { id: string; nom: string } | null
  tache: { id: string; nom: string } | null
}

interface PhotoStats {
  total: number
  avancement: number
  incident: number
  reception: number
  materiau: number
  document: number
}

interface Chantier {
  id: string
  nom: string
  statut: string
}

interface Phase {
  id: string
  nom: string
}

interface Tache {
  id: string
  nom: string
  phaseId: string
}

// --- Category Config ---
const CATEGORIES = [
  { value: 'avancement', label: 'Avancement', color: 'bg-amber-100 text-amber-800 border-amber-200', dotColor: 'bg-amber-500', icon: CheckCircle2, bgHex: '#fef3c7' },
  { value: 'incident', label: 'Incident', color: 'bg-red-100 text-red-800 border-red-200', dotColor: 'bg-red-500', icon: AlertTriangle, bgHex: '#fee2e2' },
  { value: 'reception', label: 'Réception', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dotColor: 'bg-emerald-500', icon: CheckCircle2, bgHex: '#d1fae5' },
  { value: 'materiau', label: 'Matériau', color: 'bg-blue-100 text-blue-800 border-blue-200', dotColor: 'bg-blue-500', icon: Package, bgHex: '#dbeafe' },
  { value: 'document', label: 'Document', color: 'bg-purple-100 text-purple-800 border-purple-200', dotColor: 'bg-purple-500', icon: FileText, bgHex: '#ede9fe' },
] as const

const getCategoryConfig = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) || CATEGORIES[0]

// --- Placeholder Image Component ---
function PlaceholderImage({ categorie }: { categorie: string }) {
  const config = getCategoryConfig(categorie)
  const Icon = config.icon
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{ backgroundColor: config.bgHex }}
    >
      <Icon className="w-10 h-10 opacity-40" style={{ color: 'inherit' }} />
      <span className="text-xs opacity-50 font-medium">Photo non disponible</span>
    </div>
  )
}

// --- Empty State ---
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Camera className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Aucune photo</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? 'Aucune photo ne correspond à vos critères de filtrage.'
          : 'Commencez par ajouter des photos à ce chantier pour documenter l\'avancement des travaux.'}
      </p>
    </motion.div>
  )
}

// --- Stat Card ---
function StatCard({
  label,
  count,
  color,
  icon: Icon,
}: {
  label: string
  count: number
  color: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{count}</p>
        </div>
      </div>
    </Card>
  )
}

// ========== MAIN COMPONENT ==========
export function PhotosView() {
  const { selectedChantierId } = useAppStore()

  // Data states
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [stats, setStats] = useState<PhotoStats | null>(null)
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [taches, setTaches] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter states
  const [selectedChantier, setSelectedChantier] = useState<string>('')
  const [categorieFilter, setCategorieFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [dateDebut, setDateDebut] = useState<string>('')
  const [dateFin, setDateFin] = useState<string>('')
  const [searchText, setSearchText] = useState<string>('')

  // View state
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery')

  // Dialog states
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Edit in detail dialog
  const [editLegende, setEditLegende] = useState('')
  const [editCategorie, setEditCategorie] = useState('avancement')
  const [isEditing, setIsEditing] = useState(false)

  // Add form state
  const [formChantierId, setFormChantierId] = useState('')
  const [formPhaseId, setFormPhaseId] = useState('')
  const [formTacheId, setFormTacheId] = useState('')
  const [formDatePrise, setFormDatePrise] = useState('')
  const [formLegende, setFormLegende] = useState('')
  const [formCategorie, setFormCategorie] = useState('avancement')
  const [formUrl, setFormUrl] = useState('')

  // --- Fetch Chantiers ---
  useEffect(() => {
    async function fetchChantiers() {
      try {
        const res = await fetch('/api/chantiers')
        const data = await res.json()
        setChantiers(data.chantiers || [])
      } catch {
        toast.error('Erreur lors du chargement des chantiers')
      }
    }
    fetchChantiers()
  }, [])

  // Sync selectedChantier from global store
  useEffect(() => {
    if (selectedChantierId && !selectedChantier) {
      setSelectedChantier(selectedChantierId)
    }
  }, [selectedChantierId, selectedChantier])

  // --- Fetch Phases for selected chantier ---
  useEffect(() => {
    if (!selectedChantier) {
      setPhases([])
      setTaches([])
      return
    }
    async function fetchPhases() {
      try {
        const res = await fetch(`/api/chantiers/${selectedChantier}`)
        const data = await res.json()
        if (data.chantier?.phases) {
          const allPhases: Phase[] = data.chantier.phases.map((p: { id: string; nom: string }) => ({ id: p.id, nom: p.nom }))
          setPhases(allPhases)
          const allTaches: Tache[] = []
          data.chantier.phases.forEach((p: { id: string; taches: { id: string; nom: string }[] }) => {
            p.taches?.forEach((t: { id: string; nom: string }) => {
              allTaches.push({ id: t.id, nom: t.nom, phaseId: p.id })
            })
          })
          setTaches(allTaches)
        }
      } catch {
        toast.error('Erreur lors du chargement des phases')
      }
    }
    fetchPhases()
  }, [selectedChantier])

  // --- Fetch Photos ---
  const fetchPhotos = useCallback(async () => {
    if (!selectedChantier) {
      setPhotos([])
      setStats(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('chantierId', selectedChantier)
      if (categorieFilter && categorieFilter !== 'all') params.set('categorie', categorieFilter)
      if (phaseFilter && phaseFilter !== 'all') params.set('phaseId', phaseFilter)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (searchText.trim()) params.set('search', searchText.trim())

      const res = await fetch(`/api/photos?${params.toString()}`)
      const data = await res.json()
      setPhotos(data.photos || [])
      setStats(data.stats || null)
    } catch {
      toast.error('Erreur lors du chargement des photos')
    } finally {
      setLoading(false)
    }
  }, [selectedChantier, categorieFilter, phaseFilter, dateDebut, dateFin, searchText])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  // --- Create Photo ---
  async function handleCreate() {
    if (!formChantierId || !formDatePrise) {
      toast.error('Veuillez remplir les champs obligatoires (chantier, date, URL)')
      return
    }
    setSubmitting(true)
    try {
      // Get current user session
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()

      const url = formUrl.trim() || `placeholder://${formCategorie}`
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: formChantierId,
          phaseId: formPhaseId || null,
          tacheId: formTacheId || null,
          priseParId: session?.user?.id || 'default',
          datePrise: formDatePrise,
          legende: formLegende.trim() || null,
          categorie: formCategorie,
          urlOriginale: url,
          urlThumbnail: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création')
        return
      }
      toast.success('Photo ajoutée avec succès')
      setAddOpen(false)
      resetForm()
      fetchPhotos()
    } catch {
      toast.error('Erreur lors de la création de la photo')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Update Photo ---
  async function handleUpdate() {
    if (!selectedPhoto) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/photos/${selectedPhoto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legende: editLegende,
          categorie: editCategorie,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la mise à jour')
        return
      }
      toast.success('Photo mise à jour')
      setIsEditing(false)
      setSelectedPhoto(data.photo)
      fetchPhotos()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Delete Photo ---
  async function handleDelete() {
    if (!deleteId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/photos/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
        return
      }
      toast.success('Photo supprimée')
      setDeleteOpen(false)
      setDeleteId(null)
      if (detailOpen && selectedPhoto?.id === deleteId) {
        setDetailOpen(false)
        setSelectedPhoto(null)
      }
      fetchPhotos()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Open Detail ---
  function openDetail(photo: PhotoItem) {
    setSelectedPhoto(photo)
    setEditLegende(photo.legende || '')
    setEditCategorie(photo.categorie)
    setIsEditing(false)
    setDetailOpen(true)
  }

  // --- Reset Form ---
  function resetForm() {
    setFormChantierId(selectedChantier)
    setFormPhaseId('')
    setFormTacheId('')
    setFormDatePrise(format(new Date(), 'yyyy-MM-dd'))
    setFormLegende('')
    setFormCategorie('avancement')
    setFormUrl('')
  }

  // --- Open Add Dialog ---
  function openAddDialog() {
    resetForm()
    setAddOpen(true)
  }

  // --- Filtered taches for form ---
  const formTaches = formPhaseId ? taches.filter((t) => t.phaseId === formPhaseId) : taches

  // --- Has active filters ---
  const hasFilters =
    categorieFilter !== 'all' ||
    phaseFilter !== 'all' ||
    !!dateDebut ||
    !!dateFin ||
    !!searchText.trim()

  return (
    <div className="space-y-4">
      {/* ====== HEADER ====== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Camera className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Photothèque</h1>
            <p className="text-sm text-muted-foreground">
              Gestion des photos de chantier
            </p>
          </div>
        </div>
        <Button onClick={openAddDialog} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une photo
        </Button>
      </div>

      {/* ====== CHANTIER SELECTOR ====== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              <Label className="text-sm font-medium whitespace-nowrap">Chantier :</Label>
            </div>
            <Select
              value={selectedChantier}
              onValueChange={(val) => {
                setSelectedChantier(val)
                setPhaseFilter('all')
              }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Sélectionnez un chantier" />
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

      {/* ====== STATS ====== */}
      {stats && selectedChantier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3"
        >
          <StatCard label="Total" count={stats.total} color="bg-amber-500" icon={Camera} />
          <StatCard label="Avancement" count={stats.avancement} color="bg-amber-500" icon={CheckCircle2} />
          <StatCard label="Incidents" count={stats.incident} color="bg-red-500" icon={AlertTriangle} />
          <StatCard label="Réceptions" count={stats.reception} color="bg-emerald-500" icon={CheckCircle2} />
          <StatCard label="Matériaux" count={stats.materiau} color="bg-blue-500" icon={Package} />
          <StatCard label="Documents" count={stats.document} color="bg-purple-500" icon={FileText} />
        </motion.div>
      )}

      {/* ====== FILTERS ====== */}
      {selectedChantier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par légende..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    variant={viewMode === 'gallery' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setViewMode('gallery')}
                    className={viewMode === 'gallery' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="w-3.5 h-3.5" />
                  Filtres :
                </div>

                {/* Category filter chips */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={categorieFilter === 'all' ? 'default' : 'outline'}
                    className={`cursor-pointer text-xs transition-colors ${
                      categorieFilter === 'all'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setCategorieFilter('all')}
                  >
                    Tous
                  </Badge>
                  {CATEGORIES.map((cat) => (
                    <Badge
                      key={cat.value}
                      variant={categorieFilter === cat.value ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs transition-colors ${
                        categorieFilter === cat.value
                          ? cat.color
                          : 'hover:bg-muted'
                      }`}
                      onClick={() =>
                        setCategorieFilter(
                          categorieFilter === cat.value ? 'all' : cat.value
                        )
                      }
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-5 hidden sm:block" />

                {/* Phase filter */}
                {phases.length > 0 && (
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-auto h-7 text-xs border-dashed">
                      <SelectValue placeholder="Phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les phases</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Separator orientation="vertical" className="h-5 hidden sm:block" />

                {/* Date range */}
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="h-7 text-xs w-[130px]"
                    placeholder="Début"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="h-7 text-xs w-[130px]"
                    placeholder="Fin"
                  />
                </div>

                {/* Clear filters */}
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setCategorieFilter('all')
                      setPhaseFilter('all')
                      setDateDebut('')
                      setDateFin('')
                      setSearchText('')
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ====== LOADING ====== */}
      {loading && selectedChantier && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ====== NO CHANTIER ====== */}
      {!selectedChantier && !loading && (
        <EmptyState hasFilters={false} />
      )}

      {/* ====== EMPTY STATE ====== */}
      {!loading && selectedChantier && photos.length === 0 && (
        <EmptyState hasFilters={hasFilters} />
      )}

      {/* ====== GALLERY VIEW ====== */}
      {!loading && selectedChantier && viewMode === 'gallery' && photos.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {photos.map((photo, idx) => {
              const catConfig = getCategoryConfig(photo.categorie)
              const isPlaceholder = !photo.urlOriginale || photo.urlOriginale.startsWith('placeholder://')

              return (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                >
                  <Card
                    className="group overflow-hidden cursor-pointer hover:shadow-lg transition-shadow border border-border/50"
                    onClick={() => openDetail(photo)}
                  >
                    {/* Thumbnail / Placeholder */}
                    <div className="aspect-[4/3] relative overflow-hidden">
                      {isPlaceholder ? (
                        <PlaceholderImage categorie={photo.categorie} />
                      ) : (
                        <>
                          <img
                            src={photo.urlOriginale}
                            alt={photo.legende || 'Photo'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = 'none'
                              if (target.nextElementSibling) {
                                (target.nextElementSibling as HTMLElement).style.display = 'flex'
                              }
                            }}
                          />
                          <div className="absolute inset-0 hidden">
                            <PlaceholderImage categorie={photo.categorie} />
                          </div>
                        </>
                      )}

                      {/* Category badge overlay */}
                      <div className="absolute top-2 left-2">
                        <Badge className={`${catConfig.color} text-[10px] px-1.5 py-0`}>
                          {catConfig.label}
                        </Badge>
                      </div>

                      {/* Hover actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetail(photo)
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetail(photo)
                            setTimeout(() => setIsEditing(true), 100)
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteId(photo.id)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Card info */}
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {photo.legende || 'Sans légende'}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(photo.datePrise), 'dd MMM yyyy', { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate ml-2">
                          {photo.prisePar.name}
                        </p>
                      </div>
                      {photo.phase && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {photo.phase.nom}{photo.tache ? ` › ${photo.tache.nom}` : ''}
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ====== LIST VIEW ====== */}
      {!loading && selectedChantier && viewMode === 'list' && photos.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Aperçu</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Légende</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Catégorie</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Phase / Tâche</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Auteur</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {photos.map((photo, idx) => {
                      const catConfig = getCategoryConfig(photo.categorie)
                      const isPlaceholder = !photo.urlOriginale || photo.urlOriginale.startsWith('placeholder://')
                      return (
                        <motion.tr
                          key={photo.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border">
                              {isPlaceholder ? (
                                <div className="w-full h-full" style={{ backgroundColor: catConfig.bgHex }}>
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Camera className="w-4 h-4 opacity-40" />
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={photo.urlOriginale}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget
                                    target.style.display = 'none'
                                    if (target.nextElementSibling) {
                                      (target.nextElementSibling as HTMLElement).style.display = 'flex'
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-foreground truncate max-w-[200px]">
                              {photo.legende || 'Sans légende'}
                            </p>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <Badge className={`${catConfig.color} text-[10px]`}>
                              {catConfig.label}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                            {format(parseISO(photo.datePrise), 'dd MMM yyyy', { locale: fr })}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell max-w-[150px] truncate">
                            {photo.phase
                              ? `${photo.phase.nom}${photo.tache ? ` › ${photo.tache.nom}` : ''}`
                              : '—'}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                            {photo.prisePar.name}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => openDetail(photo)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  openDetail(photo)
                                  setTimeout(() => setIsEditing(true), 100)
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setDeleteId(photo.id)
                                  setDeleteOpen(true)
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ====== ADD PHOTO DIALOG ====== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Ajouter une photo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Chantier */}
            <div className="space-y-1.5">
              <Label>Chantier *</Label>
              <Select value={formChantierId} onValueChange={setFormChantierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un chantier" />
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

            {/* Phase & Tache */}
            {formChantierId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phase</Label>
                  <Select value={formPhaseId} onValueChange={(v) => { setFormPhaseId(v); setFormTacheId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {phases
                        .filter((p) => !formChantierId || p) // show all phases for selected chantier
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tâche</Label>
                  <Select value={formTacheId} onValueChange={setFormTacheId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {formTaches.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Date & Categorie */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de prise *</Label>
                <Input
                  type="date"
                  value={formDatePrise}
                  onChange={(e) => setFormDatePrise(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={formCategorie} onValueChange={setFormCategorie}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cat.dotColor}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label>URL de l&apos;image</Label>
              <Input
                placeholder="https://exemple.com/photo.jpg (laisser vide pour un placeholder)"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si vide, un placeholder visuel sera utilisé.
              </p>
            </div>

            {/* Legende */}
            <div className="space-y-1.5">
              <Label>Légende</Label>
              <Textarea
                placeholder="Description de la photo..."
                value={formLegende}
                onChange={(e) => setFormLegende(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Ajout...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DETAIL DIALOG ====== */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open)
        if (!open) setIsEditing(false)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-500" />
                  Détails de la photo
                </DialogTitle>
              </DialogHeader>

              {/* Image / Placeholder */}
              <div className="rounded-lg overflow-hidden border max-h-[400px]">
                {(!selectedPhoto.urlOriginale || selectedPhoto.urlOriginale.startsWith('placeholder://')) ? (
                  <div className="aspect-video">
                    <PlaceholderImage categorie={selectedPhoto.categorie} />
                  </div>
                ) : (
                  <img
                    src={selectedPhoto.urlOriginale}
                    alt={selectedPhoto.legende || 'Photo'}
                    className="w-full h-full object-contain max-h-[400px] bg-muted"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      if (target.parentElement) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'aspect-video w-full'
                        placeholder.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center gap-2" style="background-color:${getCategoryConfig(selectedPhoto.categorie).bgHex}"><span class="text-xs opacity-50">Photo non disponible</span></div>`
                        target.parentElement.appendChild(placeholder)
                      }
                    }}
                  />
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-3">
                {!isEditing ? (
                  <>
                    {/* Read-only metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date de prise</p>
                          <p className="text-sm font-medium">
                            {format(parseISO(selectedPhoto.datePrise), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Prise par</p>
                          <p className="text-sm font-medium">{selectedPhoto.prisePar.name}</p>
                        </div>
                      </div>
                      {selectedPhoto.phase && (
                        <div className="flex items-start gap-2">
                          <FolderOpen className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Phase</p>
                            <p className="text-sm font-medium">{selectedPhoto.phase.nom}</p>
                          </div>
                        </div>
                      )}
                      {selectedPhoto.tache && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Tâche</p>
                            <p className="text-sm font-medium">{selectedPhoto.tache.nom}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Category & Legende display */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Catégorie</p>
                          <Badge className={`${getCategoryConfig(selectedPhoto.categorie).color} mt-0.5`}>
                            {getCategoryConfig(selectedPhoto.categorie).label}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditing(true)}
                          className="text-xs"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Modifier
                        </Button>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Légende</p>
                        <p className="text-sm">
                          {selectedPhoto.legende || <span className="italic text-muted-foreground">Aucune légende</span>}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Edit mode */}
                    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                      <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        Mode édition
                      </p>
                      <div className="space-y-1.5">
                        <Label>Catégorie</Label>
                        <Select value={editCategorie} onValueChange={setEditCategorie}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${cat.dotColor}`} />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Légende</Label>
                        <Textarea
                          value={editLegende}
                          onChange={(e) => setEditLegende(e.target.value)}
                          rows={3}
                          placeholder="Description de la photo..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={submitting}
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                          {submitting ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditLegende(selectedPhoto.legende || '')
                            setEditCategorie(selectedPhoto.categorie)
                            setIsEditing(false)
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Created date */}
                <p className="text-[10px] text-muted-foreground">
                  Ajoutée le {format(parseISO(selectedPhoto.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>

              {/* Delete button */}
              {!isEditing && (
                <DialogFooter className="mt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteId(selectedPhoto.id)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer cette photo
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRMATION ====== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la photo ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La photo sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-500 hover:bg-red-600"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
