'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from '@/lib/auth-session'
import { format, subDays, startOfWeek, addWeeks, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ClipboardList,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  History,
  BarChart3,
  Users,
  HardHat,
  Pencil,
  Trash2,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store/app-store'

// ── Types ──────────────────────────────────────────────
interface Chantier {
  id: string
  nom: string
  statut: string
}

interface Journalier {
  id: string
  nom: string
  prenom: string
  specialite?: string | null
}

interface JournalierAffectation {
  id: string
  journalierId: string
  chantierId: string
  dateDebut: string
  dateFin: string | null
  actif: boolean
  journalier: Journalier
}

interface PointageRow {
  journalierId: string
  journalier: Journalier
  present: boolean
  tauxJournalier: number
  observation: string
}

interface PointageExisting {
  id: string
  journalierId: string
  chantierId: string
  chefChantierId: string
  dateTravail: string
  tauxJournalier: number
  present: boolean
  observation: string | null
  valide: boolean
  journalier?: Journalier
}

interface SummaryEntry {
  journalier: Journalier
  days: number
  totalAmount: number
  details: Array<{
    dateTravail: string
    present: boolean
    tauxJournalier: number
    observation: string | null
    valide: boolean
  }>
}

interface WeeklySummaryData {
  weekStart: string
  weekEnd: string
  summary: SummaryEntry[]
  grandTotal: number
  totalDays: number
}

// ── Helpers ────────────────────────────────────────────
function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function fmtDateLong(date: Date): string {
  return format(date, 'EEEE dd MMMM yyyy', { locale: fr })
}

function fmtDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// ── Main Component ─────────────────────────────────────
export function PointageView() {
  const { data: session } = useSession()
  const { selectedChantierId, setSelectedChantierId } = useAppStore()

  const userId = (session?.user as { id?: string })?.id || ''

  // Selection
  const [chantierId, setChantierId] = useState<string>(selectedChantierId || '')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Data
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [affectations, setAffectations] = useState<JournalierAffectation[]>([])
  const [pointageRows, setPointageRows] = useState<PointageRow[]>([])

  // Loading
  const [loadingChantiers, setLoadingChantiers] = useState(true)
  const [loadingForm, setLoadingForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // History
  const [historyData, setHistoryData] = useState<PointageExisting[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeTab, setActiveTab] = useState('pointage')

  // Weekly summary
  const [summaryData, setSummaryData] = useState<WeeklySummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryWeekOffset, setSummaryWeekOffset] = useState(0)

  // Edit / Delete / Validate actions (historique)
  const [editingPointage, setEditingPointage] = useState<PointageExisting | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deletePointage, setDeletePointage] = useState<PointageExisting | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editForm, setEditForm] = useState({ tauxJournalier: '', observation: '' })

  // ── Fetch chantiers ─────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoadingChantiers(true)
        const res = await fetch('/api/v1/chantiers')
        if (res.ok) {
          const data = await res.json()
          const list: Chantier[] = (data.chantiers || []).filter(
            (c: Chantier) => c.statut === 'EN_COURS'
          )
          setChantiers(list)
          if (!chantierId && list.length > 0) {
            setChantierId(list[0].id)
            setSelectedChantierId(list[0].id)
          }
        }
      } catch {
        toast.error('Erreur lors du chargement des chantiers')
      } finally {
        setLoadingChantiers(false)
      }
    }
    load()
  }, [])

  // ── Handle chantier change ──────────────────────────
  function handleChantierChange(id: string) {
    setChantierId(id)
    setSelectedChantierId(id)
  }

  // ── Handle date change ──────────────────────────────
  function handleDateChange(date: Date | undefined) {
    if (date) {
      setSelectedDate(date)
      setCalendarOpen(false)
    }
  }

  // ── Fetch form data (affectations + existing pointages + last taux) ──
  const loadFormData = useCallback(async () => {
    if (!chantierId) return

    setLoadingForm(true)
    try {
      // 1. Fetch active affectations
      const affRes = await fetch(`/api/v1/pointage/affectations?chantierId=${chantierId}`)
      if (!affRes.ok) throw new Error('Erreur affectations')
      const affData = await affRes.json()
      const affs: JournalierAffectation[] = affData.affectations || []
      setAffectations(affs)

      // 2. Fetch existing pointages for the selected date
      const dateStr = toDateStr(selectedDate)
      const ptgRes = await fetch(`/api/v1/pointage?chantierId=${chantierId}&date=${dateStr}`)
      const ptgData = ptgRes.ok ? await ptgRes.json() : { pointages: [] }
      const existing: PointageExisting[] = ptgData.pointages || []

      // 3. Fetch all pointages for this chantier to find last taux
      const allRes = await fetch(`/api/v1/pointage?chantierId=${chantierId}`)
      const allData = allRes.ok ? await allRes.json() : { pointages: [] }
      const tauxMap: Record<string, number> = {}
      const dateMap: Record<string, string> = {}
      for (const p of (allData.pointages || [])) {
        if (p.present && p.tauxJournalier > 0) {
          const prev = tauxMap[p.journalierId]
          const prevDate = dateMap[p.journalierId]
          if (!prev || !prevDate || new Date(p.dateTravail) > new Date(prevDate)) {
            tauxMap[p.journalierId] = p.tauxJournalier
            dateMap[p.journalierId] = p.dateTravail
          }
        }
      }

      // 4. Build rows
      const rows: PointageRow[] = affs.map((aff) => {
        const ex = existing.find((e) => e.journalierId === aff.journalierId)
        return {
          journalierId: aff.journalierId,
          journalier: aff.journalier,
          present: ex ? ex.present : true,
          tauxJournalier: ex ? ex.tauxJournalier : (tauxMap[aff.journalierId] || 0),
          observation: ex?.observation || '',
        }
      })
      setPointageRows(rows)
    } catch {
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoadingForm(false)
    }
  }, [chantierId, selectedDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFormData()
  }, [loadFormData])

  // ── Update a row ────────────────────────────────────
  function updateRow(
    jid: string,
    field: keyof PointageRow,
    value: boolean | number | string
  ) {
    setPointageRows((prev) =>
      prev.map((row) =>
        row.journalierId !== jid ? row : { ...row, [field]: value }
      )
    )
  }

  // ── Save pointages ──────────────────────────────────
  async function savePointages() {
    if (!chantierId || pointageRows.length === 0) return

    setSaving(true)
    try {
      const body = {
        chantierId,
        date: toDateStr(selectedDate),
        chefChantierId: userId,
        pointages: pointageRows.map((r) => ({
          journalierId: r.journalierId,
          present: r.present,
          tauxJournalier: r.present ? r.tauxJournalier : 0,
          observation: r.observation || null,
        })),
      }

      const res = await fetch('/api/v1/pointage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erreur lors de l'enregistrement")
      }

      const data = await res.json()
      const skipped =
        (data.pointages || []).filter(
          (p: PointageExisting & { skipped?: boolean }) => p.skipped
        ).length || 0
      const saved = (data.pointages || []).length - skipped

      if (skipped > 0) {
        toast.warning(
          `${saved} pointage(s) enregistré(s), ${skipped} ignoré(s) (validé(s))`
        )
      } else {
        toast.success(`${saved} pointage(s) enregistré(s) avec succès`)
      }

      loadFormData()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement"
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Validate a pointage (historique) ───────────────
  async function handleValidate(id: string) {
    setValidatingId(id)
    try {
      const res = await fetch(`/api/v1/pointage/${id}/validate`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success('Pointage validé')
        setHistoryData((prev) =>
          prev.map((p) => (p.id === id ? { ...p, valide: true } : p))
        )
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors de la validation')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setValidatingId(null)
    }
  }

  // ── Open edit dialog ────────────────────────────────
  function openEditDialog(p: PointageExisting) {
    setEditingPointage(p)
    setEditForm({
      tauxJournalier: String(p.tauxJournalier ?? ''),
      observation: p.observation || '',
    })
    setEditDialogOpen(true)
  }

  // ── Save edit ───────────────────────────────────────
  async function handleEditSave() {
    if (!editingPointage) return
    const id = editingPointage.id
    const newTaux = Number(editForm.tauxJournalier) || 0
    const newObs = editForm.observation.trim() || null
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/v1/pointage/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tauxJournalier: newTaux,
          observation: newObs,
        }),
      })
      if (res.ok) {
        toast.success('Pointage mis à jour')
        setEditDialogOpen(false)
        setHistoryData((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, tauxJournalier: newTaux, observation: newObs }
              : p
          )
        )
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Delete pointage ─────────────────────────────────
  async function handleDelete() {
    if (!deletePointage) return
    const id = deletePointage.id
    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/pointage/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Pointage supprimé')
        setDeleteDialogOpen(false)
        setHistoryData((prev) => prev.filter((p) => p.id !== id))
        setDeletePointage(null)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setDeleting(false)
    }
  }

  // ── Fetch history ───────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'historique' || !chantierId) return
    if (historyData.length > 0) return // already loaded

    async function load() {
      setLoadingHistory(true)
      try {
        const fin = toDateStr(subDays(new Date(), 1))
        const debut = toDateStr(subDays(new Date(), 7))
        const res = await fetch(
          `/api/v1/pointage?chantierId=${chantierId}&dateDebut=${debut}&dateFin=${fin}`
        )
        if (res.ok) {
          const data = await res.json()
          setHistoryData(data.pointages || [])
        }
      } catch {
        toast.error("Erreur lors du chargement de l'historique")
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [activeTab, chantierId])

  // ── Fetch weekly summary ────────────────────────────
  useEffect(() => {
    if (activeTab !== 'resume' || !chantierId) return

    async function load() {
      setLoadingSummary(true)
      try {
        const ref = addWeeks(new Date(), summaryWeekOffset)
        const ws = startOfWeek(ref, { weekStartsOn: 1 })
        const isoWeek = format(ws, "yyyy-'W'II")

        const res = await fetch(
          `/api/v1/pointage/summary?chantierId=${chantierId}&semaine=${isoWeek}`
        )
        if (res.ok) {
          setSummaryData(await res.json())
        }
      } catch {
        toast.error('Erreur lors du chargement du résumé hebdomadaire')
      } finally {
        setLoadingSummary(false)
      }
    }
    load()
  }, [activeTab, chantierId, summaryWeekOffset])

  // ── Reset history when chantier changes ─────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryData([])
  }, [chantierId])

  // ── Computed ────────────────────────────────────────
  const runningTotal = useMemo(
    () =>
      pointageRows
        .filter((r) => r.present)
        .reduce((s, r) => s + r.tauxJournalier, 0),
    [pointageRows]
  )

  const presentCount = useMemo(
    () => pointageRows.filter((r) => r.present).length,
    [pointageRows]
  )

  const summaryWeekLabel = useMemo(() => {
    if (!summaryData) return ''
    const s = parseISO(summaryData.weekStart)
    const e = parseISO(summaryData.weekEnd)
    return `Sem. du ${format(s, 'dd MMM', { locale: fr })} au ${format(e, 'dd MMM yyyy', { locale: fr })}`
  }, [summaryData])

  // ── Render ──────────────────────────────────────────
  if (loadingChantiers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-amber-500" />
          Pointage Journalier
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Enregistrer la présence quotidienne des journaliers
        </p>
      </div>

      {/* Selection Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-[17px] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            Sélection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Chantier */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Chantier</Label>
              <Select value={chantierId} onValueChange={handleChantierChange}>
                <SelectTrigger className="w-full">
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

            {/* Date Picker */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Date de travail</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarDays className="mr-2 h-4 w-4 text-amber-500" />
                    {fmtDateLong(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Date Buttons */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Accès rapide</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                  className="flex-1"
                >
                  Aujourd&apos;hui
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(subDays(new Date(), 1))}
                  className="flex-1"
                >
                  Hier
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Informations</Label>
              <div className="text-[15px] text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>{affectations.length} journalier(s) affecté(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{presentCount} présent(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardHat className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold">{fmtCurrency(runningTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="pointage" className="gap-1.5">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Pointage</span>
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historique</span>
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Résumé Hebdo</span>
          </TabsTrigger>
        </TabsList>

        {/* ──── Tab: Pointage ──── */}
        <TabsContent value="pointage" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-[17px]">
                  Pointage du {fmtDateLong(selectedDate)}
                </CardTitle>
                {pointageRows.length > 0 && (
                  <Button
                    onClick={savePointages}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Enregistrer le pointage
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingForm ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : pointageRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
                  <h3 className="text-[15px] font-medium">Aucun journalier affecté</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {chantierId
                      ? "Aucun journalier n'est affecté à ce chantier."
                      : 'Veuillez sélectionner un chantier.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Desktop Header */}
                  <div className="hidden md:grid md:grid-cols-[44px_1fr_160px_1fr] gap-3 px-3 pb-2 text-sm font-medium text-muted-foreground border-b">
                    <span>Présent</span>
                    <span>Journalier</span>
                    <span>Taux journalier</span>
                    <span>Observation</span>
                  </div>

                  {/* Rows */}
                  {pointageRows.map((row) => (
                    <div
                      key={row.journalierId}
                      className={`grid grid-cols-1 md:grid-cols-[44px_1fr_160px_1fr] gap-2 md:gap-3 items-center p-3 rounded-lg border transition-colors ${
                        row.present
                          ? 'bg-background border-border'
                          : 'bg-muted/30 border-muted'
                      }`}
                    >
                      {/* Checkbox + name (mobile) */}
                      <div className="flex items-center gap-3 md:col-span-1">
                        <Checkbox
                          checked={row.present}
                          onCheckedChange={(c) =>
                            updateRow(row.journalierId, 'present', !!c)
                          }
                          className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        />
                        {/* Mobile: name inline */}
                        <div className="flex items-center gap-2 md:hidden min-w-0">
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {row.journalier.prenom[0]}
                            {row.journalier.nom[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {row.journalier.prenom} {row.journalier.nom}
                            </p>
                            {row.journalier.specialite && (
                              <p className="text-sm text-muted-foreground truncate">
                                {row.journalier.specialite}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desktop: name */}
                      <div className="hidden md:flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {row.journalier.prenom[0]}
                          {row.journalier.nom[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {row.journalier.prenom} {row.journalier.nom}
                          </p>
                          {row.journalier.specialite && (
                            <p className="text-sm text-muted-foreground truncate">
                              {row.journalier.specialite}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Taux */}
                      <div className="relative">
                        <Label className="md:hidden text-sm text-muted-foreground mb-1 block">
                          Taux (FCFA)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.tauxJournalier || ''}
                          onChange={(e) =>
                            updateRow(
                              row.journalierId,
                              'tauxJournalier',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={!row.present}
                          placeholder="0"
                          className={`h-9 text-sm pr-14 ${
                            !row.present ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          FCFA
                        </span>
                      </div>

                      {/* Observation */}
                      <div>
                        <Label className="md:hidden text-sm text-muted-foreground mb-1 block">
                          Observation
                        </Label>
                        <Input
                          type="text"
                          value={row.observation}
                          onChange={(e) =>
                            updateRow(row.journalierId, 'observation', e.target.value)
                          }
                          placeholder="Observation..."
                          disabled={!row.present}
                          className={`h-9 text-sm ${
                            !row.present ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Footer with totals */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 mt-2 border-t">
                    <div className="flex flex-wrap items-center gap-3 text-[15px]">
                      <span className="text-muted-foreground">
                        {presentCount} présent(s) / {pointageRows.length}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        Total: {fmtCurrency(runningTotal)}
                      </Badge>
                    </div>
                    <Button
                      onClick={savePointages}
                      disabled={saving || pointageRows.length === 0}
                      className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Enregistrer le pointage
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Tab: Historique ──── */}
        <TabsContent value="historique" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[17px] flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Historique des 7 derniers jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!chantierId ? (
                <EmptyState message="Sélectionnez un chantier" />
              ) : loadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : historyData.length === 0 ? (
                <EmptyState
                  message="Aucun pointage enregistré sur les 7 derniers jours."
                />
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Journalier</TableHead>
                        <TableHead className="text-center">Présent</TableHead>
                        <TableHead className="text-right">Taux</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-[15px]">
                            {fmtDateShort(p.dateTravail)}
                          </TableCell>
                          <TableCell className="text-[15px] font-medium">
                            {p.journalier?.prenom} {p.journalier?.nom}
                            {p.journalier?.specialite && (
                              <span className="text-sm text-muted-foreground ml-1">
                                ({p.journalier.specialite})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {p.present ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Oui
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-red-50 text-red-600 border-red-200 text-xs"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Non
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-[15px]">
                            {fmtCurrency(p.tauxJournalier)}
                          </TableCell>
                          <TableCell className="text-right text-[15px] font-medium">
                            {p.present ? fmtCurrency(p.tauxJournalier) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {p.valide ? (
                              <Badge className="bg-emerald-500 text-white text-xs">
                                Validé
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                En attente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!p.valide && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleValidate(p.id)}
                                  disabled={validatingId === p.id}
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="Valider le pointage"
                                  aria-label="Valider le pointage"
                                >
                                  {validatingId === p.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(p)}
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Modifier le pointage"
                                aria-label="Modifier le pointage"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeletePointage(p)
                                  setDeleteDialogOpen(true)
                                }}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Supprimer le pointage"
                                aria-label="Supprimer le pointage"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──── Tab: Résumé Hebdo ──── */}
        <TabsContent value="resume" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-[17px] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  Résumé Hebdomadaire
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSummaryWeekOffset((o) => o - 1)}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-[15px] font-medium min-w-[180px] text-center">
                    {summaryWeekLabel || 'Chargement...'}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSummaryWeekOffset((o) => o + 1)}
                    disabled={summaryWeekOffset >= 0}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!chantierId ? (
                <EmptyState message="Sélectionnez un chantier" />
              ) : loadingSummary ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !summaryData || summaryData.summary.length === 0 ? (
                <EmptyState message="Aucun pointage enregistré pour cette semaine." />
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Journalier</TableHead>
                        <TableHead>Spécialité</TableHead>
                        <TableHead className="text-center">Jours</TableHead>
                        <TableHead className="text-right">Montant total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryData.summary.map((entry) => (
                        <TableRow key={entry.journalier.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {entry.journalier.prenom[0]}
                                {entry.journalier.nom[0]}
                              </div>
                              <span className="truncate">
                                {entry.journalier.prenom} {entry.journalier.nom}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[15px] text-muted-foreground">
                            {entry.journalier.specialite || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200"
                            >
                              {entry.days}j
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {fmtCurrency(entry.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-amber-50/50 hover:bg-amber-50/50">
                        <TableCell
                          colSpan={2}
                          className="font-bold text-amber-900"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-center font-bold text-amber-900">
                          {summaryData.totalDays}j
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-900">
                          {fmtCurrency(summaryData.grandTotal)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ──── Edit Dialog ──── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px]">
              <Pencil className="w-4 h-4 text-amber-500" />
              Modifier le pointage
            </DialogTitle>
          </DialogHeader>
          {editingPointage && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <HardHat className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-muted-foreground">Journalier :</span>
                  <span className="font-medium">
                    {editingPointage.journalier?.prenom}{' '}
                    {editingPointage.journalier?.nom}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-muted-foreground">Date :</span>
                  <span className="font-medium">
                    {fmtDateShort(editingPointage.dateTravail)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="edit-taux"
                  className="text-[15px] font-medium"
                >
                  Taux journalier (FCFA)
                </Label>
                <div className="relative">
                  <Input
                    id="edit-taux"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.tauxJournalier}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        tauxJournalier: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-9 pr-14"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    FCFA
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="edit-obs"
                  className="text-[15px] font-medium"
                >
                  Observation
                </Label>
                <Textarea
                  id="edit-obs"
                  value={editForm.observation}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      observation: e.target.value,
                    }))
                  }
                  placeholder="Observation (optionnel)..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingEdit}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={savingEdit}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {savingEdit ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──── Delete AlertDialog ──── */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[17px]">
              <Trash2 className="w-4 h-4 text-red-500" />
              Supprimer le pointage
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce pointage ? Cette action est
              irréversible.
              {deletePointage && (
                <span className="block mt-2 rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                  <span className="font-medium">
                    {deletePointage.journalier?.prenom}{' '}
                    {deletePointage.journalier?.nom}
                  </span>
                  {' — '}
                  {fmtDateShort(deletePointage.dateTravail)}
                  {' — '}
                  {fmtCurrency(deletePointage.tauxJournalier)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
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

// ── Shared Empty State ─────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-[15px] text-muted-foreground">{message}</p>
    </div>
  )
}
