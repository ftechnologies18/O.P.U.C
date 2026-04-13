'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Loader2,
  AlertCircle,
  Users,
  CalendarDays,
  Camera,
  Ban,
  Cloud,
  CloudRain,
  Sun,
  X,
  ImageOff,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'
import { useAppStore } from '@/store/app-store'

// ── Types ──────────────────────────────────────────────
interface Chantier {
  id: string
  nom: string
  statut: string
}

interface RapportListItem {
  id: string
  chantierId: string
  auteurId: string
  dateRapport: string
  meteo: string | null
  effectifPresent: number | null
  travauxRealises: string
  incidents: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
  photoCount: number
  auteur: { id: string; name: string; email: string }
  chantier: { id: string; nom: string }
}

interface RapportDetail extends Omit<RapportListItem, 'photoCount' | 'photos'> {
  chantier: { id: string; nom: string; adresse: string | null }
  photos: Array<{
    id: string
    legende: string | null
    categorie: string
    urlOriginale: string
    urlThumbnail: string | null
    datePrise: string
  }>
}

interface FormData {
  chantierId: string
  dateRapport: string
  meteo: string
  effectifPresent: string
  travauxRealises: string
  incidents: string
  observations: string
}

// ── Weather config ─────────────────────────────────────
const WEATHER_OPTIONS = [
  { value: 'ensoleille', label: 'Ensoleillé', emoji: '☀️', icon: Sun, bg: 'bg-amber-100 text-amber-800 border-amber-200', cardBg: 'bg-amber-50' },
  { value: 'nuageux', label: 'Nuageux', emoji: '⛅', icon: Cloud, bg: 'bg-slate-100 text-slate-700 border-slate-200', cardBg: 'bg-slate-50' },
  { value: 'pluie', label: 'Pluie', emoji: '🌧️', icon: CloudRain, bg: 'bg-blue-100 text-blue-700 border-blue-200', cardBg: 'bg-blue-50' },
  { value: 'arret_intemperie', label: "Arrêt intempérie", emoji: '🚫', icon: Ban, bg: 'bg-red-100 text-red-700 border-red-200', cardBg: 'bg-red-50' },
] as const

function getWeatherBadge(meteo: string | null) {
  const map: Record<string, typeof WEATHER_OPTIONS[number]> = {
    ensoleille: WEATHER_OPTIONS[0],
    nuageux: WEATHER_OPTIONS[1],
    pluie: WEATHER_OPTIONS[2],
    arret_intemperie: WEATHER_OPTIONS[3],
    'ensoleillé': WEATHER_OPTIONS[0],
  }
  return map[meteo || ''] || null
}

// ── Helpers ────────────────────────────────────────────
function fmtDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'EEEE dd MMMM yyyy', { locale: fr })
}

function fmtDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

function fmtDateInput(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

const emptyForm: FormData = {
  chantierId: '',
  dateRapport: fmtDateInput(new Date()),
  meteo: 'ensoleille',
  effectifPresent: '',
  travauxRealises: '',
  incidents: '',
  observations: '',
}

// ── Main Component ─────────────────────────────────────
export function RapportsView() {
  const { data: session } = useSession()
  const { selectedChantierId } = useAppStore()

  const userId = (session?.user as { id?: string })?.id || ''
  const userName = session?.user?.name || 'Utilisateur'

  // ── State ───────────────────────────────────────────
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [rapports, setRapports] = useState<RapportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRapports, setTotalRapports] = useState(0)
  const [rapportsToday, setRapportsToday] = useState(0)

  // Filters
  const [filterChantierId, setFilterChantierId] = useState<string>(selectedChantierId || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Calendar popover
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Detail
  const [viewRapport, setViewRapport] = useState<RapportDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editRapportId, setEditRapportId] = useState<string | null>(null)
  const [deleteRapportId, setDeleteRapportId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Load chantiers ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/chantiers')
        if (res.ok) {
          const data = await res.json()
          setChantiers(data.chantiers || [])
        }
      } catch {
        // Silent fail
      }
    }
    load()
  }, [])

  // ── Load rapports ───────────────────────────────────
  const loadRapports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterChantierId && filterChantierId !== 'all') {
        params.set('chantierId', filterChantierId)
      }
      // Date range from current month
      const mStart = startOfMonth(currentMonth)
      const mEnd = endOfMonth(currentMonth)
      params.set('dateDebut', fmtDateInput(mStart))
      params.set('dateFin', fmtDateInput(mEnd))
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim())
      }

      const res = await fetch(`/api/rapports?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRapports(data.rapports || [])
        setTotalRapports(data.total || 0)
        setRapportsToday(data.rapportsToday || 0)
      }
    } catch {
      toast.error('Erreur lors du chargement des rapports')
    } finally {
      setLoading(false)
    }
  }, [filterChantierId, currentMonth, searchQuery])

  useEffect(() => {
    loadRapports()
  }, [loadRapports])

  // ── Month navigation ────────────────────────────────
  function prevMonth() {
    setCurrentMonth((m) => subMonths(m, 1))
  }
  function nextMonth() {
    setCurrentMonth((m) => addMonths(m, 1))
  }
  function goToday() {
    setCurrentMonth(new Date())
  }

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: fr })

  // ── Search handler (debounced) ─────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ── Open Create dialog ─────────────────────────────
  function openCreate() {
    setFormData({
      ...emptyForm,
      dateRapport: fmtDateInput(new Date()),
      chantierId: filterChantierId !== 'all' ? filterChantierId : (selectedChantierId || ''),
    })
    setCreateOpen(true)
  }

  // ── Create rapport ─────────────────────────────────
  async function handleCreate() {
    if (!formData.chantierId || !formData.travauxRealises.trim()) {
      toast.error('Veuillez remplir le chantier et les travaux réalisés')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/rapports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          auteurId: userId,
          effectifPresent: formData.effectifPresent ? Number(formData.effectifPresent) : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la création')
      }

      toast.success('Rapport journalier créé avec succès')
      setCreateOpen(false)
      loadRapports()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  // ── Open Edit dialog ───────────────────────────────
  async function openEdit(rapport: RapportListItem) {
    setEditRapportId(rapport.id)
    setFormData({
      chantierId: rapport.chantierId,
      dateRapport: fmtDateInput(new Date(rapport.dateRapport)),
      meteo: rapport.meteo || 'ensoleille',
      effectifPresent: rapport.effectifPresent?.toString() || '',
      travauxRealises: rapport.travauxRealises,
      incidents: rapport.incidents || '',
      observations: rapport.observations || '',
    })
    setEditOpen(true)
  }

  // ── Update rapport ─────────────────────────────────
  async function handleUpdate() {
    if (!editRapportId || !formData.travauxRealises.trim()) {
      toast.error('Les travaux réalisés sont requis')
      return
    }

    setSaving(true)
    try {
      const { chantierId: _, ...updateData } = formData
      const res = await fetch(`/api/rapports/${editRapportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateData,
          effectifPresent: updateData.effectifPresent ? Number(updateData.effectifPresent) : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la mise à jour')
      }

      toast.success('Rapport mis à jour avec succès')
      setEditOpen(false)
      setEditRapportId(null)
      loadRapports()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  // ── View detail ────────────────────────────────────
  async function openView(rapport: RapportListItem) {
    setViewRapport(null)
    setViewOpen(true)
    setLoadingDetail(true)

    try {
      const res = await fetch(`/api/rapports/${rapport.id}`)
      if (res.ok) {
        const data = await res.json()
        setViewRapport(data.rapport)
      } else {
        toast.error('Erreur lors du chargement du rapport')
      }
    } catch {
      toast.error('Erreur lors du chargement du rapport')
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Delete rapport ─────────────────────────────────
  function openDelete(rapport: RapportListItem) {
    setDeleteRapportId(rapport.id)
    setDeleteOpen(true)
  }

  async function handleDelete() {
    if (!deleteRapportId) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/rapports/${deleteRapportId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }

      toast.success('Rapport supprimé avec succès')
      setDeleteOpen(false)
      setDeleteRapportId(null)
      loadRapports()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  // ── Print ──────────────────────────────────────────
  function handlePrint() {
    window.print()
  }

  // ── Render ─────────────────────────────────────────
  if (loading && chantiers.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            Rapports Journaliers
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            Suivi quotidien des activités de chantier
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau rapport
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRapports}</p>
                <p className="text-sm text-muted-foreground">Total rapports</p>
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
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rapportsToday}</p>
                <p className="text-sm text-muted-foreground">Aujourd&apos;hui</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {rapports.reduce((s, r) => s + r.photoCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Photos associées</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Chantier Filter */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Chantier</Label>
              <Select value={filterChantierId} onValueChange={setFilterChantierId}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Tous les chantiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les chantiers</SelectItem>
                  {chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Navigation */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Mois</Label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={prevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 flex-1 justify-start text-left font-normal capitalize text-sm">
                      {monthLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentMonth}
                      onSelect={(d) => {
                        if (d) {
                          setCurrentMonth(d)
                          setDatePickerOpen(false)
                        }
                      }}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-sm font-medium text-muted-foreground">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Travaux, incidents..."
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>

            {/* Today button */}
            <div className="space-y-1.5 flex items-end">
              <Button variant="outline" size="sm" onClick={goToday} className="w-full h-9">
                <CalendarDays className="w-4 h-4 mr-1.5" />
                Mois actuel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rapport List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : rapports.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center mb-4">
              <CloudSun className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold mb-1">Aucun rapport trouvé</h3>
            <p className="text-[15px] text-muted-foreground max-w-sm mb-6">
              {searchQuery.trim()
                ? 'Aucun rapport ne correspond à votre recherche.'
                : filterChantierId !== 'all'
                  ? 'Aucun rapport pour ce chantier sur cette période.'
                  : 'Commencez par créer votre premier rapport journalier.'}
            </p>
            {!searchQuery.trim() && (
              <Button
                onClick={openCreate}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer un rapport
              </Button>
            )}
          </motion.div>
        ) : (
          rapports.map((rapport, idx) => {
            const weather = getWeatherBadge(rapport.meteo)
            return (
              <motion.div
                key={rapport.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Top row: Date + Weather + Effectif + Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex items-start gap-3">
                          {/* Date */}
                          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-amber-50 border border-amber-100 shrink-0">
                            <span className="text-lg font-bold text-amber-700 leading-tight">
                              {format(parseISO(rapport.dateRapport), 'dd')}
                            </span>
                            <span className="text-xs font-medium text-amber-600 uppercase leading-tight">
                              {format(parseISO(rapport.dateRapport), 'MMM yy', { locale: fr })}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {/* Weather badge */}
                              {weather && (
                                <Badge variant="outline" className={`text-xs ${weather.bg}`}>
                                  <span className="mr-1">{weather.emoji}</span>
                                  {weather.label}
                                </Badge>
                              )}

                              {/* Effectif */}
                              {rapport.effectifPresent != null && rapport.effectifPresent > 0 && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  <Users className="w-3 h-3 mr-1" />
                                  {rapport.effectifPresent} présent(s)
                                </Badge>
                              )}

                              {/* Photo count */}
                              {rapport.photoCount > 0 && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  <Camera className="w-3 h-3 mr-1" />
                                  {rapport.photoCount} photo(s)
                                </Badge>
                              )}
                            </div>

                            {/* Chantier name */}
                            <p className="text-sm text-muted-foreground">
                              📍 {rapport.chantier.nom}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 self-start">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                            onClick={() => openView(rapport)}
                            title="Voir"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                            onClick={() => openEdit(rapport)}
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => openDelete(rapport)}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Travaux réalisés */}
                      <div className="pl-0 sm:pl-[68px]">
                        <p className="text-[15px] text-muted-foreground leading-relaxed">
                          <span className="font-medium text-foreground">Travaux :</span>{' '}
                          {rapport.travauxRealises.length > 180
                            ? rapport.travauxRealises.slice(0, 180) + '...'
                            : rapport.travauxRealises}
                        </p>
                      </div>

                      {/* Footer: incidents + auteur */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pl-0 sm:pl-[68px]">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {rapport.incidents && (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Incident(s) signalé(s)
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Par {rapport.auteur.name}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>

      {/* ═══════ Create Dialog ═══════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Nouveau rapport journalier
            </DialogTitle>
            <DialogDescription>
              Créez un rapport pour documenter les activités du jour.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Chantier */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Chantier *</Label>
              <Select
                value={formData.chantierId}
                onValueChange={(v) => setFormData((f) => ({ ...f, chantierId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un chantier" />
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

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Date du rapport *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4 text-amber-500" />
                    {formData.dateRapport ? fmtDate(new Date(formData.dateRapport)) : 'Choisir une date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dateRapport ? new Date(formData.dateRapport) : undefined}
                    onSelect={(d) => {
                      if (d) setFormData((f) => ({ ...f, dateRapport: fmtDateInput(d) }))
                    }}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Météo */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Conditions météorologiques</Label>
              <RadioGroup
                value={formData.meteo}
                onValueChange={(v) => setFormData((f) => ({ ...f, meteo: v }))}
                className="grid grid-cols-2 gap-2"
              >
                {WEATHER_OPTIONS.map((w) => {
                  const Icon = w.icon
                  return (
                    <label
                      key={w.value}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        formData.meteo === w.value ? w.bg : 'border-muted hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={w.value} className="sr-only" />
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{w.emoji} {w.label}</span>
                    </label>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Effectif */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Effectif présent</Label>
              <Input
                type="number"
                min="0"
                placeholder="Nombre de travailleurs présents"
                value={formData.effectifPresent}
                onChange={(e) => setFormData((f) => ({ ...f, effectifPresent: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Travaux réalisés */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Travaux réalisés *</Label>
              <Textarea
                placeholder="Décrivez les travaux effectués..."
                rows={4}
                value={formData.travauxRealises}
                onChange={(e) => setFormData((f) => ({ ...f, travauxRealises: e.target.value }))}
              />
            </div>

            {/* Incidents */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Incidents</Label>
              <Textarea
                placeholder="Incidents ou accidents survenus (le cas échéant)..."
                rows={2}
                value={formData.incidents}
                onChange={(e) => setFormData((f) => ({ ...f, incidents: e.target.value }))}
              />
            </div>

            {/* Observations */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Observations</Label>
              <Textarea
                placeholder="Remarques supplémentaires..."
                rows={2}
                value={formData.observations}
                onChange={(e) => setFormData((f) => ({ ...f, observations: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formData.chantierId || !formData.travauxRealises.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Créer le rapport
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Edit Dialog ═══════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              Modifier le rapport
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du rapport journalier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Date du rapport</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4 text-amber-500" />
                    {formData.dateRapport ? fmtDate(new Date(formData.dateRapport)) : 'Choisir une date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dateRapport ? new Date(formData.dateRapport) : undefined}
                    onSelect={(d) => {
                      if (d) setFormData((f) => ({ ...f, dateRapport: fmtDateInput(d) }))
                    }}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Météo */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Conditions météorologiques</Label>
              <RadioGroup
                value={formData.meteo}
                onValueChange={(v) => setFormData((f) => ({ ...f, meteo: v }))}
                className="grid grid-cols-2 gap-2"
              >
                {WEATHER_OPTIONS.map((w) => {
                  const Icon = w.icon
                  return (
                    <label
                      key={w.value}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        formData.meteo === w.value ? w.bg : 'border-muted hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={w.value} className="sr-only" />
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{w.emoji} {w.label}</span>
                    </label>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Effectif */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Effectif présent</Label>
              <Input
                type="number"
                min="0"
                placeholder="Nombre de travailleurs présents"
                value={formData.effectifPresent}
                onChange={(e) => setFormData((f) => ({ ...f, effectifPresent: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Travaux réalisés */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Travaux réalisés *</Label>
              <Textarea
                placeholder="Décrivez les travaux effectués..."
                rows={4}
                value={formData.travauxRealises}
                onChange={(e) => setFormData((f) => ({ ...f, travauxRealises: e.target.value }))}
              />
            </div>

            {/* Incidents */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Incidents</Label>
              <Textarea
                placeholder="Incidents ou accidents survenus..."
                rows={2}
                value={formData.incidents}
                onChange={(e) => setFormData((f) => ({ ...f, incidents: e.target.value }))}
              />
            </div>

            {/* Observations */}
            <div className="space-y-1.5">
              <Label className="text-[15px] font-medium">Observations</Label>
              <Textarea
                placeholder="Remarques supplémentaires..."
                rows={2}
                value={formData.observations}
                onChange={(e) => setFormData((f) => ({ ...f, observations: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || !formData.travauxRealises.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ View Detail Dialog ═══════ */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-h-none print:p-6">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : viewRapport ? (
            <>
              <DialogHeader className="print:hidden">
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    Rapport du {fmtDate(viewRapport.dateRapport)}
                  </DialogTitle>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1.5" />
                    Imprimer
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-5 print:space-y-4">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold print:text-lg">
                      {viewRapport.chantier.nom}
                    </h2>
                    {viewRapport.chantier.adresse && (
                      <p className="text-[15px] text-muted-foreground">{viewRapport.chantier.adresse}</p>
                    )}
                  </div>
                  <div className="text-right text-[15px] text-muted-foreground">
                    <p className="font-medium text-foreground">{fmtDate(viewRapport.dateRapport)}</p>
                    <p>Par {viewRapport.auteur.name}</p>
                  </div>
                </div>

                {/* Print-only title */}
                <div className="hidden print:block text-center">
                  <h1 className="text-2xl font-bold">RAPPORT JOURNALIER</h1>
                  <p className="text-lg">{viewRapport.chantier.nom}</p>
                  <p className="text-sm text-muted-foreground">{fmtDate(viewRapport.dateRapport)}</p>
                  <Separator className="my-3" />
                </div>

                {/* Key info row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* Weather */}
                  <Card className={getWeatherBadge(viewRapport.meteo)?.cardBg || 'bg-muted'}>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl mb-1">{getWeatherBadge(viewRapport.meteo)?.emoji || '—'}</p>
                      <p className="text-sm font-medium">
                        {getWeatherBadge(viewRapport.meteo)?.label || 'Non défini'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Effectif */}
                  <Card className="bg-blue-50">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {viewRapport.effectifPresent ?? '—'}
                      </p>
                      <p className="text-sm text-blue-600 font-medium">Effectif présent</p>
                    </CardContent>
                  </Card>

                  {/* Photos */}
                  <Card className="bg-purple-50">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-purple-700">
                        {viewRapport.photos.length}
                      </p>
                      <p className="text-sm text-purple-600 font-medium">Photo(s)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Travaux réalisés */}
                <div>
                  <h3 className="text-[15px] font-semibold mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Travaux réalisés
                  </h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                    {viewRapport.travauxRealises}
                  </p>
                </div>

                {/* Incidents */}
                {viewRapport.incidents && (
                  <div>
                    <h3 className="text-[15px] font-semibold mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Incidents
                    </h3>
                    <div className="text-[15px] text-red-700 leading-relaxed whitespace-pre-wrap bg-red-50 rounded-lg p-3 border border-red-100">
                      {viewRapport.incidents}
                    </div>
                  </div>
                )}

                {/* Observations */}
                {viewRapport.observations && (
                  <div>
                    <h3 className="text-[15px] font-semibold mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Observations
                    </h3>
                    <p className="text-[15px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                      {viewRapport.observations}
                    </p>
                  </div>
                )}

                {/* Photos section */}
                {viewRapport.photos.length > 0 && (
                  <div>
                    <Separator className="my-4" />
                    <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-500" />
                      Photos ({viewRapport.photos.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {viewRapport.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="aspect-square rounded-lg bg-muted border flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
                        >
                          <ImageOff className="w-6 h-6" />
                          <p className="text-xs text-center px-2 truncate w-full">
                            {photo.legende || 'Sans légende'}
                          </p>
                          <Badge variant="outline" className="text-[9px]">
                            {photo.categorie}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-[15px] text-muted-foreground">
                Erreur lors du chargement du rapport.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════ Delete Confirmation ═══════ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les photos associées seront détachées du rapport
              mais conservées dans la galerie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
