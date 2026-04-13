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
  SelectItem,
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
  affectations: Affectation[]
  createdAt: string
}

interface ChantierOption {
  id: string
  nom: string
}

interface KpiData {
  total: number
  macons: number
  ferrailleurs: number
  electriciens: number
  autres: number
}

interface JournalierFormData {
  nom: string
  prenom: string
  telephone: string
  specialite: string
}

interface AssignFormData {
  chantierId: string
  dateDebut: string
  dateFin: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALTIES = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'Maçon', label: 'Maçon' },
  { value: 'Ferrailleur', label: 'Ferrailleur' },
  { value: 'Électricien', label: 'Électricien' },
  { value: 'Plombier', label: 'Plombier' },
  { value: 'Peintre', label: 'Peintre' },
  { value: 'Autre', label: 'Autre' },
]

const SPECIALTY_COLORS: Record<string, string> = {
  maçon: 'bg-amber-100 text-amber-700 border-amber-200',
  'macon': 'bg-amber-100 text-amber-700 border-amber-200',
  ferrailleur: 'bg-slate-100 text-slate-700 border-slate-200',
  électricien: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'electricien': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  plombier: 'bg-blue-100 text-blue-700 border-blue-200',
  peintre: 'bg-purple-100 text-purple-700 border-purple-200',
  autre: 'bg-gray-100 text-gray-700 border-gray-200',
}

const SPECIALTY_ICONS: Record<string, typeof Wrench> = {
  maçon: Wrench,
  macon: Wrench,
  ferrailleur: Briefcase,
  électricien: Zap,
  electricien: Zap,
  plombier: Droplets,
  peintre: Paintbrush,
}

const EMPTY_FORM: JournalierFormData = {
  nom: '',
  prenom: '',
  telephone: '',
  specialite: '',
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
  const [chantierFilter, setChantierFilter] = useState('TOUS')

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

  const fetchJournaliers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (specialtyFilter !== 'TOUS') params.set('specialite', specialtyFilter)
      if (chantierFilter !== 'TOUS') params.set('chantierId', chantierFilter)

      const res = await fetch(`/api/personnel?${params.toString()}`)
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
  }, [search, specialtyFilter, chantierFilter])

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
      // silently fail — chantiers are only needed for assignment dialog
    }
  }, [])

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
      const body = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim() || null,
        specialite: form.specialite.trim() || null,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/personnel/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/personnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingId
            ? 'Journalier mis à jour avec succès'
            : 'Journalier créé avec succès'
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
      const res = await fetch(`/api/personnel/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Journalier supprimé avec succès')
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
      const res = await fetch(`/api/personnel/${assigningId}/affectations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chantierId: assignForm.chantierId,
          dateDebut: assignForm.dateDebut,
          dateFin: assignForm.dateFin || null,
        }),
      })

      if (res.ok) {
        toast.success('Journalier affecté au chantier avec succès')
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
        `/api/personnel/${removingInfo.journalierId}/affectations?chantierId=${removingInfo.chantierId}`,
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
          label: 'Total journaliers',
          value: kpi.total,
          icon: Users,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Maçons',
          value: kpi.macons,
          icon: Wrench,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
        },
        {
          label: 'Ferrailleurs',
          value: kpi.ferrailleurs,
          icon: Briefcase,
          color: 'text-slate-600',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
        },
        {
          label: 'Électriciens',
          value: kpi.electriciens,
          icon: Zap,
          color: 'text-yellow-600',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
        },
        {
          label: 'Autres',
          value: kpi.autres,
          icon: HardHat,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Personnel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les journaliers et leurs affectations
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Nouveau journalier
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    <p className="text-xs text-muted-foreground font-medium">
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

            {/* Specialty filter */}
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Spécialité" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
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
          <h3 className="text-lg font-semibold text-foreground">
            Aucun journalier trouvé
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search || specialtyFilter !== 'TOUS' || chantierFilter !== 'TOUS'
              ? 'Aucun journalier ne correspond à vos critères de recherche.'
              : 'Commencez par ajouter votre premier journalier.'}
          </p>
          {!search && specialtyFilter === 'TOUS' && chantierFilter === 'TOUS' && (
            <Button
              onClick={openCreate}
              className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter un journalier
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={search + specialtyFilter + chantierFilter}
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
                        <Avatar className="h-12 w-12 shrink-0 bg-amber-100 text-amber-700 border border-amber-200">
                          <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-sm">
                            {getInitials(journalier.nom, journalier.prenom)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm truncate">
                              {getFullName(journalier)}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] shrink-0 gap-1',
                                getSpecialtyBadgeClass(journalier.specialite)
                              )}
                            >
                              {SpecialtyIcon && (
                                <SpecialtyIcon className="w-3 h-3" />
                              )}
                              {formatSpecialty(journalier.specialite)}
                            </Badge>
                          </div>

                          {/* Phone */}
                          {journalier.telephone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <Phone className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span>{journalier.telephone}</span>
                            </div>
                          )}

                          {/* Active affectations */}
                          {activeAffectations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {activeAffectations.map((affectation) => (
                                <div
                                  key={affectation.id}
                                  className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 text-[11px] text-emerald-700 group/aff"
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
                            <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
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
              {editingId ? 'Modifier le journalier' : 'Nouveau journalier'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du journalier ci-dessous.'
                : 'Remplissez les informations pour ajouter un nouveau journalier.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              {/* Nom */}
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

              {/* Prénom */}
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

            {/* Spécialité */}
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
                  <SelectItem value="Maçon">Maçon</SelectItem>
                  <SelectItem value="Ferrailleur">Ferrailleur</SelectItem>
                  <SelectItem value="Électricien">Électricien</SelectItem>
                  <SelectItem value="Plombier">Plombier</SelectItem>
                  <SelectItem value="Peintre">Peintre</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
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
              journalier (affectations, pointages, paiements) seront
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

            <p className="text-xs text-muted-foreground">
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
