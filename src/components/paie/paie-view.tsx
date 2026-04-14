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
  Pencil,
  Search,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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

// ── Monthly Salary Types ───────────────────────────────
interface SalJournalier {
  nom: string
  prenom: string
  specialite?: string | null
  typeContrat?: string | null
  poste?: string | null
  departement?: string | null
}

interface SalaireMensuel {
  id: string
  journalierId: string
  mois: number
  annee: number
  salaireBase: number
  primes: number
  heuresSupp: number
  montantHeuresSupp: number
  retenuesCNPS: number
  retenuesIR: number
  avances: number
  absences: number
  retenueAbsences: number
  netAPayer: number
  statut: string
  datePaiement: string | null
  modePaiement: string | null
  observation: string | null
  valideParId: string | null
  createdAt: string
  updatedAt: string
  journalier: SalJournalier
  validePar: ValidePar | null
}

interface SalKpi {
  totalSalaires: number
  enAttente: number
  payes: number
  partiel: number
  masseTotale: number
  massePayee: number
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

// ── Monthly Salary Constants ──────────────────────────
const MOIS_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const SAL_STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  EN_ATTENTE: {
    label: 'En attente',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  PAYE: {
    label: 'Payé',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PARTIEL: {
    label: 'Partiel',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
}

const SAL_FILTER_TABS = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'PAYE', label: 'Payés' },
  { value: 'PARTIEL', label: 'Partiels' },
]

const TYPE_CONTRAT_BADGE: Record<string, { className: string; label: string }> = {
  CDD: { className: 'bg-blue-50 text-blue-700 border-blue-200', label: 'CDD' },
  CDI: { className: 'bg-violet-50 text-violet-700 border-violet-200', label: 'CDI' },
  STAGIAIRE: { className: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Stagiaire' },
}

// ── Helper: Estimate days worked from tauxJournalier ──
function calcDaysWorked(p: PaiementHebdo): number {
  if (p.montantCalcule <= 0) return 0
  const candidates = [3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000]
  for (const rate of candidates) {
    if (p.montantCalcule % rate === 0 && p.montantCalcule / rate <= 7) {
      return p.montantCalcule / rate
    }
  }
  return Math.max(1, Math.min(7, Math.round(p.montantCalcule / 5000)))
}

// ── Main Component ─────────────────────────────────────
export function PaieView() {
  const { data: session } = useSession()
  const { selectedChantierId, setSelectedChantierId } = useAppStore()

  const userId = (session?.user as { id?: string })?.id || ''

  // ══════════════════════════════════════════════════════
  // WEEKLY STATE (existing)
  // ══════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════
  // MONTHLY STATE
  // ══════════════════════════════════════════════════════

  const now = new Date()
  const [salMois, setSalMois] = useState<number>(now.getMonth() + 1)
  const [salAnnee, setSalAnnee] = useState<number>(now.getFullYear())
  const [salFilter, setSalFilter] = useState<string>('TOUS')
  const [salSearch, setSalSearch] = useState<string>('')

  const [salaires, setSalaires] = useState<SalaireMensuel[]>([])
  const [salKpi, setSalKpi] = useState<SalKpi>({
    totalSalaires: 0, enAttente: 0, payes: 0, partiel: 0, masseTotale: 0, massePayee: 0,
  })

  const [salLoading, setSalLoading] = useState(false)
  const [salGenerating, setSalGenerating] = useState(false)

  // Sal edit dialog
  const [salEditOpen, setSalEditOpen] = useState(false)
  const [salEditItem, setSalEditItem] = useState<SalaireMensuel | null>(null)
  const [salEditSaving, setSalEditSaving] = useState(false)
  const [salForm, setSalForm] = useState({
    salaireBase: 0,
    primes: 0,
    heuresSupp: 0,
    montantHeuresSupp: 0,
    retenuesCNPS: 0,
    retenuesIR: 0,
    avances: 0,
    absences: 0,
    retenueAbsences: 0,
  })

  // Sal validate dialog
  const [salValidateOpen, setSalValidateOpen] = useState(false)
  const [salValidateItem, setSalValidateItem] = useState<SalaireMensuel | null>(null)
  const [salValidating, setSalValidating] = useState(false)
  const [salValidateMontant, setSalValidateMontant] = useState('')
  const [salValidateMode, setSalValidateMode] = useState('ESPECES')
  const [salValidateDate, setSalValidateDate] = useState('')
  const [salValidateObs, setSalValidateObs] = useState('')

  // Sal delete dialog
  const [salDeleteOpen, setSalDeleteOpen] = useState(false)
  const [salDeleteItem, setSalDeleteItem] = useState<SalaireMensuel | null>(null)
  const [salDeleting, setSalDeleting] = useState(false)

  // ══════════════════════════════════════════════════════
  // WEEKLY FUNCTIONS (existing)
  // ══════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════
  // MONTHLY SALARY FUNCTIONS
  // ══════════════════════════════════════════════════════

  // ── Fetch salaires ──────────────────────────────────
  const loadSalaires = useCallback(async () => {
    setSalLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('mois', String(salMois))
      params.set('annee', String(salAnnee))
      if (salFilter !== 'TOUS') params.set('statut', salFilter)
      if (salSearch.trim()) params.set('search', salSearch.trim())

      const res = await fetch(`/api/salaires?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSalaires(data.salaires || [])
        setSalKpi(data.kpi || {
          totalSalaires: 0, enAttente: 0, payes: 0, partiel: 0, masseTotale: 0, massePayee: 0,
        })
      }
    } catch {
      toast.error('Erreur lors du chargement des salaires')
    } finally {
      setSalLoading(false)
    }
  }, [salMois, salAnnee, salFilter, salSearch])

  useEffect(() => {
    loadSalaires()
  }, [loadSalaires])

  // ── Generate monthly fiches ─────────────────────────
  async function handleSalGenerate() {
    setSalGenerating(true)
    try {
      const body: { mois: number; annee: number; chantierId?: string } = {
        mois: salMois,
        annee: salAnnee,
      }
      if (chantierId) body.chantierId = chantierId

      const res = await fetch('/api/salaires/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la génération')
      }

      const data = await res.json()
      const created = data.created || 0
      const skipped = data.skipped || 0

      if (created > 0) {
        toast.success(`${created} fiche(s) de salaire générée(s) avec succès !`)
      } else if (skipped > 0) {
        toast.info(`${skipped} fiche(s) existante(s) — aucun changement.`)
      } else {
        toast.info(data.message || 'Aucun employé éligible trouvé.')
      }

      loadSalaires()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setSalGenerating(false)
    }
  }

  // ── Open sal edit dialog ────────────────────────────
  function openSalEditDialog(sal: SalaireMensuel) {
    setSalEditItem(sal)
    setSalForm({
      salaireBase: sal.salaireBase,
      primes: sal.primes,
      heuresSupp: sal.heuresSupp,
      montantHeuresSupp: sal.montantHeuresSupp,
      retenuesCNPS: sal.retenuesCNPS,
      retenuesIR: sal.retenuesIR,
      avances: sal.avances,
      absences: sal.absences,
      retenueAbsences: sal.retenueAbsences,
    })
    setSalEditOpen(true)
  }

  // ── Save sal edit ───────────────────────────────────
  async function handleSalEdit() {
    if (!salEditItem) return
    setSalEditSaving(true)
    try {
      const res = await fetch(`/api/salaires/${salEditItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la mise à jour')
      }
      toast.success('Fiche de salaire mise à jour')
      setSalEditOpen(false)
      loadSalaires()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
    } finally {
      setSalEditSaving(false)
    }
  }

  // ── Open sal validate dialog ────────────────────────
  function openSalValidateDialog(sal: SalaireMensuel) {
    setSalValidateItem(sal)
    setSalValidateMontant(String(sal.netAPayer))
    setSalValidateMode('ESPECES')
    setSalValidateDate(format(new Date(), 'yyyy-MM-dd'))
    setSalValidateObs(sal.observation || '')
    setSalValidateOpen(true)
  }

  // ── Validate sal payment ────────────────────────────
  async function handleSalValidate() {
    if (!salValidateItem) return
    const montant = parseFloat(salValidateMontant)
    if (isNaN(montant) || montant < 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }
    if (!salValidateDate) {
      toast.error('Veuillez sélectionner une date de paiement')
      return
    }

    setSalValidating(true)
    try {
      const res = await fetch(`/api/salaires/${salValidateItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          netAPayer: montant,
          modePaiement: salValidateMode,
          datePaiement: salValidateDate,
          observation: salValidateObs || null,
          valideParId: userId,
          statut: montant >= salValidateItem.netAPayer ? 'PAYE' : 'PARTIEL',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la validation')
      }
      toast.success(
        montant >= salValidateItem.netAPayer
          ? 'Salaire payé avec succès !'
          : `Paiement partiel de ${fmtCurrency(montant)} enregistré`
      )
      setSalValidateOpen(false)
      loadSalaires()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation')
    } finally {
      setSalValidating(false)
    }
  }

  // ── Open sal delete dialog ──────────────────────────
  function openSalDeleteDialog(sal: SalaireMensuel) {
    setSalDeleteItem(sal)
    setSalDeleteOpen(true)
  }

  // ── Delete salaire ──────────────────────────────────
  async function handleSalDelete() {
    if (!salDeleteItem) return
    setSalDeleting(true)
    try {
      const res = await fetch(`/api/salaires/${salDeleteItem.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      toast.success('Fiche de salaire supprimée')
      setSalDeleteOpen(false)
      loadSalaires()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setSalDeleting(false)
    }
  }

  // ── Computed: filtered salaires ─────────────────────
  const filteredSalaires = useMemo(() => {
    if (salFilter === 'TOUS') return salaires
    return salaires.filter((s) => s.statut === salFilter)
  }, [salaires, salFilter])

  // ── Computed: sal form netAPayer ────────────────────
  const salFormNet = useMemo(() => {
    return salForm.salaireBase
      + salForm.primes
      + salForm.montantHeuresSupp
      - salForm.retenuesCNPS
      - salForm.retenuesIR
      - salForm.avances
      - salForm.retenueAbsences
  }, [salForm])

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

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
          Gestion de la Paie
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Gestion des paiements hebdomadaires et salaires mensuels
        </p>
      </div>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="hebdomadaire" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="hebdomadaire" className="gap-1.5">
            <CalendarDays className="w-4 h-4" />
            Paie Hebdomadaire
          </TabsTrigger>
          <TabsTrigger value="mensuel" className="gap-1.5">
            <Wallet className="w-4 h-4" />
            Salaires Mensuels
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════ */}
        {/* TAB 1: PAIE HEBDOMADAIRE (existing content)   */}
        {/* ══════════════════════════════════════════════ */}
        <TabsContent value="hebdomadaire" className="space-y-6">

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

                            {/* Days worked */}
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

          {/* ── Validate Dialog (weekly) ── */}
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

          {/* ── Detail Dialog (weekly) ── */}
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

          {/* ── Delete Confirmation (weekly) ── */}
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

        </TabsContent>

        {/* ══════════════════════════════════════════════ */}
        {/* TAB 2: SALAIRES MENSUELS                       */}
        {/* ══════════════════════════════════════════════ */}
        <TabsContent value="mensuel" className="space-y-6">

          {/* ── Monthly Selection Card ── */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Mois selector */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Mois</Label>
                  <Select
                    value={String(salMois)}
                    onValueChange={(v) => setSalMois(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOIS_NAMES.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Année selector */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Année</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSalAnnee((a) => a - 1)}
                      className="h-9 w-9 shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 flex items-center justify-center px-3 py-2 rounded-md border bg-muted/50 text-[15px] font-medium">
                      {salAnnee}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSalAnnee((a) => a + 1)}
                      className="h-9 w-9 shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Generate button */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Fiches de salaire</Label>
                  <Button
                    onClick={handleSalGenerate}
                    disabled={salGenerating}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {salGenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Générer les fiches
                  </Button>
                </div>

                {/* Info box */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Résumé</Label>
                  <div className="text-[15px] text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>{salKpi.totalSalaires} salarié(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{salKpi.enAttente} en attente</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-semibold">{fmtCurrency(salKpi.masseTotale)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Search bar + Filter tabs ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Rechercher un employé..."
                value={salSearch}
                onChange={(e) => setSalSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Filter tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {SAL_FILTER_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={salFilter === tab.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalFilter(tab.value)}
                  className={
                    salFilter === tab.value
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : ''
                  }
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {/* ── Salary Table ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[17px]">
                Salaires — {MOIS_NAMES[salMois - 1]} {salAnnee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredSalaires.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="w-10 h-10 text-muted-foreground mb-3" />
                  <h3 className="text-[15px] font-medium">Aucun salaire trouvé</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cliquez sur &quot;Générer les fiches&quot; pour créer les fiches de salaire de{' '}
                    {MOIS_NAMES[salMois - 1]} {salAnnee}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Poste</TableHead>
                        <TableHead className="text-right">Salaire base</TableHead>
                        <TableHead className="text-right">Primes</TableHead>
                        <TableHead className="text-right">H. sup.</TableHead>
                        <TableHead className="text-right">Absences</TableHead>
                        <TableHead className="text-right">Retenues</TableHead>
                        <TableHead className="text-right">Net à payer</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSalaires.map((sal) => {
                        const totalRetenues = sal.retenuesCNPS + sal.retenuesIR + sal.avances + sal.retenueAbsences
                        return (
                          <TableRow key={sal.id}>
                            {/* Employé */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {sal.journalier.prenom[0]}
                                  {sal.journalier.nom[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[15px] font-medium truncate">
                                    {sal.journalier.prenom} {sal.journalier.nom}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    {sal.journalier.specialite && (
                                      <span className="text-sm text-muted-foreground truncate">
                                        {sal.journalier.specialite}
                                      </span>
                                    )}
                                    {sal.journalier.typeContrat && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${
                                          TYPE_CONTRAT_BADGE[sal.journalier.typeContrat]?.className || ''
                                        }`}
                                      >
                                        {TYPE_CONTRAT_BADGE[sal.journalier.typeContrat]?.label || sal.journalier.typeContrat}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Poste */}
                            <TableCell className="text-[15px] text-muted-foreground">
                              {sal.journalier.poste || sal.journalier.departement || '—'}
                            </TableCell>

                            {/* Salaire base */}
                            <TableCell className="text-right font-medium text-[15px]">
                              {fmtCurrency(sal.salaireBase)}
                            </TableCell>

                            {/* Primes */}
                            <TableCell className="text-right text-[15px] text-emerald-600">
                              {sal.primes > 0 ? `+${fmtCurrency(sal.primes)}` : '—'}
                            </TableCell>

                            {/* Heures sup */}
                            <TableCell className="text-right text-[15px]">
                              {sal.heuresSupp > 0 ? (
                                <span className="text-blue-600">
                                  {sal.heuresSupp}h ({fmtCurrency(sal.montantHeuresSupp)})
                                </span>
                              ) : '—'}
                            </TableCell>

                            {/* Absences */}
                            <TableCell className="text-center text-[15px]">
                              {sal.absences > 0 ? (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  {sal.absences}j
                                </Badge>
                              ) : '—'}
                            </TableCell>

                            {/* Retenues */}
                            <TableCell className="text-right text-[15px] text-red-600">
                              {totalRetenues > 0 ? `−${fmtCurrency(totalRetenues)}` : '—'}
                            </TableCell>

                            {/* Net à payer */}
                            <TableCell className="text-right">
                              <span className="font-bold text-[15px] text-amber-700">
                                {fmtCurrency(sal.netAPayer)}
                              </span>
                            </TableCell>

                            {/* Statut */}
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs ${SAL_STATUT_CONFIG[sal.statut]?.className || ''}`}
                              >
                                {SAL_STATUT_CONFIG[sal.statut]?.label || sal.statut}
                              </Badge>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openSalEditDialog(sal)}
                                  title="Modifier la fiche"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {sal.statut === 'EN_ATTENTE' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => openSalValidateDialog(sal)}
                                      title="Valider le paiement"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => openSalDeleteDialog(sal)}
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
                          Total ({filteredSalaires.length})
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-900">
                          {fmtCurrency(filteredSalaires.reduce((s, r) => s + r.salaireBase, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {fmtCurrency(filteredSalaires.reduce((s, r) => s + r.primes, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {fmtCurrency(filteredSalaires.reduce((s, r) => s + r.montantHeuresSupp, 0))}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold text-red-600">
                          {fmtCurrency(filteredSalaires.reduce((s, r) => s + r.retenuesCNPS + r.retenuesIR + r.avances + r.retenueAbsences, 0))}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-900 text-[15px]">
                          {fmtCurrency(filteredSalaires.reduce((s, r) => s + r.netAPayer, 0))}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Edit Salary Dialog ── */}
          <Dialog open={salEditOpen} onOpenChange={setSalEditOpen}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-amber-500" />
                  Modifier la fiche de salaire
                </DialogTitle>
                <DialogDescription>
                  {salEditItem && (
                    <>
                      <strong>
                        {salEditItem.journalier.prenom} {salEditItem.journalier.nom}
                      </strong>{' '}
                      — {MOIS_NAMES[salEditItem.mois - 1]} {salEditItem.annee}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Salaire de base */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Salaire de base (FCFA)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={salForm.salaireBase}
                      onChange={(e) => setSalForm((f) => ({ ...f, salaireBase: Number(e.target.value) || 0 }))}
                      className="pr-14"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      FCFA
                    </span>
                  </div>
                </div>

                {/* Primes */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Primes (FCFA)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={salForm.primes}
                      onChange={(e) => setSalForm((f) => ({ ...f, primes: Number(e.target.value) || 0 }))}
                      className="pr-14"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      FCFA
                    </span>
                  </div>
                </div>

                {/* Heures supplémentaires */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Heures sup (h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={salForm.heuresSupp}
                      onChange={(e) => setSalForm((f) => ({ ...f, heuresSupp: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Montant h. sup (FCFA)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={salForm.montantHeuresSupp}
                        onChange={(e) => setSalForm((f) => ({ ...f, montantHeuresSupp: Number(e.target.value) || 0 }))}
                        className="pr-14"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        FCFA
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Retenues */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Retenues CNPS (FCFA)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={salForm.retenuesCNPS}
                        onChange={(e) => setSalForm((f) => ({ ...f, retenuesCNPS: Number(e.target.value) || 0 }))}
                        className="pr-14"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        FCFA
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Retenues IR (FCFA)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={salForm.retenuesIR}
                        onChange={(e) => setSalForm((f) => ({ ...f, retenuesIR: Number(e.target.value) || 0 }))}
                        className="pr-14"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        FCFA
                      </span>
                    </div>
                  </div>
                </div>

                {/* Avances */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Avances / acomptes (FCFA)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={salForm.avances}
                      onChange={(e) => setSalForm((f) => ({ ...f, avances: Number(e.target.value) || 0 }))}
                      className="pr-14"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      FCFA
                    </span>
                  </div>
                </div>

                {/* Absences */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Jours d&apos;absence</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={salForm.absences}
                      onChange={(e) => setSalForm((f) => ({ ...f, absences: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[15px] font-medium">Retenue absences (FCFA)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={salForm.retenueAbsences}
                        onChange={(e) => setSalForm((f) => ({ ...f, retenueAbsences: Number(e.target.value) || 0 }))}
                        className="pr-14"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        FCFA
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Net à payer - calculated */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-amber-800">Net à payer</span>
                    <span className="text-xl font-bold text-amber-700">
                      {fmtCurrency(salFormNet)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Base + Primes + H.sup − CNPS − IR − Avances − Absences
                  </p>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSalEditOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSalEdit}
                  disabled={salEditSaving}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {salEditSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Validate Salary Payment Dialog ── */}
          <Dialog open={salValidateOpen} onOpenChange={setSalValidateOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Valider le paiement du salaire
                </DialogTitle>
                <DialogDescription>
                  {salValidateItem && (
                    <>
                      Confirmez le paiement de{' '}
                      <strong>
                        {salValidateItem.journalier.prenom} {salValidateItem.journalier.nom}
                      </strong>{' '}
                      — Net à payer : <strong>{fmtCurrency(salValidateItem.netAPayer)}</strong>
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
                      step="1"
                      min="0"
                      value={salValidateMontant}
                      onChange={(e) => setSalValidateMontant(e.target.value)}
                      className="pr-14"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      FCFA
                    </span>
                  </div>
                  {salValidateMontant && salValidateItem && (
                    <p className="text-sm text-muted-foreground">
                      Écart :{' '}
                      <span
                        className={
                          parseFloat(salValidateMontant) - salValidateItem.netAPayer >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }
                      >
                        {fmtCurrency(parseFloat(salValidateMontant) - salValidateItem.netAPayer)}
                      </span>
                      {parseFloat(salValidateMontant) < salValidateItem.netAPayer && (
                        <span className="block text-xs text-orange-600 mt-0.5">
                          Le paiement sera marqué comme partiel
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Mode de paiement */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">Mode de paiement</Label>
                  <Select value={salValidateMode} onValueChange={setSalValidateMode}>
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
                    value={salValidateDate}
                    onChange={(e) => setSalValidateDate(e.target.value)}
                  />
                </div>

                {/* Observation */}
                <div className="space-y-2">
                  <Label className="text-[15px] font-medium">
                    Observation{' '}
                    <span className="text-muted-foreground font-normal">(optionnel)</span>
                  </Label>
                  <Textarea
                    value={salValidateObs}
                    onChange={(e) => setSalValidateObs(e.target.value)}
                    placeholder="Observations éventuelles..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSalValidateOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSalValidate}
                  disabled={salValidating || !salValidateMontant || !salValidateDate}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {salValidating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Confirmer le paiement
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Delete Salary Confirmation ── */}
          <AlertDialog open={salDeleteOpen} onOpenChange={setSalDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  Supprimer la fiche de salaire
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {salDeleteItem && (
                    <>
                      Êtes-vous sûr de vouloir supprimer la fiche de salaire de{' '}
                      <strong>
                        {salDeleteItem.journalier.prenom} {salDeleteItem.journalier.nom}
                      </strong>{' '}
                      ({MOIS_NAMES[salDeleteItem.mois - 1]} {salDeleteItem.annee}, {fmtCurrency(salDeleteItem.netAPayer)}) ?
                      {salDeleteItem.statut !== 'EN_ATTENTE' && (
                        <span className="block mt-2 text-red-600">
                          ⚠️ Cette fiche a déjà été traitée.
                        </span>
                      )}
                      Cette action est irréversible.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={salDeleting}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSalDelete}
                  disabled={salDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {salDeleting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </TabsContent>
      </Tabs>
    </div>
  )
}
