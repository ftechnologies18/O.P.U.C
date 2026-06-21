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
  Phone,
  HardHat,
  Wrench,
  Zap,
  Droplets,
  Paintbrush,
  Users,
  UserPlus,
  UserMinus,
  Building2,
  CalendarDays,
  CheckCircle2,
  X,
  Briefcase,
  Shovel,
  Pipette,
  Hammer,
  Link,
  MoveVertical,
  TrendingUp,
  Ruler,
  Home,
  Shield,
  ShieldCheck,
  Wind,
  Layers,
  ThermometerSun,
  Sofa,
  BrushCleaning,
  Sparkles,
  GraduationCap,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Affectation {
  id: string
  chantierId: string
  dateDebut: string
  dateFin: string | null
  actif: boolean
  chantier: {
    id: string
    nom: string
    statut: string
  }
}

interface Journalier {
  id: string
  nom: string
  prenom: string
  telephone: string | null
  specialite: string | null
  photo: string | null
  typeContrat: 'JOURNALIER' | 'CDD' | 'CDI' | 'STAGIAIRE'
  tauxJournalier: number | null
  salaireMensuel: number | null
  dateDebutContrat: string | null
  dateFinContrat: string | null
  statutContrat: 'ACTIF' | 'ESSAI' | 'TERMINE' | 'SUSPENDU'
  numeroCNPS: string | null
  nbCongesRestants: number
  poste: string | null
  departement: string | null
  affectations: Affectation[]
  createdAt: string
}

interface ChantierOption {
  id: string
  nom: string
}

interface KpiData {
  total: number
  grosOeuvre: number
  enveloppe: number
  secondOeuvre: number
  nonAffecte: number
  journaliers: number
  cdd: number
  cdi: number
  stagiaires: number
}

interface JournalierFormData {
  nom: string
  prenom: string
  telephone: string
  specialite: string
  typeContrat: 'JOURNALIER' | 'CDD' | 'CDI' | 'STAGIAIRE'
  tauxJournalier: string
  salaireMensuel: string
  dateDebutContrat: string
  dateFinContrat: string
  statutContrat: 'ACTIF' | 'ESSAI' | 'TERMINE' | 'SUSPENDU'
  numeroCNPS: string
  poste: string
  departement: string
}

interface AssignFormData {
  chantierId: string
  dateDebut: string
  dateFin: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

interface SpecialtyItem {
  value: string
  label: string
  icon?: LucideIcon
}

interface PhaseGroup {
  value: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
  specialties: SpecialtyItem[]
}

const PHASE_GROUPS: PhaseGroup[] = [
  {
    value: 'GROS_OEUVRE',
    label: 'Gros Œuvre & Préparation',
    icon: HardHat,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    specialties: [
      { value: 'Terrassier', label: 'Terrassier', icon: Shovel },
      { value: 'Canalisateur VRD', label: 'Canalisateur / VRD', icon: Pipette },
      { value: 'Maçon', label: 'Maçon', icon: Wrench },
      { value: 'Coffreur-bancheur', label: 'Coffreur-bancheur', icon: Layers },
      { value: 'Ferrailleur', label: 'Ferrailleur', icon: Link },
      { value: 'Monteur d\'échafaudages', label: 'Monteur d\'échafaudages', icon: TrendingUp },
      { value: 'Grutier', label: 'Grutier', icon: MoveVertical },
    ],
  },
  {
    value: 'ENVELOPPE',
    label: 'Enveloppe Extérieure',
    icon: Home,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    specialties: [
      { value: 'Charpentier', label: 'Charpentier', icon: Hammer },
      { value: 'Couvreur / Zingueur', label: 'Couvreur / Zingueur', icon: Home },
      { value: 'Étancheur', label: 'Étancheur', icon: Shield },
      { value: 'Menuisier extérieur', label: 'Menuisier extérieur', icon: Ruler },
      { value: 'Façadier / Bardeur', label: 'Façadier / Bardeur', icon: Layers },
    ],
  },
  {
    value: 'SECOND_OEUVRE',
    label: 'Second Œuvre & Finitions',
    icon: Sparkles,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    specialties: [
      { value: 'Isolation', label: 'Isolation', icon: ThermometerSun },
      { value: 'Plâtrier', label: 'Cloisons & Plafonds (Plâtrerie)', icon: Layers },
      { value: 'Plombier', label: 'Plomberie & Sanitaires', icon: Droplets },
      { value: 'CVC', label: 'Chauffage, Ventilation, Climatisation (CVC)', icon: Wind },
      { value: 'Électricien', label: 'Électricité', icon: Zap },
      { value: 'Menuisier intérieur', label: 'Menuiserie intérieure', icon: Sofa },
      { value: 'Carreleur', label: 'Revêtements de sols et murs', icon: Ruler },
      { value: 'Peintre', label: 'Peinture et finitions', icon: Paintbrush },
      { value: 'Agenceur', label: 'Agencement et décoration', icon: BrushCleaning },
    ],
  },
]

// Flat list for backward compatibility
const ALL_SPECIALTIES: SpecialtyItem[] = PHASE_GROUPS.flatMap((g) => g.specialties)

const PHASE_FILTER_OPTIONS = [
  { value: 'TOUS', label: 'Toutes les phases' },
  { value: 'GROS_OEUVRE', label: '🏗️ Gros Œuvre' },
  { value: 'ENVELOPPE', label: '🏠 Enveloppe Extérieure' },
  { value: 'SECOND_OEUVRE', label: '🛠️ Second Œuvre' },
]

// Contract type filter options
const CONTRAT_TYPES = [
  { value: 'TOUS', label: 'Tous', icon: Users, color: 'text-gray-600' },
  { value: 'JOURNALIER', label: 'Journaliers', icon: HardHat, color: 'text-orange-600' },
  { value: 'CDD', label: 'CDD', icon: FileText, color: 'text-sky-600' },
  { value: 'CDI', label: 'CDI', icon: ShieldCheck, color: 'text-emerald-600' },
  { value: 'STAGIAIRE', label: 'Stagiaires', icon: GraduationCap, color: 'text-violet-600' },
]

const CONTRAT_BADGE: Record<string, { class: string }> = {
  JOURNALIER: { class: 'bg-orange-100 text-orange-700 border-orange-200' },
  CDD: { class: 'bg-sky-100 text-sky-700 border-sky-200' },
  CDI: { class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  STAGIAIRE: { class: 'bg-violet-100 text-violet-700 border-violet-200' },
}

const STATUT_CONTRAT_BADGE: Record<string, { class: string; label: string }> = {
  ACTIF: { class: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Actif' },
  ESSAI: { class: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Période essai' },
  TERMINE: { class: 'bg-gray-100 text-gray-500 border-gray-200', label: 'Terminé' },
  SUSPENDU: { class: 'bg-red-50 text-red-600 border-red-200', label: 'Suspendu' },
}

const CONTRAT_TYPE_LABELS: Record<string, string> = {
  JOURNALIER: 'Journalier',
  CDD: 'CDD',
  CDI: 'CDI',
  STAGIAIRE: 'Stagiaire',
}

// Get phase group for a given specialty
function getPhaseGroupForSpecialty(specialty: string | null): PhaseGroup | null {
  if (!specialty) return null
  const key = specialty.trim()
  return PHASE_GROUPS.find((g) => g.specialties.some((s) => s.value === key)) || null
}

const SPECIALTY_COLORS: Record<string, string> = {
  terrassier: 'bg-orange-100 text-orange-700 border-orange-200',
  'canalisateur vrd': 'bg-orange-100 text-orange-700 border-orange-200',
  maçon: 'bg-amber-100 text-amber-700 border-amber-200',
  macon: 'bg-amber-100 text-amber-700 border-amber-200',
  'coffreur-bancheur': 'bg-orange-100 text-orange-700 border-orange-200',
  ferrailleur: 'bg-slate-100 text-slate-700 border-slate-200',
  "monteur d'échafaudages": 'bg-orange-100 text-orange-700 border-orange-200',
  grutier: 'bg-orange-100 text-orange-700 border-orange-200',
  charpentier: 'bg-teal-100 text-teal-700 border-teal-200',
  'couvreur / zingueur': 'bg-teal-100 text-teal-700 border-teal-200',
  étancheur: 'bg-teal-100 text-teal-700 border-teal-200',
  'etancheur': 'bg-teal-100 text-teal-700 border-teal-200',
  'menuisier extérieur': 'bg-teal-100 text-teal-700 border-teal-200',
  'menuisier exterieur': 'bg-teal-100 text-teal-700 border-teal-200',
  'façadier / bardeur': 'bg-teal-100 text-teal-700 border-teal-200',
  'facadier / bardeur': 'bg-teal-100 text-teal-700 border-teal-200',
  isolation: 'bg-violet-100 text-violet-700 border-violet-200',
  plâtrier: 'bg-violet-100 text-violet-700 border-violet-200',
  platrier: 'bg-violet-100 text-violet-700 border-violet-200',
  plombier: 'bg-blue-100 text-blue-700 border-blue-200',
  cvc: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  électricien: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  electricien: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'menuisier intérieur': 'bg-violet-100 text-violet-700 border-violet-200',
  'menuisier interieur': 'bg-violet-100 text-violet-700 border-violet-200',
  carreleur: 'bg-rose-100 text-rose-700 border-rose-200',
  peintre: 'bg-purple-100 text-purple-700 border-purple-200',
  agenceur: 'bg-pink-100 text-pink-700 border-pink-200',
  // Legacy compatibility
  autre: 'bg-gray-100 text-gray-700 border-gray-200',
}

const SPECIALTY_ICONS: Record<string, LucideIcon> = {
  terrassier: Shovel,
  'canalisateur vrd': Pipette,
  maçon: Wrench,
  macon: Wrench,
  'coffreur-bancheur': Layers,
  ferrailleur: Link,
  "monteur d'échafaudages": TrendingUp,
  grutier: MoveVertical,
  charpentier: Hammer,
  'couvreur / zingueur': Home,
  étancheur: Shield,
  'etancheur': Shield,
  'menuisier extérieur': Ruler,
  'menuisier exterieur': Ruler,
  'façadier / bardeur': Layers,
  'facadier / bardeur': Layers,
  isolation: ThermometerSun,
  plâtrier: Layers,
  platrier: Layers,
  plombier: Droplets,
  cvc: Wind,
  électricien: Zap,
  electricien: Zap,
  'menuisier intérieur': Sofa,
  'menuisier interieur': Sofa,
  carreleur: Ruler,
  peintre: Paintbrush,
  agenceur: BrushCleaning,
}

const EMPTY_FORM: JournalierFormData = {
  nom: '',
  prenom: '',
  telephone: '',
  specialite: '',
  typeContrat: 'JOURNALIER',
  tauxJournalier: '',
  salaireMensuel: '',
  dateDebutContrat: '',
  dateFinContrat: '',
  statutContrat: 'ACTIF',
  numeroCNPS: '',
  poste: '',
  departement: '',
}

const EMPTY_ASSIGN: AssignFormData = {
  chantierId: '',
  dateDebut: '',
  dateFin: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(nom: string, prenom: string): string {
  return `${(nom?.[0] || '').toUpperCase()}${(prenom?.[0] || '').toUpperCase()}`
}

function getFullName(j: Journalier): string {
  return `${j.prenom} ${j.nom}`
}

function getSpecialtyBadgeClass(specialite: string | null): string {
  if (!specialite) return 'bg-gray-100 text-gray-600 border-gray-200'
  const key = specialite.toLowerCase().trim()
  return SPECIALTY_COLORS[key] || 'bg-gray-100 text-gray-600 border-gray-200'
}

function formatSpecialty(specialite: string | null): string {
  if (!specialite) return 'Non défini'
  // Capitalize first letter
  return specialite.charAt(0).toUpperCase() + specialite.slice(1)
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: fr })
  } catch {
    return '—'
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return ''
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getActiveAffectations(affectations: Affectation[]): Affectation[] {
  return affectations.filter((a) => a.actif)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PersonnelView() {
  // ── State ──────────────────────────────────────────────────────────────
  const [journaliers, setJournaliers] = useState<Journalier[]>([])
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('TOUS')
  const [phaseFilter, setPhaseFilter] = useState('TOUS')
  const [chantierFilter, setChantierFilter] = useState('TOUS')
  const [contratFilter, setContratFilter] = useState('TOUS')

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<JournalierFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assigningName, setAssigningName] = useState('')
  const [assignForm, setAssignForm] = useState<AssignFormData>(EMPTY_ASSIGN)
  const [assigning, setAssigning] = useState(false)

  // Remove assignment dialog state
  const [removeAssignOpen, setRemoveAssignOpen] = useState(false)
  const [removingInfo, setRemovingInfo] = useState<{
    journalierId: string
    chantierId: string
    chantierName: string
    journalierName: string
  } | null>(null)
  const [removing, setRemoving] = useState(false)

  // ── Fetch data ─────────────────────────────────────────────────────────

  // Compute specialty list based on phase filter
  const availableSpecialties = phaseFilter === 'TOUS'
    ? ALL_SPECIALTIES
    : PHASE_GROUPS.find((g) => g.value === phaseFilter)?.specialties || ALL_SPECIALTIES

  const fetchJournaliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (specialtyFilter !== 'TOUS') params.set('specialite', specialtyFilter)
      if (phaseFilter !== 'TOUS') {
        // Send all specialties of this phase group
        const group = PHASE_GROUPS.find((g) => g.value === phaseFilter)
        if (group) {
          group.specialties.forEach((s) => {
            params.append('specialites', s.value)
          })
        }
      }
      if (chantierFilter !== 'TOUS') params.set('chantierId', chantierFilter)
      if (contratFilter !== 'TOUS') params.set('typeContrat', contratFilter)

      const res = await fetch(`/api/v1/personnel?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setJournaliers(json.journaliers)
        setKpi(json.kpi)
      } else {
        toast.error('Erreur lors du chargement du personnel')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [search, specialtyFilter, phaseFilter, chantierFilter, contratFilter])

  const fetchChantiers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chantiers')
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
      // silently fail — chantiers are only needed for assignment dialog
    }
  }, [])

  // Reset specialty filter when phase changes
  useEffect(() => {
    setSpecialtyFilter('TOUS')
  }, [phaseFilter])

  useEffect(() => {
    fetchJournaliers()
  }, [fetchJournaliers])

  useEffect(() => {
    fetchChantiers()
  }, [fetchChantiers])

  // ── Form helpers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (j: Journalier) => {
    setEditingId(j.id)
    setForm({
      nom: j.nom,
      prenom: j.prenom,
      telephone: j.telephone || '',
      specialite: j.specialite || '',
      typeContrat: j.typeContrat || 'JOURNALIER',
      tauxJournalier: j.tauxJournalier != null ? String(j.tauxJournalier) : '',
      salaireMensuel: j.salaireMensuel != null ? String(j.salaireMensuel) : '',
      dateDebutContrat: j.dateDebutContrat ? j.dateDebutContrat.split('T')[0] : '',
      dateFinContrat: j.dateFinContrat ? j.dateFinContrat.split('T')[0] : '',
      statutContrat: j.statutContrat || 'ACTIF',
      numeroCNPS: j.numeroCNPS || '',
      poste: j.poste || '',
      departement: j.departement || '',
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.nom.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!form.prenom.trim()) {
      toast.error('Le prénom est requis')
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim() || null,
        specialite: form.specialite.trim() || null,
        typeContrat: form.typeContrat,
        statutContrat: form.statutContrat,
      }

      // Contract-type-specific fields
      if (form.typeContrat === 'JOURNALIER') {
        body.tauxJournalier = form.tauxJournalier ? parseFloat(form.tauxJournalier) : null
        body.salaireMensuel = null
      } else {
        body.salaireMensuel = form.salaireMensuel ? parseFloat(form.salaireMensuel) : null
        body.tauxJournalier = null
        body.poste = form.poste.trim() || null
        body.departement = form.departement.trim() || null
        body.numeroCNPS = form.numeroCNPS.trim() || null
        if (form.dateDebutContrat) body.dateDebutContrat = form.dateDebutContrat
        if (form.typeContrat === 'CDD' && form.dateFinContrat) {
          body.dateFinContrat = form.dateFinContrat
        } else if (form.typeContrat !== 'CDD') {
          body.dateFinContrat = null
        } else {
          body.dateFinContrat = form.dateFinContrat || null
        }
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/v1/personnel/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/personnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingId
            ? 'Personnel mis à jour avec succès'
            : 'Personnel créé avec succès'
        )
        setFormOpen(false)
        fetchJournaliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  const confirmDelete = (j: Journalier) => {
    setDeletingId(j.id)
    setDeletingName(getFullName(j))
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/v1/personnel/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Personnel supprimé avec succès')
        setDeleteOpen(false)
        setDeletingId(null)
        setDeletingName('')
        fetchJournaliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  // ── Assign to chantier ─────────────────────────────────────────────────

  const openAssign = (j: Journalier) => {
    setAssigningId(j.id)
    setAssigningName(getFullName(j))
    setAssignForm(EMPTY_ASSIGN)
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    if (!assigningId || !assignForm.chantierId) {
      toast.error('Veuillez sélectionner un chantier')
      return
    }
    if (!assignForm.dateDebut) {
      toast.error('La date de début est requise')
      return
    }

    setAssigning(true)
    try {
      const res = await fetch(`/api/v1/personnel/${assigningId}/affectations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: assignForm.chantierId,
          dateDebut: assignForm.dateDebut,
          dateFin: assignForm.dateFin || null,
        }),
      })

      if (res.ok) {
        toast.success('Personnel affecté au chantier avec succès')
        setAssignOpen(false)
        fetchJournaliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setAssigning(false)
    }
  }

  // ── Remove assignment ─────────────────────────────────────────────────

  const confirmRemoveAssign = (
    journalier: Journalier,
    affectation: Affectation
  ) => {
    setRemovingInfo({
      journalierId: journalier.id,
      chantierId: affectation.chantierId,
      chantierName: affectation.chantier.nom,
      journalierName: getFullName(journalier),
    })
    setRemoveAssignOpen(true)
  }

  const handleRemoveAssign = async () => {
    if (!removingInfo) return

    setRemoving(true)
    try {
      const res = await fetch(
        `/api/v1/personnel/${removingInfo.journalierId}/affectations?chantierId=${removingInfo.chantierId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        toast.success('Affectation retirée avec succès')
        setRemoveAssignOpen(false)
        setRemovingInfo(null)
        fetchJournaliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setRemoving(false)
    }
  }

  // ── KPI cards ─────────────────────────────────────────────────────────

  const kpiCards = kpi
    ? [
        {
          label: 'Total personnel',
          value: kpi.total,
          icon: Users,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Journaliers',
          value: kpi.journaliers,
          icon: HardHat,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
        },
        {
          label: 'CDI',
          value: kpi.cdi,
          icon: ShieldCheck,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
        {
          label: 'CDD',
          value: kpi.cdd,
          icon: FileText,
          color: 'text-sky-600',
          bg: 'bg-sky-50',
          border: 'border-sky-200',
        },
        {
          label: 'Stagiaires',
          value: kpi.stagiaires,
          icon: GraduationCap,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          border: 'border-violet-200',
        },
        {
          label: 'Non affectés',
          value: kpi.nonAffecte,
          icon: HardHat,
          color: 'text-gray-500',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────

  const isJournalierType = form.typeContrat === 'JOURNALIER'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Personnel</h2>
          <p className="text-[15px] text-muted-foreground mt-1">
            Gérez le personnel et leurs affectations
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Nouveau personnel
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.label}
              className="border shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {card.label}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-foreground">
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
                    <Icon
                      className={cn('w-4 h-4', card.color)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Contract type filter */}
      <div className="flex flex-wrap gap-2">
        {CONTRAT_TYPES.map((ct) => {
          const Icon = ct.icon
          const isActive = contratFilter === ct.value
          return (
            <Button
              key={ct.value}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setContratFilter(ct.value)}
              className={cn(
                'gap-1.5 text-xs',
                isActive
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                  : 'border-border hover:border-amber-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {ct.label}
            </Button>
          )
        })}
      </div>

      {/* Filter section */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Phase filter */}
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Phase de travail" />
              </SelectTrigger>
              <SelectContent>
                {PHASE_FILTER_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Specialty filter */}
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Spécialité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOUS">Toutes les spécialités</SelectItem>
                {phaseFilter === 'TOUS'
                  ? PHASE_GROUPS.map((group) => (
                      <SelectGroup key={group.value}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          {(() => {
                            const Icon = group.icon
                            return <Icon className="w-3 h-3" />
                          })()}
                          {group.label}
                        </SelectLabel>
                        {group.specialties.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  : availableSpecialties.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>

            {/* Chantier filter */}
            <Select value={chantierFilter} onValueChange={setChantierFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Chantier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOUS">Tous les chantiers</SelectItem>
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

      {/* Journalier list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : journaliers.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Aucun personnel trouvé
          </h3>
          <p className="text-[15px] text-muted-foreground mt-1 max-w-sm">
            {search || specialtyFilter !== 'TOUS' || phaseFilter !== 'TOUS' || chantierFilter !== 'TOUS' || contratFilter !== 'TOUS'
              ? 'Aucun personnel ne correspond à vos critères de recherche.'
              : 'Commencez par ajouter votre premier personnel.'}
          </p>
          {!search && specialtyFilter === 'TOUS' && phaseFilter === 'TOUS' && chantierFilter === 'TOUS' && contratFilter === 'TOUS' && (
            <Button
              onClick={openCreate}
              className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter du personnel
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={search + specialtyFilter + phaseFilter + chantierFilter + contratFilter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {journaliers.map((journalier, index) => {
              const activeAffectations = getActiveAffectations(
                journalier.affectations
              )
              const specialtyKey = journalier.specialite
                ?.toLowerCase()
                .trim() || ''
              const SpecialtyIcon = SPECIALTY_ICONS[specialtyKey]
              const phaseGroup = getPhaseGroupForSpecialty(journalier.specialite)
              const contratBadge = CONTRAT_BADGE[journalier.typeContrat]
              const statutBadge = journalier.statutContrat !== 'ACTIF'
                ? STATUT_CONTRAT_BADGE[journalier.statutContrat]
                : null

              return (
                <motion.div
                  key={journalier.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <Card className="border shadow-sm hover:shadow-md transition-shadow group">
                    <CardContent className="p-4">
                      {/* Main row */}
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className={cn(
                          'h-12 w-12 shrink-0 border',
                          phaseGroup
                            ? cn(phaseGroup.bg, phaseGroup.color, phaseGroup.border)
                            : journalier.typeContrat !== 'JOURNALIER'
                              ? cn(
                                  CONTRAT_BADGE[journalier.typeContrat]?.class.replace('border-', 'border-'),
                                  CONTRAT_BADGE[journalier.typeContrat]?.class.replace(/text-\S+/, '').split(' ')[0],
                                )
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                        )}>
                          <AvatarFallback className={cn(
                            'font-bold text-sm',
                            phaseGroup
                              ? cn(phaseGroup.bg, phaseGroup.color)
                              : journalier.typeContrat !== 'JOURNALIER'
                                ? CONTRAT_BADGE[journalier.typeContrat]?.class.replace('border-', '')
                                : 'bg-gray-100 text-gray-600'
                          )}>
                            {getInitials(journalier.nom, journalier.prenom)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-[15px] truncate">
                              {getFullName(journalier)}
                            </h3>
                            {/* Contract type badge */}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs shrink-0 gap-1 font-medium',
                                contratBadge?.class
                              )}
                            >
                              {CONTRAT_TYPE_LABELS[journalier.typeContrat] || journalier.typeContrat}
                            </Badge>
                            {/* Specialty badge */}
                            {journalier.specialite && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs shrink-0 gap-1',
                                  getSpecialtyBadgeClass(journalier.specialite)
                                )}
                              >
                                {SpecialtyIcon && (
                                  <SpecialtyIcon className="w-3 h-3" />
                                )}
                                {formatSpecialty(journalier.specialite)}
                              </Badge>
                            )}
                            {/* Phase group badge */}
                            {phaseGroup && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] shrink-0',
                                  phaseGroup.bg,
                                  phaseGroup.color.replace('text-', 'text-'),
                                  phaseGroup.border
                                )}
                              >
                                {phaseGroup.label}
                              </Badge>
                            )}
                            {/* Statut contrat badge (only if not ACTIF) */}
                            {statutBadge && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] shrink-0',
                                  statutBadge.class
                                )}
                              >
                                {statutBadge.label}
                              </Badge>
                            )}
                          </div>

                          {/* Poste subtitle for non-journalier types */}
                          {journalier.poste && journalier.typeContrat !== 'JOURNALIER' && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {journalier.poste}{journalier.departement ? ` — ${journalier.departement}` : ''}
                            </p>
                          )}

                          {/* Phone */}
                          {journalier.telephone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                              <Phone className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span>{journalier.telephone}</span>
                            </div>
                          )}

                          {/* Salary display */}
                          {(journalier.typeContrat === 'JOURNALIER' && journalier.tauxJournalier) && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <Briefcase className="w-3 h-3 shrink-0 text-orange-500" />
                              <span className="font-medium text-orange-700">
                                {formatCurrency(journalier.tauxJournalier)}/jour
                              </span>
                            </div>
                          )}
                          {(journalier.typeContrat !== 'JOURNALIER' && journalier.salaireMensuel) && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <Briefcase className="w-3 h-3 shrink-0 text-emerald-500" />
                              <span className="font-medium text-emerald-700">
                                {formatCurrency(journalier.salaireMensuel)}/mois
                              </span>
                            </div>
                          )}

                          {/* Contract dates for non-journalier */}
                          {journalier.typeContrat !== 'JOURNALIER' && journalier.dateDebutContrat && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <CalendarDays className="w-3 h-3 shrink-0" />
                              <span>
                                {formatDate(journalier.dateDebutContrat)}
                                {journalier.dateFinContrat && ` → ${formatDate(journalier.dateFinContrat)}`}
                                {!journalier.dateFinContrat && ' → en cours'}
                              </span>
                            </div>
                          )}

                          {/* Active affectations */}
                          {activeAffectations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {activeAffectations.map((affectation) => (
                                <div
                                  key={affectation.id}
                                  className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 text-xs text-emerald-700 group/aff"
                                >
                                  <Building2 className="w-3 h-3" />
                                  <span className="font-medium truncate max-w-[140px]">
                                    {affectation.chantier.nom}
                                  </span>
                                  <span className="text-emerald-500">
                                    {formatDate(affectation.dateDebut)}
                                    {affectation.dateFin
                                      ? ` → ${formatDate(affectation.dateFin)}`
                                      : ' → en cours'}
                                  </span>
                                  <button
                                    onClick={() =>
                                      confirmRemoveAssign(
                                        journalier,
                                        affectation
                                      )
                                    }
                                    className="ml-0.5 opacity-0 group-hover/aff:opacity-100 transition-opacity text-emerald-500 hover:text-red-500"
                                    title="Retirer l'affectation"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {activeAffectations.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 mt-1 italic">
                              Non affecté
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600"
                            onClick={() => openAssign(journalier)}
                            title="Affecter à un chantier"
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600"
                            onClick={() => openEdit(journalier)}
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => confirmDelete(journalier)}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Create/Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => !open && setFormOpen(false)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le personnel' : 'Nouveau personnel'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du personnel ci-dessous.'
                : 'Remplissez les informations pour ajouter un nouveau membre du personnel.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Nom / Prénom */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  placeholder="Ex: Diallo"
                  value={form.nom}
                  onChange={(e) =>
                    setForm({ ...form, nom: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  placeholder="Ex: Mamadou"
                  value={form.prenom}
                  onChange={(e) =>
                    setForm({ ...form, prenom: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Telephone */}
            <div className="grid gap-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                placeholder="Ex: +243 812 345 678"
                value={form.telephone}
                onChange={(e) =>
                  setForm({ ...form, telephone: e.target.value })
                }
              />
            </div>

            {/* Type de contrat */}
            <div className="grid gap-2">
              <Label>Type de contrat *</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRAT_TYPES.filter((ct) => ct.value !== 'TOUS').map((ct) => {
                  const Icon = ct.icon
                  const isActive = form.typeContrat === ct.value
                  return (
                    <Button
                      key={ct.value}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm({ ...form, typeContrat: ct.value as JournalierFormData['typeContrat'] })}
                      className={cn(
                        'gap-1.5 text-xs',
                        isActive
                          ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                          : 'border-border hover:border-amber-300'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {ct.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* JOURNALIER-specific fields */}
            {isJournalierType && (
              <>
                {/* Spécialité (required for journalier) */}
                <div className="grid gap-2">
                  <Label>Spécialité</Label>
                  <Select
                    value={form.specialite}
                    onValueChange={(value) =>
                      setForm({ ...form, specialite: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner une spécialité" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE_GROUPS.map((group) => (
                        <SelectGroup key={group.value}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            {(() => {
                              const Icon = group.icon
                              return <Icon className="w-3 h-3" />
                            })()}
                            {group.label}
                          </SelectLabel>
                          {group.specialties.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Taux journalier */}
                <div className="grid gap-2">
                  <Label htmlFor="tauxJournalier" className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                    Taux journalier (FCFA)
                  </Label>
                  <Input
                    id="tauxJournalier"
                    type="number"
                    placeholder="Ex: 15000"
                    value={form.tauxJournalier}
                    onChange={(e) =>
                      setForm({ ...form, tauxJournalier: e.target.value })
                    }
                    min="0"
                  />
                </div>
              </>
            )}

            {/* CDD / CDI / STAGIAIRE-specific fields */}
            {!isJournalierType && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Poste */}
                  <div className="grid gap-2">
                    <Label htmlFor="poste">Poste</Label>
                    <Input
                      id="poste"
                      placeholder="Ex: Chef d'équipe"
                      value={form.poste}
                      onChange={(e) =>
                        setForm({ ...form, poste: e.target.value })
                      }
                    />
                  </div>
                  {/* Département */}
                  <div className="grid gap-2">
                    <Label htmlFor="departement">Département</Label>
                    <Input
                      id="departement"
                      placeholder="Ex: Production"
                      value={form.departement}
                      onChange={(e) =>
                        setForm({ ...form, departement: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Spécialité (optional for non-journalier) */}
                <div className="grid gap-2">
                  <Label>Spécialité</Label>
                  <Select
                    value={form.specialite}
                    onValueChange={(value) =>
                      setForm({ ...form, specialite: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner une spécialité (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE_GROUPS.map((group) => (
                        <SelectGroup key={group.value}>
                          <SelectLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            {(() => {
                              const Icon = group.icon
                              return <Icon className="w-3 h-3" />
                            })()}
                            {group.label}
                          </SelectLabel>
                          {group.specialties.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Salaire mensuel */}
                <div className="grid gap-2">
                  <Label htmlFor="salaireMensuel" className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                    Salaire mensuel (FCFA)
                  </Label>
                  <Input
                    id="salaireMensuel"
                    type="number"
                    placeholder="Ex: 350000"
                    value={form.salaireMensuel}
                    onChange={(e) =>
                      setForm({ ...form, salaireMensuel: e.target.value })
                    }
                    min="0"
                  />
                </div>

                {/* Contract dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dateDebutContrat" className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                      Date début contrat
                    </Label>
                    <Input
                      id="dateDebutContrat"
                      type="date"
                      value={form.dateDebutContrat}
                      onChange={(e) =>
                        setForm({ ...form, dateDebutContrat: e.target.value })
                      }
                    />
                  </div>
                  {/* Date fin only for CDD */}
                  {form.typeContrat === 'CDD' && (
                    <div className="grid gap-2">
                      <Label htmlFor="dateFinContrat" className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                        Date fin contrat
                      </Label>
                      <Input
                        id="dateFinContrat"
                        type="date"
                        value={form.dateFinContrat}
                        onChange={(e) =>
                          setForm({ ...form, dateFinContrat: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* N° CNPS */}
                <div className="grid gap-2">
                  <Label htmlFor="numeroCNPS">N° CNPS</Label>
                  <Input
                    id="numeroCNPS"
                    placeholder="Ex: CNPS-2024-001"
                    value={form.numeroCNPS}
                    onChange={(e) =>
                      setForm({ ...form, numeroCNPS: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <Separator />

            {/* Statut contrat (always shown) */}
            <div className="grid gap-2">
              <Label>Statut du contrat</Label>
              <Select
                value={form.statutContrat}
                onValueChange={(value) =>
                  setForm({ ...form, statutContrat: value as JournalierFormData['statutContrat'] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Statut du contrat" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUT_CONTRAT_BADGE).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {editingId ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {editingId ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deletingName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à ce
              membre du personnel (affectations, pointages, paiements) seront
              supprimées définitivement.
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

      {/* ── Assign to Chantier Dialog ────────────────────────────────────── */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => !open && setAssignOpen(false)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              Affecter {assigningName}
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un chantier et les dates d&apos;affectation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Chantier select */}
            <div className="grid gap-2">
              <Label>Chantier *</Label>
              <Select
                value={assignForm.chantierId}
                onValueChange={(value) =>
                  setAssignForm({ ...assignForm, chantierId: value })
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

            <Separator />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateDebut" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  Date de début *
                </Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={assignForm.dateDebut}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      dateDebut: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateFin" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                  Date de fin
                </Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={assignForm.dateFin}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      dateFin: e.target.value,
                    })
                  }
                  placeholder="Optionnelle"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              * La date de fin est optionnelle. L&apos;affectation restera active
              jusqu&apos;à sa suppression manuelle.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !assignForm.chantierId || !assignForm.dateDebut}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {assigning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Affectation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Affecter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Assignment Dialog ────────────────────────────────────── */}
      <AlertDialog
        open={removeAssignOpen}
        onOpenChange={(open) => !open && setRemoveAssignOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-red-500" />
              Retirer l&apos;affectation ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous retirer{' '}
              <span className="font-semibold text-foreground">
                {removingInfo?.journalierName}
              </span>{' '}
              du chantier{' '}
              <span className="font-semibold text-foreground">
                {removingInfo?.chantierName}
              </span>{' '}
              ? L&apos;affectation sera désactivée à la date du jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAssign}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Retrait...
                </>
              ) : (
                <>
                  <UserMinus className="w-4 h-4" />
                  Retirer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
