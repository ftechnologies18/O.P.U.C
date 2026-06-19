'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Truck,
  HardHat,
  Cog,
  Wrench,
  Phone,
  Building2,
  CalendarDays,
  AlertTriangle,
  CircleDollarSign,
  FileText,
  CheckCircle2,
  Ban,
  X,
  Loader2,
  MapPin,
  User,
  Package,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type EnginFilterValue = 'TOUS' | 'PROPRE' | 'LOUE'
type LocationStatutFilter = 'TOUS' | 'EN_COURS' | 'TERMINE' | 'ANNULE'

interface EnginInfo {
  id: string
  designation: string
  typeEquipement: string | null
  marque: string | null
  modele: string | null
  immatriculation: string | null
  etat: string
  typeLocation: string | null
  createdAt: string
  _count: {
    locations: number
  }
}

interface FournisseurInfo {
  id: string
  raisonSociale: string | null
  nom: string | null
  prenom: string | null
  contact: string | null
}

interface ChantierOption {
  id: string
  nom: string
  statut: string
}

interface EnginOption {
  id: string
  designation: string
  typeEquipement: string | null
}

interface FournisseurOption {
  id: string
  raisonSociale: string | null
  nom: string | null
  prenom: string | null
}

interface LocationItem {
  id: string
  equipementId: string
  fournisseurId: string | null
  fournisseurNom: string | null
  fournisseurTel: string | null
  numeroContrat: string | null
  chantierId: string | null
  coutJournalier: number
  coutTransport: number
  coutOperateur: number
  caution: number
  dateDebut: string
  dateFin: string | null
  statut: string
  conditions: string | null
  createdAt: string
  equipement: EnginOption
  fournisseur: FournisseurInfo | null
  chantier: ChantierOption | null
}

interface EnginKpi {
  totalEngins: number
  enginsPropres: number
  enginsLoues: number
}

interface LocationKpi {
  locationsEnCours: number
  coutTotalEnCours: number
  coutJournalierMoyen: number
  locationsCeMois: number
}

interface EnginFormData {
  designation: string
  typeEquipement: string
  marque: string
  modele: string
  immatriculation: string
  etat: string
  typeLocation: string
}

interface LocationFormData {
  equipementId: string
  fournisseurId: string
  fournisseurNom: string
  fournisseurTel: string
  numeroContrat: string
  chantierId: string
  coutJournalier: string
  coutTransport: string
  coutOperateur: string
  caution: string
  dateDebut: string
  dateFin: string
  statut: string
  conditions: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_EQUIPEMENT_OPTIONS = [
  { value: 'pelleteuse', label: 'Pelleteuse' },
  { value: 'grue', label: 'Grue' },
  { value: 'bulldozer', label: 'Bulldozer' },
  { value: 'betonniere', label: 'Bétonnière' },
  { value: 'camion', label: 'Camion' },
  { value: 'compresseur', label: 'Compresseur' },
  { value: 'dumper', label: 'Dumper' },
  { value: 'niveleuse', label: 'Niveleuse' },
  { value: 'roller', label: 'Roller' },
  { value: 'autre', label: 'Autre' },
]

const ETAT_CONFIG: Record<string, { label: string; className: string }> = {
  BON: {
    label: 'Bon état',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  EN_REPARATION: {
    label: 'En réparation',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  HORS_SERVICE: {
    label: 'Hors service',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
}

const TYPE_LOCATION_CONFIG: Record<string, { label: string; className: string }> = {
  PROPRE: {
    label: 'Propre',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  LOUE: {
    label: 'Loué',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
}

const LOCATION_STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  EN_COURS: {
    label: 'En cours',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  TERMINE: {
    label: 'Terminée',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  ANNULE: {
    label: 'Annulée',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
}

const EMPTY_ENGIN_FORM: EnginFormData = {
  designation: '',
  typeEquipement: '',
  marque: '',
  modele: '',
  immatriculation: '',
  etat: 'BON',
  typeLocation: 'PROPRE',
}

const EMPTY_LOCATION_FORM: LocationFormData = {
  equipementId: '',
  fournisseurId: '',
  fournisseurNom: '',
  fournisseurTel: '',
  numeroContrat: '',
  chantierId: '',
  coutJournalier: '',
  coutTransport: '0',
  coutOperateur: '0',
  caution: '0',
  dateDebut: '',
  dateFin: '',
  statut: 'EN_COURS',
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

function getEtatBadge(etat: string): { label: string; className: string } {
  return ETAT_CONFIG[etat] || {
    label: etat,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  }
}

function getStatutBadge(statut: string): { label: string; className: string } {
  return LOCATION_STATUT_CONFIG[statut] || {
    label: statut,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  }
}

function getTypeLocationBadge(typeLocation: string | null): { label: string; className: string } {
  if (!typeLocation) {
    return { label: 'N/A', className: 'bg-gray-100 text-gray-600 border-gray-200' }
  }
  return TYPE_LOCATION_CONFIG[typeLocation] || {
    label: typeLocation,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  }
}

function getEnginIcon(typeEquipement: string | null) {
  if (typeEquipement === 'camion') return Truck
  if (typeEquipement === 'betonniere' || typeEquipement === 'compresseur') return Cog
  return HardHat
}

function getEnginIconBg(typeEquipement: string | null) {
  if (typeEquipement === 'camion') return 'bg-orange-100'
  if (typeEquipement === 'betonniere' || typeEquipement === 'compresseur') return 'bg-cyan-100'
  return 'bg-amber-100'
}

function getEnginIconColor(typeEquipement: string | null) {
  if (typeEquipement === 'camion') return 'text-orange-600'
  if (typeEquipement === 'betonniere' || typeEquipement === 'compresseur') return 'text-cyan-600'
  return 'text-amber-600'
}

function calcLocationTotal(loc: LocationItem): number {
  const startDate = parseISO(loc.dateDebut)
  const endDate = loc.dateFin ? parseISO(loc.dateFin) : new Date()
  const days = Math.max(1, differenceInDays(endDate, startDate))
  return (loc.coutJournalier * days) + loc.coutTransport + (loc.coutOperateur * days)
}

function getFournisseurDisplayName(loc: LocationItem): string {
  if (loc.fournisseur) {
    const f = loc.fournisseur
    if (f.raisonSociale) return f.raisonSociale
    return `${f.nom || ''} ${f.prenom || ''}`.trim() || 'Fournisseur non renseigné'
  }
  return loc.fournisseurNom || 'Fournisseur non renseigné'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EnginsView() {
  // ── Shared dropdown data ─────────────────────────────────────────────────
  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [enginOptions, setEnginOptions] = useState<EnginOption[]>([])
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([])

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('parc')

  // ── Parc Engins state ────────────────────────────────────────────────────
  const [engins, setEngins] = useState<EnginInfo[]>([])
  const [enginKpi, setEnginKpi] = useState<EnginKpi | null>(null)
  const [enginsLoading, setEnginsLoading] = useState(true)
  const [enginSearch, setEnginSearch] = useState('')
  const [enginFilter, setEnginFilter] = useState<EnginFilterValue>('TOUS')

  // Engin form dialog
  const [enginFormOpen, setEnginFormOpen] = useState(false)
  const [editingEnginId, setEditingEnginId] = useState<string | null>(null)
  const [enginForm, setEnginForm] = useState<EnginFormData>(EMPTY_ENGIN_FORM)
  const [enginSubmitting, setEnginSubmitting] = useState(false)

  // Delete engin dialog
  const [deleteEnginOpen, setDeleteEnginOpen] = useState(false)
  const [deletingEnginId, setDeletingEnginId] = useState<string | null>(null)
  const [deletingEnginName, setDeletingEnginName] = useState('')
  const [deletingEngin, setDeletingEngin] = useState(false)

  // ── Locations state ──────────────────────────────────────────────────────
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationKpi, setLocationKpi] = useState<LocationKpi | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [locationSearch, setLocationSearch] = useState('')
  const [locationStatutFilter, setLocationStatutFilter] = useState<LocationStatutFilter>('TOUS')
  const [locationChantierFilter, setLocationChantierFilter] = useState('')

  // Location form dialog
  const [locationFormOpen, setLocationFormOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState<LocationFormData>(EMPTY_LOCATION_FORM)
  const [locationSubmitting, setLocationSubmitting] = useState(false)

  // Delete location dialog
  const [deleteLocationOpen, setDeleteLocationOpen] = useState(false)
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null)
  const [deletingLocationName, setDeletingLocationName] = useState('')
  const [deletingLocation, setDeletingLocation] = useState(false)

  // Statut change
  const [editingStatutId, setEditingStatutId] = useState<string | null>(null)
  const [newStatut, setNewStatut] = useState('')

  // ── Fetch shared data ────────────────────────────────────────────────────

  const fetchChantiers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chantiers')
      if (res.ok) {
        const json = await res.json()
        setChantiers(
          (json.chantiers || []).map((c: { id: string; nom: string; statut: string }) => ({
            id: c.id,
            nom: c.nom,
            statut: c.statut,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  const fetchEnginOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/engins')
      if (res.ok) {
        const json = await res.json()
        setEnginOptions(
          (json.engins || []).map((e: { id: string; designation: string; typeEquipement: string | null }) => ({
            id: e.id,
            designation: e.designation,
            typeEquipement: e.typeEquipement,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  const fetchFournisseurOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/sous-traitants?type=FOURNISSEUR')
      if (res.ok) {
        const json = await res.json()
        setFournisseurOptions(
          (json.sousTraitants || []).map((f: { id: string; raisonSociale: string | null; nom: string | null; prenom: string | null }) => ({
            id: f.id,
            raisonSociale: f.raisonSociale,
            nom: f.nom,
            prenom: f.prenom,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  // ── Fetch engins ────────────────────────────────────────────────────────

  const fetchEngins = useCallback(async () => {
    setEnginsLoading(true)
    try {
      const params = new URLSearchParams()
      if (enginSearch.trim()) params.set('search', enginSearch.trim())
      if (enginFilter !== 'TOUS') params.set('typeLocation', enginFilter)

      const res = await fetch(`/api/v1/engins?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setEngins(json.engins)
        setEnginKpi(json.kpi)
      } else {
        toast.error('Erreur lors du chargement des engins')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setEnginsLoading(false)
    }
  }, [enginSearch, enginFilter])

  // ── Fetch locations ─────────────────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationSearch.trim()) params.set('search', locationSearch.trim())
      if (locationStatutFilter !== 'TOUS') params.set('statut', locationStatutFilter)
      if (locationChantierFilter) params.set('chantierId', locationChantierFilter)

      const res = await fetch(`/api/v1/locations?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setLocations(json.locations)
        setLocationKpi(json.kpi)
      } else {
        toast.error('Erreur lors du chargement des locations')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLocationsLoading(false)
    }
  }, [locationSearch, locationStatutFilter, locationChantierFilter])

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchChantiers()
    fetchEnginOptions()
    fetchFournisseurOptions()
  }, [fetchChantiers, fetchEnginOptions, fetchFournisseurOptions])

  useEffect(() => {
    fetchEngins()
  }, [fetchEngins])

  useEffect(() => {
    if (activeTab === 'locations') {
      fetchLocations()
    }
  }, [activeTab, fetchLocations])

  // ── Engin CRUD ──────────────────────────────────────────────────────────

  const openCreateEngin = () => {
    setEditingEnginId(null)
    setEnginForm({ ...EMPTY_ENGIN_FORM })
    setEnginFormOpen(true)
  }

  const openEditEngin = (engin: EnginInfo) => {
    setEditingEnginId(engin.id)
    setEnginForm({
      designation: engin.designation || '',
      typeEquipement: engin.typeEquipement || '',
      marque: engin.marque || '',
      modele: engin.modele || '',
      immatriculation: engin.immatriculation || '',
      etat: engin.etat || 'BON',
      typeLocation: engin.typeLocation || 'PROPRE',
    })
    setEnginFormOpen(true)
  }

  const handleSubmitEngin = async () => {
    if (!enginForm.designation.trim()) {
      toast.error('La désignation est requise')
      return
    }

    setEnginSubmitting(true)
    try {
      const body = {
        designation: enginForm.designation.trim(),
        typeEquipement: enginForm.typeEquipement || null,
        marque: enginForm.marque.trim() || null,
        modele: enginForm.modele.trim() || null,
        immatriculation: enginForm.immatriculation.trim() || null,
        etat: enginForm.etat,
        typeLocation: enginForm.typeLocation,
      }

      let res: Response
      if (editingEnginId) {
        res = await fetch(`/api/v1/engins/${editingEnginId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/engins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingEnginId
            ? 'Engin mis à jour avec succès'
            : 'Engin créé avec succès'
        )
        setEnginFormOpen(false)
        fetchEngins()
        fetchEnginOptions()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setEnginSubmitting(false)
    }
  }

  const confirmDeleteEngin = (engin: EnginInfo) => {
    setDeletingEnginId(engin.id)
    setDeletingEnginName(engin.designation)
    setDeleteEnginOpen(true)
  }

  const handleDeleteEngin = async () => {
    if (!deletingEnginId) return

    setDeletingEngin(true)
    try {
      const res = await fetch(`/api/v1/engins/${deletingEnginId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Engin supprimé avec succès')
        setDeleteEnginOpen(false)
        setDeletingEnginId(null)
        setDeletingEnginName('')
        fetchEngins()
        fetchEnginOptions()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeletingEngin(false)
    }
  }

  // ── Location CRUD ───────────────────────────────────────────────────────

  const openCreateLocation = () => {
    setEditingLocationId(null)
    setLocationForm({ ...EMPTY_LOCATION_FORM })
    setLocationFormOpen(true)
  }

  const openEditLocation = (loc: LocationItem) => {
    setEditingLocationId(loc.id)
    setLocationForm({
      equipementId: loc.equipementId || '',
      fournisseurId: loc.fournisseurId || '',
      fournisseurNom: loc.fournisseurNom || '',
      fournisseurTel: loc.fournisseurTel || '',
      numeroContrat: loc.numeroContrat || '',
      chantierId: loc.chantierId || '',
      coutJournalier: String(loc.coutJournalier || ''),
      coutTransport: String(loc.coutTransport || 0),
      coutOperateur: String(loc.coutOperateur || 0),
      caution: String(loc.caution || 0),
      dateDebut: loc.dateDebut ? loc.dateDebut.split('T')[0] : '',
      dateFin: loc.dateFin ? loc.dateFin.split('T')[0] : '',
      statut: loc.statut || 'EN_COURS',
      conditions: loc.conditions || '',
    })
    setLocationFormOpen(true)
  }

  const handleSubmitLocation = async () => {
    if (!locationForm.equipementId) {
      toast.error("Veuillez sélectionner un engin")
      return
    }
    if (!locationForm.dateDebut) {
      toast.error('La date de début est requise')
      return
    }
    if (!locationForm.coutJournalier || parseFloat(locationForm.coutJournalier) < 0) {
      toast.error('Le coût journalier doit être un nombre positif')
      return
    }

    setLocationSubmitting(true)
    try {
      const body = {
        equipementId: locationForm.equipementId,
        fournisseurId: locationForm.fournisseurId || null,
        fournisseurNom: locationForm.fournisseurNom.trim() || null,
        fournisseurTel: locationForm.fournisseurTel.trim() || null,
        numeroContrat: locationForm.numeroContrat.trim() || null,
        chantierId: locationForm.chantierId || null,
        coutJournalier: parseFloat(locationForm.coutJournalier),
        coutTransport: parseFloat(locationForm.coutTransport) || 0,
        coutOperateur: parseFloat(locationForm.coutOperateur) || 0,
        caution: parseFloat(locationForm.caution) || 0,
        dateDebut: locationForm.dateDebut,
        dateFin: locationForm.dateFin || null,
        statut: locationForm.statut,
        conditions: locationForm.conditions.trim() || null,
      }

      let res: Response
      if (editingLocationId) {
        res = await fetch(`/api/v1/locations/${editingLocationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        toast.success(
          editingLocationId
            ? 'Location mise à jour avec succès'
            : 'Location créée avec succès'
        )
        setLocationFormOpen(false)
        fetchLocations()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLocationSubmitting(false)
    }
  }

  const confirmDeleteLocation = (loc: LocationItem) => {
    setDeletingLocationId(loc.id)
    setDeletingLocationName(
      `${loc.equipement.designation} - ${loc.numeroContrat || 'Sans contrat'}`
    )
    setDeleteLocationOpen(true)
  }

  const handleDeleteLocation = async () => {
    if (!deletingLocationId) return

    setDeletingLocation(true)
    try {
      const res = await fetch(`/api/v1/locations/${deletingLocationId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Location supprimée avec succès')
        setDeleteLocationOpen(false)
        setDeletingLocationId(null)
        setDeletingLocationName('')
        fetchLocations()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeletingLocation(false)
    }
  }

  const handleChangeStatut = async (locationId: string) => {
    if (!newStatut) return

    try {
      const res = await fetch(`/api/v1/locations/${locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })

      if (res.ok) {
        toast.success('Statut de la location mis à jour')
        setEditingStatutId(null)
        setNewStatut('')
        fetchLocations()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Une erreur est survenue')
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // ── KPI Cards ───────────────────────────────────────────────────────────

  const enginKpiCards = enginKpi
    ? [
        {
          label: 'Total engins',
          value: enginKpi.totalEngins,
          icon: Package,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Engins propres',
          value: enginKpi.enginsPropres,
          icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
        {
          label: 'Engins en location',
          value: enginKpi.enginsLoues,
          icon: Truck,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          border: 'border-violet-200',
        },
      ]
    : []

  const locationKpiCards = locationKpi
    ? [
        {
          label: 'Locations en cours',
          value: locationKpi.locationsEnCours,
          icon: CalendarDays,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
        },
        {
          label: 'Coût total en cours',
          value: formatFCFA(locationKpi.coutTotalEnCours),
          icon: CircleDollarSign,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
        },
        {
          label: 'Coût journalier moyen',
          value: formatFCFA(locationKpi.coutJournalierMoyen),
          icon: FileText,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          border: 'border-violet-200',
        },
        {
          label: 'Locations ce mois',
          value: locationKpi.locationsCeMois,
          icon: AlertTriangle,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
        },
      ]
    : []

  // ── Calculated montant estimé for form ──────────────────────────────────

  const calcMontantEstime = () => {
    const cj = parseFloat(locationForm.coutJournalier) || 0
    const ct = parseFloat(locationForm.coutTransport) || 0
    const co = parseFloat(locationForm.coutOperateur) || 0
    if (!locationForm.dateDebut) return 0
    const start = new Date(locationForm.dateDebut)
    const end = locationForm.dateFin ? new Date(locationForm.dateFin) : new Date()
    const days = Math.max(0, differenceInDays(end, start))
    return (cj + co) * days + ct
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Engins & Locations</h2>
          <p className="text-[15px] text-muted-foreground mt-1">
            Gérez le parc d&apos;engins et les contrats de location
          </p>
        </div>
        <Button
          onClick={activeTab === 'parc' ? openCreateEngin : openCreateLocation}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'parc' ? 'Nouvel engin' : 'Nouvelle location'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="parc" className="gap-1.5">
            <Package className="w-4 h-4" />
            Parc Engins
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1.5">
            <Truck className="w-4 h-4" />
            Locations
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Parc Engins ─────────────────────────────────────────── */}
        <TabsContent value="parc" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {enginKpiCards.map((card) => {
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
                          <p className="text-sm text-muted-foreground font-medium">
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

          {/* Search + Type Filter */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par désignation, type, marque, immatriculation..."
                    value={enginSearch}
                    onChange={(e) => setEnginSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
                  {([
                    { value: 'TOUS' as EnginFilterValue, label: 'Tous', icon: Package },
                    { value: 'PROPRE' as EnginFilterValue, label: 'Propres', icon: CheckCircle2 },
                    { value: 'LOUE' as EnginFilterValue, label: 'Loués', icon: Truck },
                  ]).map((filter) => {
                    const FilterIcon = filter.icon
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setEnginFilter(filter.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                          enginFilter === filter.value
                            ? 'bg-white text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <FilterIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{filter.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engin List */}
          {enginsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : engins.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Aucun engin trouvé
              </h3>
              <p className="text-[15px] text-muted-foreground mt-1 max-w-sm">
                {enginSearch || enginFilter !== 'TOUS'
                  ? 'Aucun engin ne correspond à vos critères.'
                  : 'Commencez par ajouter votre premier engin.'}
              </p>
              {!enginSearch && enginFilter === 'TOUS' && (
                <Button
                  onClick={openCreateEngin}
                  className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un engin
                </Button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${enginSearch}-${enginFilter}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {engins.map((engin, index) => {
                  const EtatBadge = getEtatBadge(engin.etat)
                  const TypeLocBadge = getTypeLocationBadge(engin.typeLocation)
                  const EnginIcon = getEnginIcon(engin.typeEquipement)

                  return (
                    <motion.div
                      key={engin.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <Card className="border shadow-sm hover:shadow-md transition-shadow group h-full">
                        <CardContent className="p-4 flex flex-col gap-3">
                          {/* Header: icon + name + actions */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={cn(
                                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                  getEnginIconBg(engin.typeEquipement)
                                )}
                              >
                                <EnginIcon className={cn('w-4 h-4', getEnginIconColor(engin.typeEquipement))} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground text-[15px] truncate">
                                  {engin.designation}
                                </h3>
                                {engin.typeEquipement && (
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {engin.typeEquipement}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                                onClick={() => openEditEngin(engin)}
                                title="Modifier"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                onClick={() => confirmDeleteEngin(engin)}
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Info details */}
                          <div className="space-y-1.5 text-sm">
                            {engin.marque && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                <span className="truncate">{engin.marque}{engin.modele ? ` ${engin.modele}` : ''}</span>
                              </div>
                            )}
                            {engin.immatriculation && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                <span className="truncate">{engin.immatriculation}</span>
                              </div>
                            )}
                          </div>

                          {/* Badges row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', EtatBadge.className)}
                            >
                              {EtatBadge.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', TypeLocBadge.className)}
                            >
                              {TypeLocBadge.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                engin._count.locations > 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              )}
                            >
                              <Truck className="w-3 h-3 mr-0.5" />
                              {engin._count.locations} location{engin._count.locations > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </TabsContent>

        {/* ── Tab 2: Locations ──────────────────────────────────────────── */}
        <TabsContent value="locations" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {locationKpiCards.map((card) => {
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
                          <p className="text-sm text-muted-foreground font-medium">
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

          {/* Search + Filters */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par n° contrat, fournisseur, engin..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
                  {([
                    { value: 'TOUS' as LocationStatutFilter, label: 'Tous', icon: Eye },
                    { value: 'EN_COURS' as LocationStatutFilter, label: 'En cours', icon: CalendarDays },
                    { value: 'TERMINE' as LocationStatutFilter, label: 'Terminées', icon: CheckCircle2 },
                    { value: 'ANNULE' as LocationStatutFilter, label: 'Annulées', icon: Ban },
                  ]).map((filter) => {
                    const FilterIcon = filter.icon
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setLocationStatutFilter(filter.value)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                          locationStatutFilter === filter.value
                            ? 'bg-white text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <FilterIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{filter.label}</span>
                      </button>
                    )
                  })}
                </div>
                <Select value={locationChantierFilter || '__all__'} onValueChange={(val) => setLocationChantierFilter(val === '__all__' ? '' : val)}>
                  <SelectTrigger className="w-full sm:w-48">
                    <MapPin className="w-4 h-4 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Tous les chantiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les chantiers</SelectItem>
                    {chantiers.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Locations List */}
          {locationsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
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
          ) : locations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Aucune location trouvée
              </h3>
              <p className="text-[15px] text-muted-foreground mt-1 max-w-sm">
                {locationSearch || locationStatutFilter !== 'TOUS' || locationChantierFilter
                  ? 'Aucune location ne correspond à vos critères.'
                  : 'Commencez par créer votre première location.'}
              </p>
              {!locationSearch && locationStatutFilter === 'TOUS' && !locationChantierFilter && (
                <Button
                  onClick={openCreateLocation}
                  className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Créer une location
                </Button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${locationSearch}-${locationStatutFilter}-${locationChantierFilter}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {locations.map((loc, index) => {
                  const StatutBadge = getStatutBadge(loc.statut)
                  const totalEstime = calcLocationTotal(loc)
                  const fournisseurName = getFournisseurDisplayName(loc)

                  return (
                    <motion.div
                      key={loc.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <Card className="border shadow-sm hover:shadow-md transition-shadow group h-full">
                        <CardContent className="p-4 flex flex-col gap-3">
                          {/* Header: engin name + actions */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-100">
                                <Truck className="w-4 h-4 text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground text-[15px] truncate">
                                  {loc.equipement.designation}
                                </h3>
                                {loc.equipement.typeEquipement && (
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {loc.equipement.typeEquipement}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                                onClick={() => openEditLocation(loc)}
                                title="Modifier"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                onClick={() => confirmDeleteLocation(loc)}
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Info details */}
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <User className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span className="truncate">{fournisseurName}</span>
                            </div>
                            {loc.numeroContrat && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <FileText className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                <span className="truncate">N° {loc.numeroContrat}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span className="truncate">
                                {formatDate(loc.dateDebut)} → {loc.dateFin ? formatDate(loc.dateFin) : 'En cours'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CircleDollarSign className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span className="truncate">
                                {formatFCFA(loc.coutJournalier)}/j — Total: {formatFCFA(totalEstime)}
                              </span>
                            </div>
                            {loc.chantier && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                <span className="truncate">{loc.chantier.nom}</span>
                              </div>
                            )}
                          </div>

                          {/* Badges row + statut change */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', StatutBadge.className)}
                            >
                              {StatutBadge.label}
                            </Badge>
                            {loc.caution > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-orange-50 text-orange-700 border-orange-200"
                              >
                                Caution: {formatFCFA(loc.caution)}
                              </Badge>
                            )}
                          </div>

                          {/* Statut change */}
                          {editingStatutId === loc.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={newStatut} onValueChange={setNewStatut}>
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue placeholder="Nouveau statut" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EN_COURS">En cours</SelectItem>
                                  <SelectItem value="TERMINE">Terminée</SelectItem>
                                  <SelectItem value="ANNULE">Annulée</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                                onClick={() => handleChangeStatut(loc.id)}
                                disabled={!newStatut}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => { setEditingStatutId(null); setNewStatut('') }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-amber-600 gap-1 self-start"
                              onClick={() => { setEditingStatutId(loc.id); setNewStatut('') }}
                            >
                              <Wrench className="w-3 h-3" />
                              Changer statut
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create/Edit Engin Dialog ─────────────────────────────────────── */}
      <Dialog
        open={enginFormOpen}
        onOpenChange={(open) => !open && setEnginFormOpen(false)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEnginId
                ? "Modifier l'engin"
                : 'Nouvel engin'}
            </DialogTitle>
            <DialogDescription>
              {editingEnginId
                ? "Modifiez les informations de l'engin ci-dessous."
                : 'Remplissez les informations pour ajouter un nouvel engin.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Designation */}
            <div className="grid gap-2">
              <Label htmlFor="designation">
                Désignation <span className="text-red-500">*</span>
              </Label>
              <Input
                id="designation"
                placeholder="Ex: Pelleteuse CAT 320D"
                value={enginForm.designation}
                onChange={(e) =>
                  setEnginForm({ ...enginForm, designation: e.target.value })
                }
              />
            </div>

            {/* Type equipement */}
            <div className="grid gap-2">
              <Label htmlFor="typeEquipement">Type d&apos;équipement</Label>
              <Select
                value={enginForm.typeEquipement}
                onValueChange={(val) =>
                  setEnginForm({ ...enginForm, typeEquipement: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_EQUIPEMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Marque */}
              <div className="grid gap-2">
                <Label htmlFor="marque">Marque</Label>
                <Input
                  id="marque"
                  placeholder="Ex: Caterpillar"
                  value={enginForm.marque}
                  onChange={(e) =>
                    setEnginForm({ ...enginForm, marque: e.target.value })
                  }
                />
              </div>

              {/* Modele */}
              <div className="grid gap-2">
                <Label htmlFor="modele">Modèle</Label>
                <Input
                  id="modele"
                  placeholder="Ex: 320D"
                  value={enginForm.modele}
                  onChange={(e) =>
                    setEnginForm({ ...enginForm, modele: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Immatriculation */}
            <div className="grid gap-2">
              <Label htmlFor="immatriculation">Immatriculation</Label>
              <Input
                id="immatriculation"
                placeholder="Ex: RN-1234-AB"
                value={enginForm.immatriculation}
                onChange={(e) =>
                  setEnginForm({ ...enginForm, immatriculation: e.target.value })
                }
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              {/* Etat */}
              <div className="grid gap-2">
                <Label htmlFor="etat">État</Label>
                <Select
                  value={enginForm.etat}
                  onValueChange={(val) =>
                    setEnginForm({ ...enginForm, etat: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BON">Bon état</SelectItem>
                    <SelectItem value="EN_REPARATION">En réparation</SelectItem>
                    <SelectItem value="HORS_SERVICE">Hors service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type location */}
              <div className="grid gap-2">
                <Label htmlFor="typeLocation">Type de location</Label>
                <Select
                  value={enginForm.typeLocation}
                  onValueChange={(val) =>
                    setEnginForm({ ...enginForm, typeLocation: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROPRE">Propre</SelectItem>
                    <SelectItem value="LOUE">Loué</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnginFormOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitEngin}
              disabled={enginSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {enginSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEnginId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Engin Confirmation ────────────────────────────────────── */}
      <AlertDialog open={deleteEnginOpen} onOpenChange={setDeleteEnginOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;engin ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;engin{' '}
              <span className="font-semibold">&quot;{deletingEnginName}&quot;</span> ?
              Cette action est irréversible et supprimera également toutes les locations associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEngin}
              disabled={deletingEngin}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingEngin && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create/Edit Location Dialog ──────────────────────────────────── */}
      <Dialog
        open={locationFormOpen}
        onOpenChange={(open) => !open && setLocationFormOpen(false)}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocationId
                ? 'Modifier la location'
                : 'Nouvelle location'}
            </DialogTitle>
            <DialogDescription>
              {editingLocationId
                ? 'Modifiez les informations de la location ci-dessous.'
                : 'Remplissez les informations pour créer un nouveau contrat de location.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Equipement select */}
            <div className="grid gap-2">
              <Label htmlFor="locEquipement">
                Engin <span className="text-red-500">*</span>
              </Label>
              <Select
                value={locationForm.equipementId}
                onValueChange={(val) =>
                  setLocationForm({ ...locationForm, equipementId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un engin" />
                </SelectTrigger>
                <SelectContent>
                  {enginOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.designation}{e.typeEquipement ? ` (${e.typeEquipement})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fournisseur */}
            <div className="grid gap-2">
              <Label>Fournisseur</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={locationForm.fournisseurId}
                  onValueChange={(val) =>
                    setLocationForm({ ...locationForm, fournisseurId: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseurOptions.map((f) => {
                      const name = f.raisonSociale || `${f.nom || ''} ${f.prenom || ''}`.trim()
                      return (
                        <SelectItem key={f.id} value={f.id}>
                          {name}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fournisseur fallback fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="fournisseurNom">Nom fournisseur (si non lié)</Label>
                <Input
                  id="fournisseurNom"
                  placeholder="Nom du fournisseur"
                  value={locationForm.fournisseurNom}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, fournisseurNom: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fournisseurTel">Téléphone fournisseur</Label>
                <Input
                  id="fournisseurTel"
                  placeholder="Ex: +243 812 345 678"
                  value={locationForm.fournisseurTel}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, fournisseurTel: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Numero contrat + Chantier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="numeroContrat">N° Contrat</Label>
                <Input
                  id="numeroContrat"
                  placeholder="Ex: LOC-2024-001"
                  value={locationForm.numeroContrat}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, numeroContrat: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="locChantier">Chantier</Label>
                <Select
                  value={locationForm.chantierId}
                  onValueChange={(val) =>
                    setLocationForm({ ...locationForm, chantierId: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chantier" />
                  </SelectTrigger>
                  <SelectContent>
                    {chantiers.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        {ch.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Costs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="coutJournalier">
                  Coût journalier <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="coutJournalier"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={locationForm.coutJournalier}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, coutJournalier: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coutTransport">Coût transport</Label>
                <Input
                  id="coutTransport"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={locationForm.coutTransport}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, coutTransport: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="coutOperateur">Coût opérateur / jour</Label>
                <Input
                  id="coutOperateur"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={locationForm.coutOperateur}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, coutOperateur: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="caution">Caution</Label>
                <Input
                  id="caution"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={locationForm.caution}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, caution: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="dateDebut">
                  Date début <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dateDebut"
                  type="date"
                  value={locationForm.dateDebut}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, dateDebut: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateFin">Date fin</Label>
                <Input
                  id="dateFin"
                  type="date"
                  value={locationForm.dateFin}
                  onChange={(e) =>
                    setLocationForm({ ...locationForm, dateFin: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Statut */}
            <div className="grid gap-2">
              <Label htmlFor="locStatut">Statut</Label>
              <Select
                value={locationForm.statut}
                onValueChange={(val) =>
                  setLocationForm({ ...locationForm, statut: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN_COURS">En cours</SelectItem>
                  <SelectItem value="TERMINE">Terminée</SelectItem>
                  <SelectItem value="ANNULE">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="grid gap-2">
              <Label htmlFor="conditions">Conditions / Observations</Label>
              <Textarea
                id="conditions"
                placeholder="Assurances, conditions particulières..."
                value={locationForm.conditions}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, conditions: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Montant estimé */}
            {locationForm.dateDebut && locationForm.coutJournalier && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CircleDollarSign className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    Montant estimé : {formatFCFA(calcMontantEstime())}
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1 ml-6">
                  (Coût journalier + coût opérateur) × nombre de jours + coût transport
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLocationFormOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitLocation}
              disabled={locationSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {locationSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLocationId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Location Confirmation ─────────────────────────────────── */}
      <AlertDialog open={deleteLocationOpen} onOpenChange={setDeleteLocationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la location ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la location{' '}
              <span className="font-semibold">&quot;{deletingLocationName}&quot;</span> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              disabled={deletingLocation}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingLocation && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
