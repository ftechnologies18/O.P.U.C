'use client'

import { Fragment, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  Users,
  Shield,
  ScrollText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Lock,
  Unlock,
  KeyRound,
  Copy,
  RotateCcw,
  Check,
  Activity,
  Clock,
  Search,
  FilterX,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  RefreshCw,
  Building2,
  Checkbox,
  AlertTriangle,
  Download,
  Calendar,
  BarChart3,
  Timer,
  LayoutList,
  LayoutPanelLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox as CheckboxUI } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ALL_FONCTIONS, getFonctionLabel, type UserFonction } from '@/lib/rbac'

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string
  email: string
  name: string
  role: string
  fonction?: string | null
  telephone: string | null
  active: boolean
  entrepriseId: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    chantierAccess?: number
  }
}

interface UserFormData {
  name: string
  email: string
  password: string
  telephone: string
  role: string
  fonction: string
}

interface AuditLog {
  id: string
  userId: string
  utilisateur: {
    id: string
    name: string
    email: string
  } | null
  entrepriseId: string | null
  module: string
  action: string
  entityType: string | null
  entityId: string | null
  details: string | null
  adresseIp: string | null
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ChantierItem {
  id: string
  nom: string
  statut: string
  adresse: string | null
}

interface ChantierAccessEntry {
  chantierId: string
  roleAcces: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'roles', label: 'Permissions & Rôles', icon: Shield },
  { id: 'audit', label: "Journal d'Audit", icon: ScrollText },
]

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  GERANT: {
    label: 'Gérant',
    className: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border-amber-200',
  },
  CHEF_PROJET: {
    label: 'Chef de Projet',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  EMPLOYE: {
    label: 'Employé',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  EN_PREPARATION: { label: 'En préparation', className: 'bg-gray-100 text-gray-700' },
  EN_COURS: { label: 'En cours', className: 'bg-emerald-100 text-emerald-700' },
  EN_PAUSE: { label: 'En pause', className: 'bg-amber-100 text-amber-700' },
  TERMINE: { label: 'Terminé', className: 'bg-slate-100 text-slate-600' },
  RECEPTIONNE: { label: 'Réceptionné', className: 'bg-blue-100 text-blue-700' },
}

const ROLE_ACCES_LABELS: Record<string, string> = {
  LECTURE: 'Lecture seule',
  ECRITURE: 'Lecture + Écriture',
  GESTION: 'Gestion complète',
}

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}))

const MODULE_LABELS: Record<string, string> = {
  auth: 'Authentification',
  users: 'Utilisateurs',
  chantiers: 'Chantiers',
  personnel: 'Personnel',
  pointage: 'Pointage',
  stocks: 'Stocks',
  carburant: 'Carburant',
  engins: 'Engins',
  rapports: 'Rapports',
  budget: 'Budget',
  documents: 'Documents',
  permissions: 'Permissions',
}

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  CREATE: { label: 'Création', className: 'bg-emerald-100 text-emerald-700' },
  UPDATE: { label: 'Modification', className: 'bg-amber-100 text-amber-700' },
  DELETE: { label: 'Suppression', className: 'bg-red-100 text-red-700' },
  LOGIN: { label: 'Connexion', className: 'bg-blue-100 text-blue-700' },
  LOGOUT: { label: 'Déconnexion', className: 'bg-slate-100 text-slate-700' },
  BLOCK: { label: 'Blocage', className: 'bg-red-100 text-red-700' },
  UNBLOCK: { label: 'Déblocage', className: 'bg-emerald-100 text-emerald-700' },
  ROLE_CHANGE: { label: 'Changement rôle', className: 'bg-violet-100 text-violet-700' },
  PASSWORD_RESET: { label: 'Réinit. mot de passe', className: 'bg-amber-100 text-amber-700' },
  VALIDATE: { label: 'Validation', className: 'bg-emerald-100 text-emerald-700' },
}

const PERMISSION_LEVELS: Record<string, { label: string; bgClass: string; borderClass: string }> = {
  AUCUN: { label: 'Aucun', bgClass: 'bg-gray-100', borderClass: 'border-gray-300' },
  LECTURE: { label: 'Lecture', bgClass: 'bg-blue-50', borderClass: 'border-blue-300' },
  ECRITURE: { label: 'Écriture', bgClass: 'bg-amber-50', borderClass: 'border-amber-300' },
  GESTION: { label: 'Gestion', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300' },
}

// Enhanced cell-level config for clickable toggle buttons
const LEVEL_CELL_CONFIG: Record<string, { label: string; shortLabel: string; bgClass: string; textClass: string; hoverClass: string; ringClass: string }> = {
  GESTION: {
    label: 'Gestion complète',
    shortLabel: 'G',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-800',
    hoverClass: 'hover:bg-emerald-200',
    ringClass: 'ring-emerald-300',
  },
  ECRITURE: {
    label: 'Écriture',
    shortLabel: 'E',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-800',
    hoverClass: 'hover:bg-amber-200',
    ringClass: 'ring-amber-300',
  },
  LECTURE: {
    label: 'Lecture seule',
    shortLabel: 'L',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    hoverClass: 'hover:bg-blue-200',
    ringClass: 'ring-blue-300',
  },
  AUCUN: {
    label: 'Aucun accès',
    shortLabel: '—',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-400',
    hoverClass: 'hover:bg-gray-200',
    ringClass: 'ring-gray-300',
  },
}

// Level cycle order: AUCUN → LECTURE → ECRITURE → GESTION → AUCUN
const LEVEL_CYCLE = ['AUCUN', 'LECTURE', 'ECRITURE', 'GESTION']

const PERMISSION_MODULES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'chantiers', label: 'Chantiers' },
  { key: 'planning', label: 'Planning' },
  { key: 'pointage', label: 'Pointage' },
  { key: 'personnel', label: 'Personnel' },
  { key: 'paie', label: 'Paie' },
  { key: 'sous-traitants', label: 'Sous-traitants' },
  { key: 'budget', label: 'Budget' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'engins', label: 'Parc Engins' },
  { key: 'carburant', label: 'Carburant' },
  { key: 'rapports', label: 'Rapports' },
  { key: 'photos', label: 'Photos' },
  { key: 'documents', label: 'Documents' },
  { key: 'clients', label: 'Clients' },
  { key: 'devis', label: 'Devis' },
  { key: 'contrats', label: 'Contrats' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'support', label: 'Support' },
  { key: 'parametres', label: 'Paramètres' },
  { key: 'gestion-acces', label: 'Gestion Accès' },
]

const ROLES_LIST = ['GERANT', 'CHEF_PROJET', 'EMPLOYE']

const DEFAULT_PERMISSIONS: Record<string, Record<string, string>> = {
  GERANT: { dashboard: 'GESTION', chantiers: 'GESTION', planning: 'GESTION', pointage: 'GESTION', personnel: 'GESTION', paie: 'GESTION', 'sous-traitants': 'GESTION', budget: 'GESTION', stocks: 'GESTION', engins: 'GESTION', carburant: 'GESTION', rapports: 'GESTION', photos: 'GESTION', documents: 'GESTION', clients: 'GESTION', devis: 'GESTION', contrats: 'GESTION', facturation: 'GESTION', support: 'GESTION', parametres: 'GESTION', 'gestion-acces': 'GESTION' },
  CHEF_PROJET: { dashboard: 'ECRITURE', chantiers: 'ECRITURE', planning: 'ECRITURE', pointage: 'ECRITURE', personnel: 'LECTURE', paie: 'LECTURE', 'sous-traitants': 'LECTURE', budget: 'LECTURE', stocks: 'ECRITURE', engins: 'ECRITURE', carburant: 'ECRITURE', rapports: 'ECRITURE', photos: 'ECRITURE', documents: 'ECRITURE', clients: 'ECRITURE', devis: 'ECRITURE', contrats: 'ECRITURE', facturation: 'ECRITURE', support: 'ECRITURE', parametres: 'LECTURE', 'gestion-acces': 'AUCUN' },
  EMPLOYE: { dashboard: 'LECTURE', chantiers: 'LECTURE', planning: 'LECTURE', pointage: 'LECTURE', personnel: 'AUCUN', paie: 'AUCUN', 'sous-traitants': 'LECTURE', budget: 'LECTURE', stocks: 'LECTURE', engins: 'LECTURE', carburant: 'LECTURE', rapports: 'LECTURE', photos: 'LECTURE', documents: 'LECTURE', clients: 'LECTURE', devis: 'LECTURE', contrats: 'LECTURE', facturation: 'LECTURE', support: 'LECTURE', parametres: 'AUCUN', 'gestion-acces': 'AUCUN' },
}

const EMPTY_USER_FORM: UserFormData = {
  name: '',
  email: '',
  password: '',
  telephone: '',
  role: 'CONDUCTEUR',
  fonction: '',
}

const AUDIT_MODULE_FILTERS = [
  { value: '', label: 'Tous les modules' },
  { value: 'auth', label: 'Authentification' },
  { value: 'users', label: 'Utilisateurs' },
  { value: 'chantiers', label: 'Chantiers' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'pointage', label: 'Pointage' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'carburant', label: 'Carburant' },
  { value: 'engins', label: 'Engins' },
  { value: 'rapports', label: 'Rapports' },
  { value: 'budget', label: 'Budget' },
  { value: 'documents', label: 'Documents' },
  { value: 'permissions', label: 'Permissions' },
]

const AUDIT_ACTION_FILTERS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'LOGIN', label: 'Connexion' },
  { value: 'LOGOUT', label: 'Déconnexion' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'BLOCK', label: 'Blocage' },
  { value: 'UNBLOCK', label: 'Déblocage' },
  { value: 'ROLE_CHANGE', label: 'Changement rôle' },
  { value: 'PASSWORD_RESET', label: 'Réinit. mot de passe' },
  { value: 'VALIDATE', label: 'Validation' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Il y a ${diffD}j`
  return d.toLocaleDateString('fr-FR')
}

function formatExactTime(date: string | Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function getRoleBadge(role: string): { label: string; className: string } {
  return ROLE_CONFIG[role] || { label: role, className: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function getActionBadge(action: string): { label: string; className: string } {
  return ACTION_CONFIG[action] || { label: action, className: 'bg-gray-100 text-gray-600' }
}

function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] || module
}

function cycleToNextLevel(current: string): string {
  const idx = LEVEL_CYCLE.indexOf(current)
  if (idx === -1) return 'LECTURE'
  return LEVEL_CYCLE[(idx + 1) % LEVEL_CYCLE.length]
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function UsersTableSkeleton() {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48 hidden sm:block" />
              <Skeleton className="h-4 w-24 hidden md:block" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PermissionsTableSkeleton() {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-36" />
              {[...Array(8)].map((_, j) => (
                <Skeleton key={j} className="h-8 w-24 hidden lg:block" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AuditTableSkeleton() {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-48 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tab 1: UsersTab ────────────────────────────────────────────────────────

function UsersTab({ session }: { session: any }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormData>(EMPTY_USER_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Reset password dialog
  const [resetPwdOpen, setResetPwdOpen] = useState(false)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resettingPwd, setResettingPwd] = useState(false)

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Chantier assignment dialog
  const [chantierDialogOpen, setChantierDialogOpen] = useState(false)
  const [chantierUser, setChantierUser] = useState<User | null>(null)
  const [allChantiers, setAllChantiers] = useState<ChantierItem[]>([])
  const [selectedChantiers, setSelectedChantiers] = useState<Record<string, string>>({})
  const [chantierLoading, setChantierLoading] = useState(false)
  const [chantierSaving, setChantierSaving] = useState(false)

  // Computed filtered users
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = !roleFilter || u.role === roleFilter
    const matchStatus = !statusFilter || (statusFilter === 'active' ? u.active : !u.active)
    return matchSearch && matchRole && matchStatus
  })

  // Summary stats
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.active).length
  const blockedUsers = users.filter((u) => !u.active).length

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/users?pageSize=100')
      if (res.ok) {
        const json = await res.json()
        setUsers(json.data || [])
      } else {
        toast.error("Erreur lors du chargement des utilisateurs")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [fetchUsers])

  // Open create
  const openCreate = () => {
    setEditingUser(null)
    const pwd = generatePassword()
    setForm({ ...EMPTY_USER_FORM, password: pwd })
    setShowPassword(false)
    setFormOpen(true)
  }

  // Open edit
  const openEdit = (user: User) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      telephone: user.telephone || '',
      role: user.role,
      fonction: user.fonction || '',
    })
    setShowPassword(false)
    setFormOpen(true)
  }

  // Submit create/edit
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!form.email.trim()) {
      toast.error("L'email est requis")
      return
    }
    if (!editingUser && !form.password) {
      toast.error('Le mot de passe est requis')
      return
    }

    setSubmitting(true)
    try {
      let res: Response
      if (editingUser) {
        const body: any = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          telephone: form.telephone.trim() || null,
        }
        // Fonction is only meaningful for EMPLOYE — send it only in that case
        // (and send null otherwise so backend can clear it if role changed).
        if (form.role === 'EMPLOYE') {
          body.fonction = form.fonction || null
        } else {
          body.fonction = null
        }
        res = await fetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        const createBody: any = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          telephone: form.telephone.trim() || null,
        }
        if (form.role === 'EMPLOYE') {
          createBody.fonction = form.fonction || null
        }
        res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
        })
      }

      if (res.ok) {
        toast.success(editingUser ? 'Utilisateur mis à jour' : 'Utilisateur créé avec succès')
        setFormOpen(false)
        fetchUsers()
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

  // Toggle active
  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/v1/users/${user.id}/toggle-active`, {
        method: 'POST',
      })
      if (res.ok) {
        toast.success(user.active ? 'Utilisateur bloqué' : 'Utilisateur débloqué')
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  // Reset password
  const openResetPassword = (user: User) => {
    setResetPwdUser(user)
    setNewPassword('')
    setResetPwdOpen(true)
  }

  const handleResetPassword = async () => {
    if (!resetPwdUser) return
    setResettingPwd(true)
    try {
      const res = await fetch(`/api/v1/users/${resetPwdUser.id}/reset-password`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setNewPassword(data.newPassword)
        toast.success('Mot de passe réinitialisé')
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setResettingPwd(false)
    }
  }

  // Delete user
  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.name}" ? Cette action est irréversible.`
    )
    if (!confirmed) return

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Utilisateur supprimé')
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    }
  }

  const openChantierDialog = async (user: User) => {
    setChantierUser(user)
    setChantierDialogOpen(true)
    setChantierLoading(true)
    try {
      // Fetch all chantiers
      const chantiersRes = await fetch('/api/v1/chantiers')
      // Fetch user's current accesses
      const accessRes = await fetch(`/api/v1/users/${user.id}/chantiers`)

      if (chantiersRes.ok && accessRes.ok) {
        const chantiersData = await chantiersRes.json()
        const accessData = await accessRes.json()
        setAllChantiers((chantiersData.chantiers || chantiersData || []).map((c: any) => ({
          id: c.id,
          nom: c.nom,
          statut: c.statut,
          adresse: c.adresse || null,
        })))
        // Build selected map
        const accessMap: Record<string, string> = {}
        for (const access of (accessData.accesses || [])) {
          accessMap[access.chantierId] = access.roleAcces || 'LECTURE'
        }
        setSelectedChantiers(accessMap)
      } else {
        toast.error("Erreur lors du chargement des chantiers")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setChantierLoading(false)
    }
  }

  const handleSaveChantierAccess = async () => {
    if (!chantierUser) return
    setChantierSaving(true)
    try {
      const chantiers = Object.entries(selectedChantiers).map(([chantierId, roleAcces]) => ({
        chantierId,
        roleAcces,
      }))
      const res = await fetch(`/api/v1/users/${chantierUser.id}/chantiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chantiers }),
      })
      if (res.ok) {
        toast.success(`Accès chantier mis à jour pour ${chantierUser.name}`)
        setChantierDialogOpen(false)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setChantierSaving(false)
    }
  }

  const toggleChantierAccess = (chantierId: string) => {
    setSelectedChantiers((prev) => {
      const next = { ...prev }
      if (next[chantierId]) {
        delete next[chantierId]
      } else {
        next[chantierId] = 'LECTURE'
      }
      return next
    })
  }

  const hasActiveFilters = searchQuery || roleFilter || statusFilter

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Gestion des Utilisateurs</h2>
          <p className="text-sm text-muted-foreground mt-1">Gérer les comptes et les accès</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{totalUsers}</p>
                </div>
                <div className="p-2 rounded-lg border bg-gray-50 border-gray-200">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Actifs</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{activeUsers}</p>
                </div>
                <div className="p-2 rounded-lg border bg-emerald-50 border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Bloqués</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{blockedUsers}</p>
                </div>
                <div className="p-2 rounded-lg border bg-red-50 border-red-200">
                  <Lock className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="pl-9"
              />
            </div>
            <Select value={roleFilter || '__all__'} onValueChange={(v) => setRoleFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[140px]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="blocked">Bloqués</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="outline" onClick={() => { setSearchQuery(''); setRoleFilter(''); setStatusFilter('') }} className="gap-2">
                <FilterX className="w-4 h-4" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {loading ? (
        <UsersTableSkeleton />
      ) : filteredUsers.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasActiveFilters ? 'Aucun résultat' : 'Aucun utilisateur'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? 'Aucun utilisateur ne correspond à vos filtres.' : 'Commencez par créer un utilisateur.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Utilisateur</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Chantiers</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, index) => {
                    const roleBadge = getRoleBadge(user.role)
                    return (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="pl-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                              user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            )}>
                              {getInitials(user.name)}
                            </div>
                            <span className="font-medium text-foreground text-sm truncate max-w-[160px]">
                              {user.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {user.telephone || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className={cn('text-xs', roleBadge.className)}>
                              {roleBadge.label}
                            </Badge>
                            {user.role === 'EMPLOYE' && user.fonction && (
                              <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                                {getFonctionLabel(user.fonction)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              user.active
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                            )}
                          >
                            {user.active ? 'Actif' : 'Bloqué'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => openChantierDialog(user)}
                          >
                            {user._count?.chantierAccess ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                {user.active ? (
                                  <>
                                    <Lock className="w-4 h-4 mr-2" />
                                    Bloquer
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-4 h-4 mr-2" />
                                    Débloquer
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openResetPassword(user)}>
                                <KeyRound className="w-4 h-4 mr-2" />
                                Réinitialiser mot de passe
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openChantierDialog(user)}>
                                <Building2 className="w-4 h-4 mr-2" />
                                Accès Chantiers
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(user)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Modifiez les informations de l\'utilisateur.'
                : 'Remplissez les informations pour créer un nouvel utilisateur.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nom</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nom complet"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>
            {!editingUser && (
              <div className="grid gap-2">
                <Label htmlFor="user-password">Mot de passe</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mot de passe"
                      className="pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    title="Générer un mot de passe"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                {form.password && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(form.password)
                        toast.success('Mot de passe copié dans le presse-papiers')
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copier
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="user-telephone">Téléphone</Label>
              <Input
                id="user-telephone"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                placeholder="+225 XX XX XX XX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Rôle</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value, fonction: value === 'EMPLOYE' ? form.fonction : '' })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === 'EMPLOYE' && (
              <div className="grid gap-2">
                <Label htmlFor="user-fonction">
                  Fonction
                  <span className="text-xs text-muted-foreground font-normal ml-1">(optionnel)</span>
                </Label>
                <Select
                  value={form.fonction}
                  onValueChange={(value) => setForm({ ...form, fonction: value })}
                >
                  <SelectTrigger id="user-fonction">
                    <SelectValue placeholder="Sélectionner une fonction BTP" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_FONCTIONS.map((f: UserFonction) => (
                      <SelectItem key={f} value={f}>
                        {getFonctionLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Spécialisation BTP de l'employé (logistique, carburant, planning, qualité, etc.).
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwdOpen} onOpenChange={(open) => {
        if (!open) {
          setResetPwdUser(null)
          setNewPassword('')
        }
        setResetPwdOpen(open)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {resetPwdUser
                ? `Générer un nouveau mot de passe pour ${resetPwdUser.name}.`
                : 'Réinitialisation du mot de passe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {!newPassword ? (
              <div className="text-center py-4">
                <KeyRound className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Cliquez sur le bouton ci-dessous pour générer un nouveau mot de passe.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" />
                  <code className="text-sm font-mono font-bold text-emerald-700 flex-1 break-all">
                    {newPassword}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(newPassword)
                      toast.success('Mot de passe copié')
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Copiez ce mot de passe et communiquez-le à l&apos;utilisateur.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setResetPwdOpen(false)
              setResetPwdUser(null)
              setNewPassword('')
            }}>
              Fermer
            </Button>
            {!newPassword && (
              <Button
                onClick={handleResetPassword}
                disabled={resettingPwd}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {resettingPwd && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <KeyRound className="w-4 h-4 mr-2" />
                Générer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chantier Assignment Dialog */}
      <Dialog open={chantierDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setChantierUser(null)
          setSelectedChantiers({})
          setAllChantiers([])
        }
        setChantierDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Accès Chantiers - {chantierUser?.name}</DialogTitle>
            <DialogDescription>
              Attribuer ou modifier les accès aux chantiers
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {chantierLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Chargement des chantiers...</span>
              </div>
            ) : allChantiers.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Aucun chantier disponible</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96 pr-4">
                <div className="space-y-3">
                  {allChantiers.map((chantier) => {
                    const isChecked = !!selectedChantiers[chantier.id]
                    const statutCfg = STATUT_CONFIG[chantier.statut]
                    return (
                      <div
                        key={chantier.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                          isChecked ? 'bg-emerald-50/50 border-emerald-200' : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div className="pt-0.5">
                          <CheckboxUI
                            checked={isChecked}
                            onCheckedChange={() => toggleChantierAccess(chantier.id)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{chantier.nom}</span>
                            {statutCfg && (
                              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statutCfg.className)}>
                                {statutCfg.label}
                              </Badge>
                            )}
                          </div>
                          {chantier.adresse && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {chantier.adresse}
                            </p>
                          )}
                          {isChecked && (
                            <div className="mt-2">
                              <Select
                                value={selectedChantiers[chantier.id]}
                                onValueChange={(value) => setSelectedChantiers((prev) => ({ ...prev, [chantier.id]: value }))}
                              >
                                <SelectTrigger className="h-8 w-full max-w-[220px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_ACCES_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChantierDialogOpen(false)
              setChantierUser(null)
              setSelectedChantiers({})
              setAllChantiers([])
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveChantierAccess}
              disabled={chantierSaving || chantierLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {chantierSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── Tab 2: RolesTab (ADMIN only) — Enhanced ─────────────────────────────────

function RolesTab({ session }: { session: any }) {
  const [permissions, setPermissions] = useState<Record<string, Record<string, string>>>({})
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Copy role dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySource, setCopySource] = useState('')
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set())

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(originalPermissions)
  }, [permissions, originalPermissions])

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Role summaries: counts of GESTION, ECRITURE, LECTURE, AUCUN per role
  const roleSummaries = useMemo(() => {
    return ROLES_LIST.map((role) => {
      const rolePerms = permissions[role] || {}
      const counts = { GESTION: 0, ECRITURE: 0, LECTURE: 0, AUCUN: 0 }
      PERMISSION_MODULES.forEach((mod) => {
        const level = rolePerms[mod.key] || 'AUCUN'
        if (level in counts) counts[level]++
        else counts.AUCUN++
      })
      return { role, ...counts, total: PERMISSION_MODULES.length }
    })
  }, [permissions])

  // Copy role preview: modules that will change
  const copyPreview = useMemo(() => {
    if (!copySource || copyTargets.size === 0) return []
    const sourcePerms = permissions[copySource] || {}
    return PERMISSION_MODULES.map((mod) => {
      const changes: { target: string; oldVal: string; newVal: string }[] = []
      copyTargets.forEach((target) => {
        const currentVal = permissions[target]?.[mod.key] || 'AUCUN'
        const newVal = sourcePerms[mod.key] || 'AUCUN'
        if (currentVal !== newVal) {
          changes.push({ target, oldVal: currentVal, newVal })
        }
      })
      return { module: mod, changes }
    }).filter((item) => item.changes.length > 0)
  }, [copySource, copyTargets, permissions])

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/permissions')
      if (res.ok) {
        const json = await res.json()
        const perms = json.permissions || {}
        setPermissions(perms)
        setOriginalPermissions(JSON.parse(JSON.stringify(perms)))
      } else {
        toast.error("Erreur lors du chargement des permissions")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPermissions()
  }, [fetchPermissions])

  const updatePermission = (role: string, module: string, level: string) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [module]: level,
      },
    }))
  }

  const handleCycleLevel = (role: string, module: string) => {
    const current = permissions[role]?.[module] || 'AUCUN'
    const next = cycleToNextLevel(current)
    updatePermission(role, module, next)
  }

  const handleBulkSet = (role: string, level: string) => {
    const newPerms: Record<string, string> = {}
    PERMISSION_MODULES.forEach((mod) => {
      newPerms[mod.key] = level
    })
    setPermissions((prev) => ({
      ...prev,
      [role]: newPerms,
    }))
    toast.success(`${getRoleBadge(role).label} : tous les modules définis sur ${PERMISSION_LEVELS[level]?.label || level}`)
  }

  const handleResetDefault = () => {
    if (window.confirm('Réinitialiser toutes les permissions par défaut ? Les modifications non sauvegardées seront perdues.')) {
      const defaults = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS))
      setPermissions(defaults)
      toast.success('Permissions réinitialisées par défaut')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/v1/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      })
      if (res.ok) {
        setOriginalPermissions(JSON.parse(JSON.stringify(permissions)))
        toast.success('Permissions enregistrées avec succès')
      } else {
        const data = await res.json()
        toast.error(data.error || "Une erreur est survenue")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSaving(false)
    }
  }

  // Copy role handlers
  const openCopyDialog = () => {
    setCopySource('')
    setCopyTargets(new Set())
    setCopyDialogOpen(true)
  }

  const handleCopyRole = () => {
    if (!copySource || copyTargets.size === 0) return
    const sourcePerms = permissions[copySource] || {}
    setPermissions((prev) => {
      const next = { ...prev }
      copyTargets.forEach((target) => {
        next[target] = { ...sourcePerms }
      })
      return next
    })
    const sourceLabel = getRoleBadge(copySource).label
    const targetLabels = Array.from(copyTargets).map((t) => getRoleBadge(t).label).join(', ')
    toast.success(`Permissions copiées de ${sourceLabel} vers ${targetLabels}`)
    setCopyDialogOpen(false)
    setCopySource('')
    setCopyTargets(new Set())
  }

  const toggleCopyTarget = (role: string) => {
    setCopyTargets((prev) => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Permissions & Rôles</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurer les accès par module pour chaque rôle
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={openCopyDialog}
            className="gap-2"
            disabled={loading}
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Copier un rôle...</span>
            <span className="sm:hidden">Copier</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleResetDefault}
            className="gap-2"
            disabled={loading}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Par défaut</span>
          </Button>
        </div>
      </div>

      {/* Role Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {roleSummaries.map((summary, idx) => {
            const roleBadge = getRoleBadge(summary.role)
            const total = summary.total
            return (
              <motion.div
                key={summary.role}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
              >
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', roleBadge.className)}>
                        {roleBadge.label}
                      </Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="flex rounded-full overflow-hidden h-2 bg-gray-100 mb-1.5">
                      {summary.GESTION > 0 && (
                        <div
                          className="bg-emerald-500 transition-all duration-300"
                          style={{ width: `${(summary.GESTION / total) * 100}%` }}
                        />
                      )}
                      {summary.ECRITURE > 0 && (
                        <div
                          className="bg-amber-400 transition-all duration-300"
                          style={{ width: `${(summary.ECRITURE / total) * 100}%` }}
                        />
                      )}
                      {summary.LECTURE > 0 && (
                        <div
                          className="bg-blue-400 transition-all duration-300"
                          style={{ width: `${(summary.LECTURE / total) * 100}%` }}
                        />
                      )}
                      {summary.AUCUN > 0 && (
                        <div
                          className="bg-gray-200 transition-all duration-300"
                          style={{ width: `${(summary.AUCUN / total) * 100}%` }}
                        />
                      )}
                    </div>
                    {/* Count badges */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {summary.GESTION > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {summary.GESTION}G
                        </span>
                      )}
                      {summary.ECRITURE > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {summary.ECRITURE}E
                        </span>
                      )}
                      {summary.LECTURE > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                          {summary.LECTURE}L
                        </span>
                      )}
                      {summary.AUCUN > 0 && (
                        <span className="flex items-center gap-0.5 text-gray-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                          {summary.AUCUN}—
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Permissions Matrix */}
      {loading ? (
        <PermissionsTableSkeleton />
      ) : (
        <>
          {/* Legend bar */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground px-1">
            <span className="font-medium text-foreground">Légende :</span>
            {Object.entries(LEVEL_CELL_CONFIG).map(([key, cfg]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold', cfg.bgClass, cfg.textClass)}>
                  {cfg.shortLabel}
                </span>
                <span>{cfg.label}</span>
              </span>
            ))}
            <span className="text-muted-foreground/60">•</span>
            <span>Cliquez pour changer le niveau</span>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 min-w-[160px] sticky left-0 bg-background z-10">Rôle</TableHead>
                      {PERMISSION_MODULES.map((mod) => (
                        <TableHead key={mod.key} className="min-w-[56px] text-center text-xs font-medium px-1 py-3">
                          {mod.label}
                        </TableHead>
                      ))}
                      <TableHead className="min-w-[44px] text-center text-xs font-medium px-1 py-3 sticky right-0 bg-background z-10">
                        <span className="sr-only">Actions en masse</span>
                        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ROLES_LIST.map((role) => {
                      const roleBadge = getRoleBadge(role)
                      return (
                        <TableRow key={role}>
                          <TableCell className="pl-4 py-2 sticky left-0 bg-background z-10">
                            <Badge variant="outline" className={cn('text-xs', roleBadge.className)}>
                              {roleBadge.label}
                            </Badge>
                          </TableCell>
                          {PERMISSION_MODULES.map((mod) => {
                            const currentLevel = permissions[role]?.[mod.key] || 'AUCUN'
                            const cellCfg = LEVEL_CELL_CONFIG[currentLevel] || LEVEL_CELL_CONFIG.AUCUN
                            return (
                              <TableCell key={mod.key} className="px-1 py-1.5 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => handleCycleLevel(role, mod.key)}
                                      className={cn(
                                        'inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold',
                                        'border transition-all duration-150 cursor-pointer select-none',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                                        cellCfg.bgClass,
                                        cellCfg.textClass,
                                        cellCfg.hoverClass,
                                        `focus-visible:${cellCfg.ringClass}`,
                                        'border-transparent hover:border-current/20',
                                        'active:scale-95'
                                      )}
                                    >
                                      {cellCfg.shortLabel}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <span>{mod.label} — {cellCfg.label}</span>
                                    <br />
                                    <span className="text-muted-foreground">Cliquez pour : {LEVEL_CELL_CONFIG[cycleToNextLevel(currentLevel)]?.label}</span>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            )
                          })}
                          {/* Bulk Actions Column */}
                          <TableCell className="px-1 py-2 text-center sticky right-0 bg-background z-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleBulkSet(role, 'GESTION')}>
                                  <Check className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                  <span>Tout autoriser (GESTION)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBulkSet(role, 'LECTURE')}>
                                  <Eye className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                  <span>Lecture seule (LECTURE)</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleBulkSet(role, 'AUCUN')} className="text-red-600 focus:text-red-600">
                                  <Lock className="w-3.5 h-3.5 mr-2" />
                                  <span>Tout interdire (AUCUN)</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save Button with unsaved changes indicator */}
      <div className="flex items-center justify-end gap-3">
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Modifications non sauvegardées</span>
          </motion.div>
        )}
        <Button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          Appliquer les permissions
        </Button>
      </div>

      {/* Copy Role Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCopySource('')
          setCopyTargets(new Set())
        }
        setCopyDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copier les permissions d&apos;un rôle</DialogTitle>
            <DialogDescription>
              Sélectionnez un rôle source et les rôles cibles pour copier les permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Source role */}
            <div className="grid gap-2">
              <Label>Rôle source</Label>
              <Select value={copySource} onValueChange={(v) => setCopySource(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le rôle source" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_LIST.map((role) => {
                    const cfg = getRoleBadge(role)
                    return (
                      <SelectItem key={role} value={role}>
                        {cfg.label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Target roles */}
            <div className="grid gap-2">
              <Label>Rôles cibles</Label>
              <div className="space-y-2">
                {ROLES_LIST.map((role) => {
                  const cfg = getRoleBadge(role)
                  const isDisabled = role === copySource
                  const isChecked = copyTargets.has(role)
                  return (
                    <label
                      key={role}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                        isDisabled ? 'opacity-40 cursor-not-allowed border-gray-100' : isChecked ? 'bg-emerald-50/50 border-emerald-200' : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <CheckboxUI
                        checked={isChecked}
                        disabled={isDisabled}
                        onCheckedChange={() => toggleCopyTarget(role)}
                      />
                      <Badge variant="outline" className={cn('text-xs', cfg.className)}>
                        {cfg.label}
                      </Badge>
                      {isDisabled && copySource === role && (
                        <span className="text-xs text-muted-foreground">(source)</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Preview */}
            {copyPreview.length > 0 && (
              <div className="grid gap-2">
                <Label>Aperçu des modifications ({copyPreview.length} module(s))</Label>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {copyPreview.slice(0, 10).map((item) => (
                      <div key={item.module.key} className="text-xs bg-muted/50 rounded px-2.5 py-1.5">
                        <span className="font-medium text-foreground">{item.module.label}</span>
                        <span className="text-muted-foreground mx-1">:</span>
                        {item.changes.map((change) => {
                          const oldCfg = LEVEL_CELL_CONFIG[change.oldVal]
                          const newCfg = LEVEL_CELL_CONFIG[change.newVal]
                          return (
                            <span key={change.target} className="inline-flex items-center gap-0.5 mr-2">
                              <span className="text-muted-foreground">{getRoleBadge(change.target).label}</span>
                              <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold', oldCfg?.bgClass, oldCfg?.textClass)}>
                                {oldCfg?.shortLabel}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold', newCfg?.bgClass, newCfg?.textClass)}>
                                {newCfg?.shortLabel}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    ))}
                    {copyPreview.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        ... et {copyPreview.length - 10} autre(s) modification(s)
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCopyDialogOpen(false)
              setCopySource('')
              setCopyTargets(new Set())
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleCopyRole}
              disabled={!copySource || copyTargets.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Copy className="w-4 h-4" />
              Copier les permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── Tab 3: AuditTab ────────────────────────────────────────────────────────

interface AuditStats {
  totalLogs: number
  todayLogs: number
  activeUsers24h: number
  lastAction: string | null
  lastActionInfo: { action: string; module: string; userId: string } | null
  actionsPerModule: { module: string; count: number }[]
  actionsPerDay: { date: string; count: number }[]
  topUsers: { userId: string; name: string; role: string | null; count: number }[]
  actionsByType: { action: string; count: number }[]
}

function getActionDotColor(action: string): string {
  const c = ACTION_CONFIG[action]?.className || ''
  if (c.includes('emerald')) return 'bg-emerald-500'
  if (c.includes('red')) return 'bg-red-500'
  if (c.includes('amber')) return 'bg-amber-500'
  if (c.includes('violet')) return 'bg-violet-500'
  if (c.includes('blue')) return 'bg-blue-500'
  if (c.includes('slate')) return 'bg-slate-400'
  return 'bg-gray-400'
}

function formatAuditDetails(details: string | null): string {
  if (!details) return '—'
  try {
    const parsed = JSON.parse(details)
    return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)
  } catch {
    return details
  }
}

function AuditTab() {
  /* ── State ──────────────────────────────────────────────────────────────── */
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filters
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // View
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showStats, setShowStats] = useState(false)

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)

  // Data
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [exporting, setExporting] = useState(false)

  // Refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchLogsRef = useRef<(page?: number) => Promise<void>>(() => Promise.resolve())
  const fetchStatsRef = useRef<() => Promise<void>>(() => Promise.resolve())

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  const buildFilterParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams()
    if (moduleFilter) params.set('module', moduleFilter)
    if (actionFilter) params.set('action', actionFilter)
    if (userFilter) params.set('userId', userFilter)
    if (searchQuery) params.set('search', searchQuery)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params
  }, [moduleFilter, actionFilter, userFilter, searchQuery, dateFrom, dateTo])

  const hasActiveFilters = !!(
    moduleFilter || actionFilter || userFilter || searchQuery || dateFrom || dateTo
  )

  /* ── Fetch Functions ────────────────────────────────────────────────────── */
  const fetchLogs = useCallback(
    async (page: number = 1) => {
      setLoading(true)
      try {
        const params = buildFilterParams()
        params.set('page', String(page))
        params.set('limit', '20')
        const res = await fetch(`/api/v1/audit-logs?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          setLogs(json.logs || [])
          setPagination(
            json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
          )
        } else {
          toast.error("Erreur lors du chargement du journal d'audit")
        }
      } catch {
        toast.error('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    },
    [buildFilterParams]
  )

  const fetchStats = useCallback(async () => {
    try {
      const params = buildFilterParams()
      params.set('days', '30')
      const res = await fetch(`/api/v1/audit-logs/stats?${params.toString()}`)
      if (res.ok) {
        setStats(await res.json())
      }
    } catch {
      /* silent — stats are supplementary */
    }
  }, [buildFilterParams])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/users?pageSize=100')
      if (res.ok) {
        const json = await res.json()
        setAllUsers(json.data || [])
      }
    } catch {
      /* silent */
    }
  }, [])

  /* ── Actions ────────────────────────────────────────────────────────────── */
  const resetFilters = useCallback(() => {
    setModuleFilter('')
    setActionFilter('')
    setUserFilter('')
    setSearchInput('')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
  }, [])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleExportCSV = useCallback(async () => {
    setExporting(true)
    try {
      const params = buildFilterParams()
      params.set('export', 'csv')
      params.set('limit', '500')
      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`)
      if (!res.ok) {
        toast.error("Erreur lors de l'export")
        return
      }
      const json = await res.json()
      const exportLogs: AuditLog[] = json.logs || []

      const headers = [
        'Date',
        'Utilisateur',
        'Email',
        'Module',
        'Action',
        'Type Entité',
        'ID Entité',
        'Détails',
        'Adresse IP',
      ]
      const rows = exportLogs.map((log) => [
        formatExactTime(log.createdAt),
        log.utilisateur?.name || 'Utilisateur supprimé',
        log.utilisateur?.email || '',
        getModuleLabel(log.module),
        getActionBadge(log.action).label,
        log.entityType || '',
        log.entityId || '',
        log.details || '',
        log.adresseIp || '',
      ])
      const csvContent = [
        headers.join(';'),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
        ),
      ].join('\n')

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`${exportLogs.length} entrées exportées en CSV`)
    } catch {
      toast.error("Erreur lors de l'export")
    } finally {
      setExporting(false)
    }
  }, [buildFilterParams])

  /* ── Refs for auto-refresh (stable references) ──────────────────────────── */
  useEffect(() => {
    fetchLogsRef.current = fetchLogs
    fetchStatsRef.current = fetchStats
  })

  /* ── Effects ────────────────────────────────────────────────────────────── */
  // Fetch users list once on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [fetchUsers])

  // Refetch logs + stats when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(1)
    fetchStats()
  }, [fetchLogs, fetchStats])

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchInput])

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      fetchLogsRef.current(pagination.page)
      fetchStatsRef.current()
    }, refreshInterval * 1000)
    return () => clearInterval(id)
  }, [autoRefresh, refreshInterval, pagination.page])

  /* ── Memos ──────────────────────────────────────────────────────────────── */
  const groupedLogsByDate = useMemo(() => {
    const groups: Record<string, AuditLog[]> = {}
    for (const log of logs) {
      const dateKey = new Date(log.createdAt).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(log)
    }
    return Object.entries(groups).map(([date, items]) => ({ date, items }))
  }, [logs])

  const startIdx =
    pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0
  const endIdx = Math.min(pagination.page * pagination.limit, pagination.total)

  /* ── Shared Detail Panel ────────────────────────────────────────────────── */
  const renderDetailPanel = (log: AuditLog) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-3 border-t mt-3">
      <div>
        <span className="text-muted-foreground text-xs">Adresse IP</span>
        <p className="font-mono mt-0.5">{log.adresseIp || '—'}</p>
      </div>
      <div>
        <span className="text-muted-foreground text-xs">Type d&apos;entité</span>
        <p className="mt-0.5">{log.entityType || '—'}</p>
      </div>
      <div>
        <span className="text-muted-foreground text-xs">ID entité</span>
        <p className="font-mono mt-0.5 text-xs">{log.entityId || '—'}</p>
      </div>
      <div>
        <span className="text-muted-foreground text-xs">Date exacte</span>
        <p className="mt-0.5">{formatExactTime(log.createdAt)}</p>
      </div>
      {log.details && (
        <div className="sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground text-xs">Détails complets</span>
          <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {formatAuditDetails(log.details)}
          </pre>
        </div>
      )}
    </div>
  )

  /* ── JSX ────────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Journal d&apos;Audit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Historique complet de toutes les actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                <Timer className="w-4 h-4" />
                {autoRefresh && (
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
                <span className="hidden sm:inline">
                  {autoRefresh ? `${refreshInterval}s` : 'Auto'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAutoRefresh(false)}>
                Désactivée
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setAutoRefresh(true)
                  setRefreshInterval(30)
                }}
              >
                <span className="flex-1">Toutes les 30s</span>
                {autoRefresh && refreshInterval === 30 && (
                  <Check className="w-3 h-3 text-emerald-600" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAutoRefresh(true)
                  setRefreshInterval(60)
                }}
              >
                <span className="flex-1">Toutes les 60s</span>
                {autoRefresh && refreshInterval === 60 && (
                  <Check className="w-3 h-3 text-emerald-600" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAutoRefresh(true)
                  setRefreshInterval(120)
                }}
              >
                <span className="flex-1">Toutes les 2 min</span>
                {autoRefresh && refreshInterval === 120 && (
                  <Check className="w-3 h-3 text-emerald-600" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="gap-1.5"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Exporter CSV</span>
          </Button>
        </div>
      </div>

      {/* ── Summary Stats Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Total (période)
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
                    {stats?.totalLogs ?? '—'}
                  </p>
                </div>
                <div className="p-2 rounded-lg border bg-gray-50 border-gray-200">
                  <ScrollText className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Aujourd&apos;hui
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
                    {stats?.todayLogs ?? '—'}
                  </p>
                </div>
                <div className="p-2 rounded-lg border bg-emerald-50 border-emerald-200">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Utilisateurs actifs 24h
                  </p>
                  <p className="text-xl sm:text-2xl font-bold mt-1 text-foreground">
                    {stats?.activeUsers24h ?? '—'}
                  </p>
                </div>
                <div className="p-2 rounded-lg border bg-amber-50 border-amber-200">
                  <Users className="w-4 h-4 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Dernière action
                  </p>
                  <p className="text-base sm:text-lg font-bold mt-1 text-foreground">
                    {stats?.lastAction
                      ? formatRelativeTime(stats.lastAction)
                      : '—'}
                  </p>
                </div>
                <div className="p-2 rounded-lg border bg-violet-50 border-violet-200">
                  <Clock className="w-4 h-4 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Module */}
            <Select
              value={moduleFilter || '__all__'}
              onValueChange={(v) => setModuleFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les modules" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_MODULE_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action */}
            <Select
              value={actionFilter || '__all__'}
              onValueChange={(v) => setActionFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Toutes les actions" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_ACTION_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User */}
            <Select
              value={userFilter || '__all__'}
              onValueChange={(v) => setUserFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les utilisateurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les utilisateurs</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher dans les détails…"
                className="pl-9"
              />
            </div>
          </div>

          {/* Date range + Reset */}
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="relative flex-1 max-w-[200px]">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Du"
                className="pl-9"
              />
            </div>
            <div className="relative flex-1 max-w-[200px]">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Au"
                className="pl-9"
              />
            </div>
            <div className="flex-1" />
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="gap-2 shrink-0"
              >
                <FilterX className="w-4 h-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── View Toggle + Row Count ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-1.5"
          >
            <LayoutPanelLeft className="w-4 h-4" />
            Tableau
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="gap-1.5"
          >
            <LayoutList className="w-4 h-4" />
            Timeline
          </Button>
        </div>
        {!loading && pagination.total > 0 && (
          <p className="text-sm text-muted-foreground">
            Affichage de {startIdx} à {endIdx} sur {pagination.total} résultats
          </p>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <AuditTableSkeleton />
      ) : logs.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <ScrollText className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucune action trouvée
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters
                ? 'Aucune entrée ne correspond à vos filtres.'
                : "Aucune action enregistrée."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="mt-4 gap-2"
              >
                <FilterX className="w-4 h-4" />
                Réinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        /* ── Table View ──────────────────────────────────────────────────── */
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date/Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Module
                    </TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Détails
                    </TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, index) => {
                    const actionBadge = getActionBadge(log.action)
                    const isExpanded = expandedRows.has(log.id)
                    return (
                      <Fragment key={log.id}>
                        <motion.tr
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.15,
                            delay: index * 0.015,
                          }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="pl-4 py-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground cursor-default">
                                  {formatRelativeTime(log.createdAt)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {formatExactTime(log.createdAt)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                                {log.utilisateur
                                  ? getInitials(log.utilisateur.name)
                                  : '?'}
                              </div>
                              <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                                {log.utilisateur?.name ||
                                  'Utilisateur supprimé'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge
                              variant="outline"
                              className="text-xs bg-gray-50 text-gray-700 border-gray-200"
                            >
                              {getModuleLabel(log.module)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', actionBadge.className)}
                            >
                              {actionBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
                              {log.details || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="pr-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toggleExpanded(log.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                        </motion.tr>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell
                              colSpan={6}
                              className="px-4 sm:px-6 py-4"
                            >
                              {renderDetailPanel(log)}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Timeline View ──────────────────────────────────────────────── */
        <div className="relative pl-8">
          {/* Vertical connecting line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

          {groupedLogsByDate.map(({ date, items }) => (
            <div key={date} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
                {date}
              </h3>
              <div className="space-y-3">
                {items.map((log) => {
                  const actionBadge = getActionBadge(log.action)
                  const isExpanded = expandedRows.has(log.id)
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative"
                    >
                      {/* Colored dot */}
                      <div
                        className={cn(
                          'absolute -left-5 top-4 w-3 h-3 rounded-full border-2 border-background z-10',
                          getActionDotColor(log.action)
                        )}
                      />

                      <Card
                        className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => toggleExpanded(log.id)}
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start gap-3">
                            {/* Time */}
                            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap mt-0.5">
                              {new Date(
                                log.createdAt
                              ).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {/* Avatar */}
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                              {log.utilisateur
                                ? getInitials(log.utilisateur.name)
                                : '?'}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">
                                  {log.utilisateur?.name ||
                                    'Utilisateur supprimé'}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs',
                                    actionBadge.className
                                  )}
                                >
                                  {actionBadge.label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-gray-50 text-gray-700 border-gray-200"
                                >
                                  {getModuleLabel(log.module)}
                                </Badge>
                              </div>
                              {log.details && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {log.details}
                                </p>
                              )}
                            </div>

                            {/* Expand icon */}
                            <div className="shrink-0 mt-0.5">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="overflow-hidden"
                            >
                              {renderDetailPanel(log)}
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} sur {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="gap-1"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Statistics Section (collapsible) ─────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
          >
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Statistiques</span>
            {showStats ? (
              <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
            )}
          </button>

          {showStats && stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 space-y-8"
            >
              {/* Actions par module */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Actions par module
                </h4>
                <div className="space-y-2.5">
                  {(stats.actionsPerModule || [])
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8)
                    .map((item) => {
                      const maxVal = Math.max(
                        ...(stats.actionsPerModule || []).map((m) => m.count),
                        1
                      )
                      return (
                        <div key={item.module} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 sm:w-36 truncate shrink-0">
                            {getModuleLabel(item.module)}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${(item.count / maxVal) * 100}%`,
                              }}
                              transition={{ duration: 0.6, delay: 0.1 }}
                              className="h-full bg-emerald-500 rounded-full"
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Actions par jour */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Actions par jour (14 derniers jours)
                </h4>
                {(() => {
                  const days = (stats.actionsPerDay || [])
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(-14)
                  const maxVal = Math.max(...days.map((d) => d.count), 1)
                  return days.length > 0 ? (
                    <div className="flex items-end gap-1 sm:gap-1.5 h-36">
                      {days.map((item) => {
                        const height = Math.max(
                          (item.count / maxVal) * 100,
                          3
                        )
                        const label = new Date(item.date).toLocaleDateString(
                          'fr-FR',
                          { day: '2-digit', month: '2-digit' }
                        )
                        return (
                          <div
                            key={item.date}
                            className="flex-1 flex flex-col items-center gap-1 min-w-0"
                          >
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                              {item.count}
                            </span>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              transition={{ duration: 0.4 }}
                              className="w-full bg-emerald-400 rounded-t min-h-[3px]"
                            />
                            <span className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">
                              {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune donnée disponible
                    </p>
                  )
                })()}
              </div>

              {/* Top utilisateurs */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Top utilisateurs
                </h4>
                <div className="space-y-2.5">
                  {(stats.topUsers || []).slice(0, 10).map((user, idx) => {
                    const maxVal = stats.topUsers?.[0]?.count || 1
                    return (
                      <div key={user.userId} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5 text-right font-mono">
                          {idx + 1}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate">
                              {user.name}
                            </span>
                            {user.role && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {ROLE_CONFIG[user.role]?.label || user.role}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(user.count / maxVal) * 100}%`,
                                }}
                                transition={{ duration: 0.4 }}
                                className="h-full bg-amber-500 rounded-full"
                              />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground shrink-0">
                              {user.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {(!stats.topUsers || stats.topUsers.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      Aucune donnée disponible
                    </p>
                  )}
                </div>
              </div>

              {/* Distribution par type d'action */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  Distribution par type d&apos;action
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(stats.actionsByType || [])
                    .sort((a, b) => b.count - a.count)
                    .map((item) => {
                      const badge = getActionBadge(item.action)
                      return (
                        <Badge
                          key={item.action}
                          variant="outline"
                          className={cn(
                            'text-xs gap-1.5 px-2.5 py-1',
                            badge.className
                          )}
                        >
                          {badge.label}
                          <span className="font-bold">{item.count}</span>
                        </Badge>
                      )
                    })}
                  {(!stats.actionsByType ||
                    stats.actionsByType.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      Aucune donnée disponible
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {showStats && !stats && (
            <div className="mt-6 flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">
                Chargement des statistiques…
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}


// ─── Main Component ─────────────────────────────────────────────────────────

function GestionAccesView() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('users')
  const userRole = (session?.user as any)?.role

  const visibleTabs = TABS.filter((t) => t.id !== 'roles' || userRole === 'ADMIN')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion des Accès</h1>
        <p className="text-muted-foreground">
          Administrer les utilisateurs, les permissions et suivre l&apos;activité
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                <Icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <TabsContent value="users">
          <UsersTab session={session} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab session={session} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { GestionAccesView }
