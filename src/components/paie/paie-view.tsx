'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  X,
  CalendarDays,
  Filter,
  Eye,
  Coins,
  Users,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

interface ValidePar {
  id: string
  name: string
}

interface PaiementHebdo {
  id: string
  journalierId: string
  chantierId: string
  semaineDebut: string
  semaineFin: string
  montantCalcule: number
  montantVerse: number | null
  modePaiement: string | null
  datePaiement: string | null
  statut: string
  valideParId: string | null
  differenceComment: string | null
  createdAt: string
  updatedAt: string
  journalier: Journalier
  validePar: ValidePar | null
  daysWorked?: number
  created?: boolean
  updated?: boolean
  skipped?: boolean
}

interface PointageDetail {
  id: string
  dateTravail: string
  tauxJournalier: number
  valide: boolean
  observation: string | null
}

// ── Helpers ────────────────────────────────────────────
function fmtCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function fmtDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

function fmtWeekLabel(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return `${format(start, 'dd MMM', { locale: fr })} – ${format(end, 'dd MMM yyyy', { locale: fr })}`
}

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  EN_ATTENTE: {
    label: 'En attente',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  VALIDE: {
    label: 'Validé',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PARTIELLEMENT_VERSE: {
    label: 'Partiel',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
}

const MODE_PAIEMENT_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  VIREMENT: 'Virement',
}

const FILTER_TABS = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'VALIDE', label: 'Validés' },
  { value: 'PARTIELLEMENT_VERSE', label: 'Partiels' },
]

// ── Main Component ─────────────────────────────────────
export function PaieView() {
  const { data: session } = useSession()
  const { selectedChantierId, setSelectedChantierId } = useAppStore()

  const userId = (session?.user as { id?: string })?.id || ''

  // Selection state
  const [chantierId, setChantierId] = useState<string>(selectedChantierId || '')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [chantiers, setChantiers] = useState<Chantier[]>([])

  // Data state
  const [paiements, setPaiements] = useState<PaiementHebdo[]>([])
  const [filterTab, setFilterTab] = useState('TOUS')

  // Loading
  const [loadingChantiers, setLoadingChantiers] = useState(true)
  const [loadingPaiements, setLoadingPaiements] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Validate dialog
  const [validateOpen, setValidateOpen] = useState(false)
  const [editingPaiement, setEditingPaiement] = useState<PaiementHebdo | null>(null)
  const [formMontant, setFormMontant] = useState('')
  const [formMode, setFormMode] = useState('ESPECES')
  const [formDate, setFormDate] = useState('')
  const [formComment, setFormComment] = useState('')
  const [validating, setValidating] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPaiement, setDetailPaiement] = useState<PaiementHebdo | null>(null)
  const [detailPointages, setDetailPointages] = useState<PointageDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingPaiement, setDeletingPaiement] = useState<PaiementHebdo | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch chantiers ─────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoadingChantiers(true)
        const res = await fetch('/api/chantiers')
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
    setPaiements([])
  }

  // ── Week navigation ─────────────────────────────────
  function goToPrevWeek() {
    setCurrentWeekStart((prev) => subWeeks(prev, 1))
    setPaiements([])
  }

  function goToNextWeek() {
    setCurrentWeekStart((prev) => addWeeks(prev, 1))
    setPaiements([])
  }

  // ── Week label ──────────────────────────────────────
  const weekLabel = useMemo(() => fmtWeekLabel(currentWeekStart), [currentWeekStart])

  // ── Fetch paiements ─────────────────────────────────
  const loadPaiements = useCallback(async () => {
    if (!chantierId) return

    setLoadingPaiements(true)
    try {
      const params = new URLSearchParams()
      params.set('chantierId', chantierId)
      if (filterTab !== 'TOUS') {
        params.set('statut', filterTab)
      }
      params.set('semaineDebut', format(currentWeekStart, 'yyyy-MM-dd'))

      const res = await fetch(`/api/paie?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPaiements(data.paiements || [])
      }
    } catch {
      toast.error('Erreur lors du chargement des paiements')
    } finally {
      setLoadingPaiements(false)
    }
  }, [chantierId, filterTab, currentWeekStart])

  useEffect(() => {
    loadPaiements()
  }, [loadPaiements])

  // ── Generate weekly summary ─────────────────────────
  async function handleGenerate() {
    if (!chantierId) {
      toast.error('Veuillez sélectionner un chantier')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/paie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId,
          semaineDebut: format(currentWeekStart, 'yyyy-MM-dd'),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la génération')
      }

      const data = await res.json()
      const created = (data.paiements || []).filter((p: PaiementHebdo) => p.created).length
      const updated = (data.paiements || []).filter((p: PaiementHebdo) => p.updated).length
      const skipped = (data.paiements || []).filter((p: PaiementHebdo) => p.skipped).length

      if (created > 0 || updated > 0) {
        toast.success(
          `${created} nouveau(x) et ${updated} mis à jour — récapitulatif généré !`
        )
      } else if (skipped > 0) {
        toast.info(`${skipped} paiement(s) déjà validé(s) — aucun changement.`)
      } else {
        toast.info(data.message || 'Aucun pointage trouvé pour cette semaine.')
      }

      loadPaiements()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  // ── Open validate dialog ────────────────────────────
  function openValidateDialog(paiement: PaiementHebdo) {
    setEditingPaiement(paiement)
    setFormMontant('')
    setFormMode('ESPECES')
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormComment('')
    setValidateOpen(true)
  }

  // ── Validate payment ────────────────────────────────
  async function handleValidate() {
    if (!editingPaiement) return

    const montant = parseFloat(formMontant)
    if (isNaN(montant) || montant < 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }

    if (!formDate) {
      toast.error('Veuillez sélectionner une date de paiement')
      return
    }

    setValidating(true)
    try {
      const res = await fetch(`/api/paie/${editingPaiement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montantVerse: montant,
          modePaiement: formMode,
          datePaiement: formDate,
          differenceComment: formComment,
          valideParId: userId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la validation')
      }

      const data = await res.json()
      const newStatut = data.paiement.statut
      const ptsValidated = data.pointagesValidated || 0

      if (newStatut === 'VALIDE') {
        toast.success(
          `Paiement validé ! ${ptsValidated} pointage(s) marqué(s) comme validé(s).`
        )
      } else {
        toast.warning(
          `Paiement partiel (${fmtCurrency(montant)} / ${fmtCurrency(editingPaiement.montantCalcule)}). ${ptsValidated} pointage(s) validé(s).`
        )
      }

      setValidateOpen(false)
      loadPaiements()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }

  // ── Open detail dialog ──────────────────────────────
  async function openDetailDialog(paiement: PaiementHebdo) {
    setDetailPaiement(paiement)
    setDetailPointages([])
    setDetailOpen(true)
    setLoadingDetail(true)

    try {
      const res = await fetch(`/api/paie/${paiement.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailPointages(data.pointages || [])
      }
    } catch {
      toast.error('Erreur lors du chargement du détail')
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Open delete dialog ──────────────────────────────
  function openDeleteDialog(paiement: PaiementHebdo) {
    setDeletingPaiement(paiement)
    setDeleteOpen(true)
  }

  // ── Delete payment ──────────────────────────────────
  async function handleDelete() {
    if (!deletingPaiement) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/paie/${deletingPaiement.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }

      toast.success('Paiement supprimé avec succès')
      setDeleteOpen(false)
      loadPaiements()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  // ── Computed: Filtered paiements ────────────────────
  const filteredPaiements = useMemo(() => {
    if (filterTab === 'TOUS') return paiements
    return paiements.filter((p) => p.statut === filterTab)
  }, [paiements, filterTab])

  // ── Computed: Totals ────────────────────────────────
  const totals = useMemo(() => {
    const totalCalcule = filteredPaiements.reduce((s, p) => s + p.montantCalcule, 0)
    const totalVerse = filteredPaiements.reduce(
      (s, p) => s + (p.montantVerse || 0),
      0
    )
    const totalEcart = totalVerse - totalCalcule
    const totalJournaliers = filteredPaiements.length
    const enAttenteCount = paiements.filter((p) => p.statut === 'EN_ATTENTE').length
    return { totalCalcule, totalVerse, totalEcart, totalJournaliers, enAttenteCount }
  }, [filteredPaiements, paiements])

  // ── Render ──────────────────────────────────────────
  if (loadingChantiers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="w-6 h-6 text-amber-500" />
          Paie Hebdomadaire
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Gestion des paiements hebdomadaires des journaliers
        </p>
      </div>

      {/* ── Selection Card ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Chantier selector */}
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

            {/* Week picker */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Semaine</Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrevWeek}
                  className="h-9 w-9 shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border bg-muted/50 text-[15px] font-medium min-w-0">
                  <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate">{weekLabel}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextWeek}
                  className="h-9 w-9 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Generate button */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Récapitulatif</Label>
              <Button
                onClick={handleGenerate}
                disabled={generating || !chantierId}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Générer le récapitulatif
              </Button>
            </div>

            {/* Info box */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Informations</Label>
              <div className="text-[15px] text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>{totals.totalJournaliers} journalier(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{totals.enAttenteCount} en attente</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold">{fmtCurrency(totals.totalCalcule)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={filterTab === tab.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterTab(tab.value)}
            className={
              filterTab === tab.value
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : ''
            }
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ── Payment Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[17px]">Récapitulatif des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPaiements ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredPaiements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-[15px] font-medium">Aucun paiement trouvé</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {!chantierId
                  ? 'Veuillez sélectionner un chantier.'
                  : 'Cliquez sur "Générer le récapitulatif" pour créer les paiements de la semaine.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Journalier</TableHead>
                    <TableHead className="text-center">Jours</TableHead>
                    <TableHead className="text-right">Montant calculé</TableHead>
                    <TableHead className="text-right">Montant versé</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    <TableHead>Mode paiement</TableHead>
                    <TableHead>Date paiement</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPaiements.map((p) => {
                    const ecart = (p.montantVerse || 0) - p.montantCalcule
                    const ecartColor =
                      ecart === 0
                        ? 'text-muted-foreground'
                        : ecart > 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                    return (
                      <TableRow key={p.id}>
                        {/* Journalier name */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {p.journalier.prenom[0]}
                              {p.journalier.nom[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[15px] font-medium truncate">
                                {p.journalier.prenom} {p.journalier.nom}
                              </p>
                              {p.journalier.specialite && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {p.journalier.specialite}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Days worked - calculated from tauxJournalier range */}
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            {calcDaysWorked(p)}j
                          </Badge>
                        </TableCell>

                        {/* Montant calculé */}
                        <TableCell className="text-right font-medium text-[15px]">
                          {fmtCurrency(p.montantCalcule)}
                        </TableCell>

                        {/* Montant versé */}
                        <TableCell className="text-right font-medium text-[15px]">
                          {p.montantVerse !== null
                            ? fmtCurrency(p.montantVerse)
                            : '—'}
                        </TableCell>

                        {/* Écart */}
                        <TableCell className={`text-right font-medium text-[15px] ${ecartColor}`}>
                          {p.montantVerse !== null
                            ? `${ecart >= 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR').format(ecart)}`
                            : '—'}
                        </TableCell>

                        {/* Mode paiement */}
                        <TableCell className="text-[15px]">
                          {p.modePaiement
                            ? MODE_PAIEMENT_LABELS[p.modePaiement] || p.modePaiement
                            : '—'}
                        </TableCell>

                        {/* Date paiement */}
                        <TableCell className="text-[15px]">
                          {p.datePaiement ? fmtDateShort(p.datePaiement) : '—'}
                        </TableCell>

                        {/* Statut */}
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUT_CONFIG[p.statut]?.className || ''}`}
                          >
                            {STATUT_CONFIG[p.statut]?.label || p.statut}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDetailDialog(p)}
                              title="Voir le détail"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {p.statut === 'EN_ATTENTE' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => openValidateDialog(p)}
                                  title="Valider le paiement"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => openDeleteDialog(p)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-amber-50/50 hover:bg-amber-50/50">
                    <TableCell colSpan={2} className="font-bold text-amber-900">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-900">
                      {fmtCurrency(totals.totalCalcule)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-900">
                      {totals.totalVerse > 0 ? fmtCurrency(totals.totalVerse) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold text-[15px] ${
                        totals.totalEcart === 0
                          ? 'text-muted-foreground'
                          : totals.totalEcart > 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                      }`}
                    >
                      {totals.totalVerse > 0
                        ? `${totals.totalEcart >= 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR').format(totals.totalEcart)}`
                        : '—'}
                    </TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Validate Dialog ── */}
      <Dialog open={validateOpen} onOpenChange={setValidateOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Valider le paiement
            </DialogTitle>
            <DialogDescription>
              {editingPaiement && (
                <>
                  Confirmez le paiement de{' '}
                  <strong>
                    {editingPaiement.journalier.prenom} {editingPaiement.journalier.nom}
                  </strong>{' '}
                  — Montant calculé : <strong>{fmtCurrency(editingPaiement.montantCalcule)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Montant versé */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Montant versé (FCFA)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMontant}
                  onChange={(e) => setFormMontant(e.target.value)}
                  placeholder={String(editingPaiement?.montantCalcule || 0)}
                  className="pr-14"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  FCFA
                </span>
              </div>
              {formMontant && (
                <p className="text-sm text-muted-foreground">
                  Écart :{' '}
                  <span
                    className={
                      parseFloat(formMontant) - (editingPaiement?.montantCalcule || 0) >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }
                  >
                    {fmtCurrency(
                      parseFloat(formMontant) - (editingPaiement?.montantCalcule || 0)
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* Mode de paiement */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Mode de paiement</Label>
              <Select value={formMode} onValueChange={setFormMode}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESPECES">Espèces</SelectItem>
                  <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                  <SelectItem value="VIREMENT">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date paiement */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">Date de paiement</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <Label className="text-[15px] font-medium">
                Commentaire sur la différence{' '}
                <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <Input
                type="text"
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Ex: avance déduite, matériel fourni..."
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setValidateOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              onClick={handleValidate}
              disabled={validating || !formMontant || !formDate}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              Détail du paiement
            </DialogTitle>
            <DialogDescription>
              {detailPaiement && (
                <>
                  <strong>
                    {detailPaiement.journalier.prenom} {detailPaiement.journalier.nom}
                  </strong>{' '}
                  — Semaine du {fmtDateShort(detailPaiement.semaineDebut)} au{' '}
                  {fmtDateShort(detailPaiement.semaineFin)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailPaiement && (
            <div className="space-y-4 py-2">
              {/* Status & amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm text-muted-foreground">Montant calculé</p>
                  <p className="text-xl font-bold">{fmtCurrency(detailPaiement.montantCalcule)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm text-muted-foreground">Montant versé</p>
                  <p className="text-xl font-bold">
                    {detailPaiement.montantVerse !== null
                      ? fmtCurrency(detailPaiement.montantVerse)
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUT_CONFIG[detailPaiement.statut]?.className || ''}`}
                  >
                    {STATUT_CONFIG[detailPaiement.statut]?.label || detailPaiement.statut}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Mode paiement</p>
                  <p className="text-[15px] font-medium">
                    {detailPaiement.modePaiement
                      ? MODE_PAIEMENT_LABELS[detailPaiement.modePaiement]
                      : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Date paiement</p>
                  <p className="text-[15px] font-medium">
                    {detailPaiement.datePaiement
                      ? fmtDateShort(detailPaiement.datePaiement)
                      : '—'}
                  </p>
                </div>
              </div>

              {detailPaiement.validePar && (
                <p className="text-sm text-muted-foreground">
                  Validé par : {detailPaiement.validePar.name}
                </p>
              )}

              {detailPaiement.differenceComment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-orange-700 mb-1">
                    Commentaire sur la différence
                  </p>
                  <p className="text-[15px] text-orange-800">
                    {detailPaiement.differenceComment}
                  </p>
                </div>
              )}

              <Separator />

              {/* Pointages list */}
              <div>
                <p className="text-[15px] font-medium mb-2">Pointages de la semaine</p>
                {loadingDetail ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : detailPointages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun pointage trouvé pour cette période.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {detailPointages.map((pt) => (
                      <div
                        key={pt.id}
                        className="flex items-center justify-between text-[15px] bg-muted/30 rounded-md px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">
                            {fmtDateShort(pt.dateTravail)}
                          </span>
                          {pt.valide ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Validé
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Attente
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium text-sm">
                          {fmtCurrency(pt.tauxJournalier)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer le paiement
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingPaiement && (
                <>
                  Êtes-vous sûr de vouloir supprimer le paiement de{' '}
                  <strong>
                    {deletingPaiement.journalier.prenom} {deletingPaiement.journalier.nom}
                  </strong>{' '}
                  ({fmtCurrency(deletingPaiement.montantCalcule)}) ?
                  {deletingPaiement.statut !== 'EN_ATTENTE' && (
                    <span className="block mt-2 text-red-600">
                      ⚠️ Les pointages associés seront remis en statut &quot;non validé&quot;.
                    </span>
                  )}
                  Cette action est irréversible.
                </>
              )}
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

// ── Helper: Estimate days worked from tauxJournalier ──
function calcDaysWorked(p: PaiementHebdo): number {
  // We can estimate from montantCalcule / average taux, but since we don't have
  // per-pointage data here, we return a badge based on common daily rates
  // This is a rough estimate; the detail view shows exact pointages
  if (p.montantCalcule <= 0) return 0
  // Assume common daily rates 3000-8000 FCFA, try common denominators
  const candidates = [3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000]
  for (const rate of candidates) {
    if (p.montantCalcule % rate === 0 && p.montantCalcule / rate <= 7) {
      return p.montantCalcule / rate
    }
  }
  // If no clean match, estimate ~5000/day
  return Math.max(1, Math.min(7, Math.round(p.montantCalcule / 5000)))
}
