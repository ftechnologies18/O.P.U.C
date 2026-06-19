'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  FileStack,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Download,
  Upload,
  FileText,
  ShieldCheck,
  FileCheck,
  Receipt,
  Construction,
  HardHat,
  FolderOpen,
  X,
  Filter,
  Tag,
  File,
  FileType2,
  CheckCircle2,
  Clock,
  Archive,
  AlertTriangle,
  MoreVertical,
  LayoutGrid,
  List,
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
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store/app-store'

// --- Types ---
interface DocumentItem {
  id: string
  titre: string
  type: string
  categorie: string | null
  numeroReference: string | null
  fichierNom: string
  fichierUrl: string
  fichierTaille: number
  fichierType: string | null
  version: number
  description: string | null
  statut: string
  tags: string | null
  chantierId: string
  phaseId: string | null
  auteurId: string
  dateDocument: string | null
  createdAt: string
  updatedAt: string
  auteur: { id: string; name: string; email?: string }
  chantier: { id: string; nom: string }
  phase: { id: string; nom: string } | null
}

interface DocumentStats {
  total: number
  plans: number
  permis: number
  contrats: number
  pv_reception: number
  factures: number
  techniques: number
  rapports: number
  autres: number
  valideCount: number
  brouillonCount: number
  archiveCount: number
  tailleTotale: number
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

// --- Document Type Config ---
const DOC_TYPES = [
  { value: 'plan', label: 'Plans', icon: FileType2, color: 'bg-amber-100 text-amber-800 border-amber-200', dotColor: 'bg-amber-500', bgHex: '#fef3c7' },
  { value: 'permis', label: 'Permis', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dotColor: 'bg-emerald-500', bgHex: '#d1fae5' },
  { value: 'contrat', label: 'Contrats', icon: FileCheck, color: 'bg-blue-100 text-blue-800 border-blue-200', dotColor: 'bg-blue-500', bgHex: '#dbeafe' },
  { value: 'pv_reception', label: 'PV Réception', icon: CheckCircle2, color: 'bg-violet-100 text-violet-800 border-violet-200', dotColor: 'bg-violet-500', bgHex: '#ede9fe' },
  { value: 'facture', label: 'Factures', icon: Receipt, color: 'bg-orange-100 text-orange-800 border-orange-200', dotColor: 'bg-orange-500', bgHex: '#ffedd5' },
  { value: 'technique', label: 'Technique', icon: HardHat, color: 'bg-slate-100 text-slate-800 border-slate-200', dotColor: 'bg-slate-500', bgHex: '#f1f5f9' },
  { value: 'rapport', label: 'Rapports', icon: FileText, color: 'bg-cyan-100 text-cyan-800 border-cyan-200', dotColor: 'bg-cyan-500', bgHex: '#cffafe' },
  { value: 'autre', label: 'Autres', icon: File, color: 'bg-gray-100 text-gray-800 border-gray-200', dotColor: 'bg-gray-500', bgHex: '#f3f4f6' },
] as const

const STATUT_CONFIG = {
  brouillon: { label: 'Brouillon', icon: FileEdit, color: 'bg-amber-100 text-amber-800', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  valide: { label: 'Validé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archive: { label: 'Archivé', icon: Archive, color: 'bg-slate-100 text-slate-700', badgeClass: 'bg-slate-50 text-slate-600 border-slate-200' },
} as const

function FileEdit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function getDocTypeConfig(type: string) {
  return DOC_TYPES.find((t) => t.value === type) || DOC_TYPES[DOC_TYPES.length - 1]
}

function getStatutConfig(statut: string) {
  return STATUT_CONFIG[statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.brouillon
}

// --- File size formatter ---
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const sizes = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// --- File icon based on extension ---
function getFileIcon(fileName: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  if (['pdf'].includes(ext)) return { icon: FileType2, color: 'text-red-500' }
  if (['doc', 'docx'].includes(ext)) return { icon: FileText, color: 'text-blue-500' }
  if (['xls', 'xlsx'].includes(ext)) return { icon: FileText, color: 'text-emerald-500' }
  if (['ppt', 'pptx'].includes(ext)) return { icon: FileText, color: 'text-orange-500' }
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return { icon: Construction, color: 'text-violet-500' }
  if (['dwg', 'dxf'].includes(ext)) return { icon: FileType2, color: 'text-amber-600' }
  if (['zip', 'rar', '7z'].includes(ext)) return { icon: File, color: 'text-yellow-600' }
  return { icon: File, color: 'text-muted-foreground' }
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
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{count}</p>
        </div>
      </div>
    </Card>
  )
}

// --- Empty State ---
function EmptyState({ hasFilters, hasChantier }: { hasFilters: boolean; hasChantier: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileStack className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-1">
        {!hasChantier ? 'Sélectionnez un chantier' : 'Aucun document'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {!hasChantier
          ? 'Choisissez un chantier pour voir et gérer ses documents.'
          : hasFilters
            ? 'Aucun document ne correspond à vos critères de filtrage.'
            : 'Commencez par ajouter des documents à ce chantier.'}
      </p>
    </motion.div>
  )
}

// ========== MAIN COMPONENT ==========
export function DocumentsView() {
  const { selectedChantierId } = useAppStore()

  // Data states
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filter states
  const [selectedChantier, setSelectedChantier] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState<string>('')

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Dialog states
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)

  // Add form
  const [formTitre, setFormTitre] = useState('')
  const [formType, setFormType] = useState('autre')
  const [formCategorie, setFormCategorie] = useState('')
  const [formNumeroRef, setFormNumeroRef] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStatut, setFormStatut] = useState('brouillon')
  const [formTags, setFormTags] = useState('')
  const [formPhaseId, setFormPhaseId] = useState('')
  const [formDateDocument, setFormDateDocument] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formUploading, setFormUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit form
  const [editTitre, setEditTitre] = useState('')
  const [editType, setEditType] = useState('')
  const [editCategorie, setEditCategorie] = useState('')
  const [editNumeroRef, setEditNumeroRef] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatut, setEditStatut] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPhaseId, setEditPhaseId] = useState('')
  const [editDateDocument, setEditDateDocument] = useState('')

  // --- Fetch Chantiers ---
  useEffect(() => {
    async function fetchChantiers() {
      try {
        const res = await fetch('/api/v1/chantiers')
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

  // --- Fetch Phases ---
  useEffect(() => {
    if (!selectedChantier) {
      setPhases([])
      return
    }
    async function fetchPhases() {
      try {
        const res = await fetch(`/api/v1/chantiers/${selectedChantier}`)
        const data = await res.json()
        if (data.chantier?.phases) {
          setPhases(data.chantier.phases.map((p: { id: string; nom: string }) => ({ id: p.id, nom: p.nom })))
        }
      } catch {
        // silently ignore
      }
    }
    fetchPhases()
  }, [selectedChantier])

  // --- Fetch Documents ---
  const fetchDocuments = useCallback(async () => {
    if (!selectedChantier) {
      setDocuments([])
      setStats(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('chantierId', selectedChantier)
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter)
      if (statutFilter && statutFilter !== 'all') params.set('statut', statutFilter)
      if (phaseFilter && phaseFilter !== 'all') params.set('phaseId', phaseFilter)
      if (searchText.trim()) params.set('search', searchText.trim())

      const res = await fetch(`/api/v1/documents?${params.toString()}`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setStats(data.stats || null)
    } catch {
      toast.error('Erreur lors du chargement des documents')
    } finally {
      setLoading(false)
    }
  }, [selectedChantier, typeFilter, statutFilter, phaseFilter, searchText])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // --- Has active filters ---
  const hasFilters =
    typeFilter !== 'all' ||
    statutFilter !== 'all' ||
    phaseFilter !== 'all' ||
    !!searchText.trim()

  // --- Open Add Dialog ---
  function openAddDialog() {
    setFormTitre('')
    setFormType('autre')
    setFormCategorie('')
    setFormNumeroRef('')
    setFormDescription('')
    setFormStatut('brouillon')
    setFormTags('')
    setFormPhaseId('')
    setFormDateDocument(format(new Date(), 'yyyy-MM-dd'))
    setFormFile(null)
    setFormUploading(false)
    setAddOpen(true)
  }

  // --- Handle File Upload ---
  async function handleFileUpload(): Promise<{ url: string; nom: string; taille: number; type: string } | null> {
    if (!formFile) return null
    const formData = new FormData()
    formData.append('file', formFile)
    try {
      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'upload')
        return null
      }
      return await res.json()
    } catch {
      toast.error('Erreur lors de l\'upload du fichier')
      return null
    }
  }

  // --- Create Document ---
  async function handleCreate() {
    if (!formTitre.trim()) {
      toast.error('Veuillez saisir un titre pour le document')
      return
    }
    if (!selectedChantier) {
      toast.error('Veuillez sélectionner un chantier')
      return
    }
    setSubmitting(true)
    setFormUploading(true)
    try {
      // Get current user session
      const sessionRes = await fetch('/api/v1/v1/auth/me')
      const session = await sessionRes.json()
      const auteurId = session?.user?.id

      if (!auteurId) {
        toast.error('Utilisateur non authentifié')
        return
      }

      let fichierUrl = ''
      let fichierNom = ''
      let fichierTaille = 0
      let fichierType = ''

      if (formFile) {
        const uploaded = await handleFileUpload()
        if (!uploaded) return
        fichierUrl = uploaded.url
        fichierNom = uploaded.nom
        fichierTaille = uploaded.taille
        fichierType = uploaded.type
      }

      const res = await fetch('/api/v1/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: formTitre.trim(),
          type: formType,
          categorie: formCategorie.trim() || null,
          numeroReference: formNumeroRef.trim() || null,
          description: formDescription.trim() || null,
          statut: formStatut,
          tags: formTags.trim() || null,
          chantierId: selectedChantier,
          phaseId: formPhaseId || null,
          auteurId,
          dateDocument: formDateDocument || null,
          fichierNom: fichierNom || 'document.pdf',
          fichierUrl,
          fichierTaille,
          fichierType,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création')
        return
      }
      toast.success('Document ajouté avec succès')
      setAddOpen(false)
      fetchDocuments()
    } catch {
      toast.error('Erreur lors de la création du document')
    } finally {
      setSubmitting(false)
      setFormUploading(false)
    }
  }

  // --- Open Detail ---
  function openDetail(doc: DocumentItem) {
    setSelectedDoc(doc)
    setDetailOpen(true)
  }

  // --- Open Edit ---
  function openEdit(doc: DocumentItem) {
    setSelectedDoc(doc)
    setEditTitre(doc.titre)
    setEditType(doc.type)
    setEditCategorie(doc.categorie || '')
    setEditNumeroRef(doc.numeroReference || '')
    setEditDescription(doc.description || '')
    setEditStatut(doc.statut)
    setEditTags(doc.tags || '')
    setEditPhaseId(doc.phaseId || '')
    setEditDateDocument(doc.dateDocument ? format(parseISO(doc.dateDocument), 'yyyy-MM-dd') : '')
    setEditOpen(true)
  }

  // --- Handle Edit ---
  async function handleEdit() {
    if (!selectedDoc) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: editTitre.trim(),
          type: editType,
          categorie: editCategorie.trim() || null,
          numeroReference: editNumeroRef.trim() || null,
          description: editDescription.trim() || null,
          statut: editStatut,
          tags: editTags.trim() || null,
          phaseId: editPhaseId || null,
          dateDocument: editDateDocument || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la mise à jour')
        return
      }
      toast.success('Document mis à jour')
      setEditOpen(false)
      setSelectedDoc(data.document)
      setDetailOpen(false)
      fetchDocuments()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Handle Delete ---
  async function handleDelete() {
    if (!selectedDoc) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/documents/${selectedDoc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de la suppression')
        return
      }
      toast.success('Document supprimé')
      setDeleteOpen(false)
      setSelectedDoc(null)
      setDetailOpen(false)
      fetchDocuments()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Download ---
  function handleDownload(doc: DocumentItem) {
    const link = window.document.createElement('a')
    link.href = `/${doc.fichierUrl}`
    link.download = doc.fichierNom
    link.click()
    toast.success('Téléchargement lancé')
  }

  return (
    <div className="space-y-4">
      {/* ====== HEADER ====== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <FileStack className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documents</h1>
            <p className="text-[15px] text-muted-foreground">
              Gestion documentaire des chantiers
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-amber-500 hover:bg-amber-600' : ''}
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
          <Button onClick={openAddDialog} className="bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau document
          </Button>
        </div>
      </div>

      {/* ====== CHANTIER SELECTOR ====== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
              <Label className="text-[15px] font-medium whitespace-nowrap">Chantier :</Label>
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
          className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3"
        >
          <StatCard label="Total" count={stats.total} color="bg-amber-500" icon={FileStack} />
          <StatCard label="Plans" count={stats.plans} color="bg-amber-500" icon={FileType2} />
          <StatCard label="Permis" count={stats.permis} color="bg-emerald-500" icon={ShieldCheck} />
          <StatCard label="Contrats" count={stats.contrats} color="bg-blue-500" icon={FileCheck} />
          <StatCard label="PV" count={stats.pv_reception} color="bg-violet-500" icon={CheckCircle2} />
          <StatCard label="Factures" count={stats.factures} color="bg-orange-500" icon={Receipt} />
          <StatCard label="Technique" count={stats.techniques} color="bg-slate-500" icon={HardHat} />
          <StatCard label="Rapports" count={stats.rapports} color="bg-cyan-500" icon={FileText} />
          <StatCard label="Autres" count={stats.autres} color="bg-gray-500" icon={File} />
        </motion.div>
      )}

      {/* ====== SUMMARY BAR ====== */}
      {stats && selectedChantier && stats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="bg-muted/30">
            <CardContent className="p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">Validés :</span>
                <span className="font-semibold text-emerald-700">{stats.valideCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileEdit className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Brouillons :</span>
                <span className="font-semibold text-amber-700">{stats.brouillonCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-slate-500" />
                <span className="text-muted-foreground">Archivés :</span>
                <span className="font-semibold text-slate-600">{stats.archiveCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Taille totale :</span>
                <span className="font-semibold">{formatFileSize(stats.tailleTotale)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ====== FILTERS ====== */}
      {selectedChantier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par titre, réf., tags..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Filter className="w-3.5 h-3.5" />
                  Filtres :
                </div>

                {/* Type filter chips */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                    className={`cursor-pointer text-sm transition-colors ${
                      typeFilter === 'all'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setTypeFilter('all')}
                  >
                    Tous
                  </Badge>
                  {DOC_TYPES.map((dt) => (
                    <Badge
                      key={dt.value}
                      variant={typeFilter === dt.value ? 'default' : 'outline'}
                      className={`cursor-pointer text-sm transition-colors ${
                        typeFilter === dt.value
                          ? dt.color
                          : 'hover:bg-muted'
                      }`}
                      onClick={() =>
                        setTypeFilter(typeFilter === dt.value ? 'all' : dt.value)
                      }
                    >
                      {dt.label}
                    </Badge>
                  ))}
                </div>

                <Separator orientation="vertical" className="h-5 hidden sm:block" />

                {/* Statut filter */}
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className="w-auto h-7 text-sm border-dashed">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>

                {/* Phase filter */}
                {phases.length > 0 && (
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-auto h-7 text-sm border-dashed">
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

                {/* Clear filters */}
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-sm text-muted-foreground"
                    onClick={() => {
                      setTypeFilter('all')
                      setStatutFilter('all')
                      setPhaseFilter('all')
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
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ====== NO CHANTIER ====== */}
      {!selectedChantier && !loading && (
        <EmptyState hasFilters={false} hasChantier={false} />
      )}

      {/* ====== EMPTY STATE ====== */}
      {!loading && selectedChantier && documents.length === 0 && (
        <EmptyState hasFilters={hasFilters} hasChantier={true} />
      )}

      {/* ====== GRID VIEW ====== */}
      {!loading && selectedChantier && viewMode === 'grid' && documents.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {documents.map((doc, idx) => {
              const typeConfig = getDocTypeConfig(doc.type)
              const statutCfg = getStatutConfig(doc.statut)
              const fileIcon = getFileIcon(doc.fichierNom)
              const FileIcon = fileIcon.icon

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                >
                  <Card className="group hover:shadow-lg transition-shadow border border-border/50 cursor-pointer overflow-hidden">
                    {/* File icon header */}
                    <div
                      className="p-6 flex items-center justify-center"
                      style={{ backgroundColor: typeConfig.bgHex }}
                      onClick={() => openDetail(doc)}
                    >
                      <FileIcon className={`w-14 h-14 ${fileIcon.color} opacity-70`} />
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 space-y-3" onClick={() => openDetail(doc)}>
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${statutCfg.badgeClass} text-xs px-1.5`}>
                          {statutCfg.label}
                        </Badge>
                        <Badge className={`${typeConfig.color} text-xs px-1.5`}>
                          {typeConfig.label}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-[15px] text-foreground line-clamp-2 leading-snug">
                        {doc.titre}
                      </h3>

                      {/* Meta info */}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {doc.numeroReference && (
                          <p className="truncate">Réf: {doc.numeroReference}</p>
                        )}
                        <p className="truncate">{doc.fichierNom}</p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.fichierTaille)} • v{doc.version}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(doc.createdAt), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </CardContent>

                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleDownload(doc) }}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="secondary" className="h-7 w-7">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(doc)}>
                            <Eye className="w-4 h-4 mr-2" /> Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(doc)}>
                            <Pencil className="w-4 h-4 mr-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedDoc(doc)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ====== LIST VIEW ====== */}
      {!loading && selectedChantier && viewMode === 'list' && documents.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Document</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Réf.</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Statut</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Taille</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Phase</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {documents.map((doc, idx) => {
                      const typeConfig = getDocTypeConfig(doc.type)
                      const statutCfg = getStatutConfig(doc.statut)
                      const fileIcon = getFileIcon(doc.fichierNom)
                      const FileIcon = fileIcon.icon
                      const TypeIcon = typeConfig.icon

                      return (
                        <motion.tr
                          key={doc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => openDetail(doc)}
                        >
                          {/* Document info */}
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0`} style={{ backgroundColor: typeConfig.bgHex }}>
                                <FileIcon className={`w-5 h-5 ${fileIcon.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate max-w-[250px]">
                                  {doc.titre}
                                </p>
                                <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                                  {doc.fichierNom}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="p-3 hidden md:table-cell">
                            <Badge className={`${typeConfig.color} text-xs`}>
                              {typeConfig.label}
                            </Badge>
                          </td>

                          {/* Reference */}
                          <td className="p-3 text-muted-foreground text-sm hidden lg:table-cell">
                            {doc.numeroReference || '—'}
                          </td>

                          {/* Statut */}
                          <td className="p-3 hidden sm:table-cell">
                            <Badge className={`${statutCfg.badgeClass} text-xs`}>
                              {statutCfg.label}
                            </Badge>
                          </td>

                          {/* Taille */}
                          <td className="p-3 text-muted-foreground text-sm hidden lg:table-cell whitespace-nowrap">
                            {formatFileSize(doc.fichierTaille)}
                          </td>

                          {/* Date */}
                          <td className="p-3 text-muted-foreground text-sm hidden md:table-cell whitespace-nowrap">
                            {format(parseISO(doc.createdAt), 'dd MMM yyyy', { locale: fr })}
                          </td>

                          {/* Phase */}
                          <td className="p-3 text-muted-foreground text-sm hidden lg:table-cell truncate max-w-[120px]">
                            {doc.phase?.nom || '—'}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleDownload(doc) }}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDoc(doc)
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

      {/* ====== ADD DOCUMENT DIALOG ====== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Nouveau document
            </DialogTitle>
            <DialogDescription>
              Ajoutez un document au chantier sélectionné.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                placeholder="Titre du document"
                value={formTitre}
                onChange={(e) => setFormTitre(e.target.value)}
              />
            </div>

            {/* Type & Statut */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dt.dotColor}`} />
                          {dt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={formStatut} onValueChange={setFormStatut}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>N° de référence</Label>
                <Input
                  placeholder="Ex: PC-2025-001"
                  value={formNumeroRef}
                  onChange={(e) => setFormNumeroRef(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date du document</Label>
                <Input
                  type="date"
                  value={formDateDocument}
                  onChange={(e) => setFormDateDocument(e.target.value)}
                />
              </div>
            </div>

            {/* Phase & Categorie */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <Select value={formPhaseId} onValueChange={setFormPhaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Input
                  placeholder="Ex: Architecture"
                  value={formCategorie}
                  onChange={(e) => setFormCategorie(e.target.value)}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </Label>
              <Input
                placeholder="Tags séparés par des virgules (ex: urgent, reception, phase2)"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Fichier
              </Label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  formFile ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-500/5' : 'border-muted-foreground/20 hover:border-amber-300 hover:bg-muted/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-400', 'bg-amber-50') }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50') }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-amber-400', 'bg-amber-50')
                  const files = e.dataTransfer.files
                  if (files.length > 0) setFormFile(files[0])
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.svg,.dwg,.dxf,.zip,.rar,.7z,.txt,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setFormFile(file)
                  }}
                />
                {formFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-medium text-foreground truncate max-w-[250px]">
                        {formFile.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(formFile.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFormFile(null)
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-[15px] font-medium text-foreground">
                        Glissez-déposez ou cliquez pour sélectionner
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PDF, Word, Excel, Images, DWG — Max 50 Mo
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Description du document..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
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
                  {formUploading ? 'Upload en cours...' : 'Enregistrement...'}
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
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: getDocTypeConfig(selectedDoc.type).bgHex }}
                  >
                    {(() => {
                      const fi = getFileIcon(selectedDoc.fichierNom)
                      const FI = fi.icon
                      return <FI className={`w-6 h-6 ${fi.color}`} />
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl">{selectedDoc.titre}</DialogTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className={`${getDocTypeConfig(selectedDoc.type).color} text-xs`}>
                        {getDocTypeConfig(selectedDoc.type).label}
                      </Badge>
                      <Badge className={`${getStatutConfig(selectedDoc.statut).badgeClass} text-xs`}>
                        {getStatutConfig(selectedDoc.statut).label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">v{selectedDoc.version}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Référence</p>
                    <p className="text-[15px] font-medium">{selectedDoc.numeroReference || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Catégorie</p>
                    <p className="text-[15px] font-medium">{selectedDoc.categorie || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Fichier</p>
                    <p className="text-[15px] font-medium truncate">{selectedDoc.fichierNom}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Taille</p>
                    <p className="text-[15px] font-medium">{formatFileSize(selectedDoc.fichierTaille)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Type MIME</p>
                    <p className="text-[15px] font-medium">{selectedDoc.fichierType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Date document</p>
                    <p className="text-[15px] font-medium">
                      {selectedDoc.dateDocument
                        ? format(parseISO(selectedDoc.dateDocument), 'dd MMMM yyyy', { locale: fr })
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Chantier</p>
                    <p className="text-[15px] font-medium">{selectedDoc.chantier.nom}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Phase</p>
                    <p className="text-[15px] font-medium">{selectedDoc.phase?.nom || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Ajouté par</p>
                    <p className="text-[15px] font-medium">{selectedDoc.auteur.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-0.5">Date d&apos;ajout</p>
                    <p className="text-[15px] font-medium">
                      {format(parseISO(selectedDoc.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedDoc.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p className="text-[15px] leading-relaxed bg-muted/50 rounded-lg p-3">
                      {selectedDoc.description}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {selectedDoc.tags && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoc.tags.split(',').map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-sm">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleDownload(selectedDoc)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false)
                    openEdit(selectedDoc)
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailOpen(false)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== EDIT DIALOG ====== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              Modifier le document
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dt.dotColor}`} />
                          {dt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={editStatut} onValueChange={setEditStatut}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>N° de référence</Label>
                <Input value={editNumeroRef} onChange={(e) => setEditNumeroRef(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date du document</Label>
                <Input type="date" value={editDateDocument} onChange={(e) => setEditDateDocument(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <Select value={editPhaseId} onValueChange={setEditPhaseId}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Input value={editCategorie} onChange={(e) => setEditCategorie(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </Label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Tags séparés par des virgules" />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE CONFIRMATION ====== */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Supprimer le document
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le document{' '}
              <span className="font-semibold text-foreground">{selectedDoc?.titre}</span> ?
              Cette action est irréversible. Le fichier associé sera également supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
