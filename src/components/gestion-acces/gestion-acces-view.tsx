'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
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
  Loader2,
  Save,
  RefreshCw,
  Building2,
  Checkbox,
  AlertTriangle,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string
  email: string
  name: string
  role: string
  telephone: string | null
  active: boolean
  entrepriseId: string | null
  createdAt: string
  updatedAt: string
  _count: {
    chantierAccess: number
  }
}

interface UserFormData {
  name: string
  email: string
  password: string
  telephone: string
  role: string
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
  ADMIN: {
    label: 'Administrateur',
    className: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200',
  },
  CHEF_ENTREPRISE: {
    label: "Chef d'entreprise",
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  CONDUCTEUR: {
    label: 'Conducteur',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  CHEF_CHANTIER: {
    label: 'Chef de chantier',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  SOUS_TRAITANT: {
    label: 'Sous-traitant',
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
  { key: 'parametres', label: 'Paramètres' },
  { key: 'gestion-acces', label: 'Gestion Accès' },
]

const ROLES_LIST = ['ADMIN', 'CHEF_ENTREPRISE', 'CONDUCTEUR', 'CHEF_CHANTIER', 'SOUS_TRAITANT']

const DEFAULT_PERMISSIONS: Record<string, Record<string, string>> = {
  ADMIN: { dashboard: 'GESTION', chantiers: 'GESTION', planning: 'GESTION', pointage: 'GESTION', personnel: 'GESTION', paie: 'GESTION', 'sous-traitants': 'GESTION', budget: 'GESTION', stocks: 'GESTION', engins: 'GESTION', carburant: 'GESTION', rapports: 'GESTION', photos: 'GESTION', documents: 'GESTION', parametres: 'GESTION', 'gestion-acces': 'GESTION' },
  CHEF_ENTREPRISE: { dashboard: 'GESTION', chantiers: 'GESTION', planning: 'GESTION', pointage: 'GESTION', personnel: 'GESTION', paie: 'GESTION', 'sous-traitants': 'GESTION', budget: 'GESTION', stocks: 'GESTION', engins: 'GESTION', carburant: 'GESTION', rapports: 'GESTION', photos: 'GESTION', documents: 'GESTION', parametres: 'ECRITURE', 'gestion-acces': 'GESTION' },
  CONDUCTEUR: { dashboard: 'LECTURE', chantiers: 'ECRITURE', planning: 'ECRITURE', pointage: 'ECRITURE', personnel: 'LECTURE', paie: 'LECTURE', 'sous-traitants': 'LECTURE', budget: 'LECTURE', stocks: 'ECRITURE', engins: 'GESTION', carburant: 'GESTION', rapports: 'ECRITURE', photos: 'ECRITURE', documents: 'ECRITURE', parametres: 'LECTURE', 'gestion-acces': 'AUCUN' },
  CHEF_CHANTIER: { dashboard: 'LECTURE', chantiers: 'ECRITURE', planning: 'LECTURE', pointage: 'GESTION', personnel: 'LECTURE', paie: 'LECTURE', 'sous-traitants': 'LECTURE', budget: 'LECTURE', stocks: 'ECRITURE', engins: 'LECTURE', carburant: 'ECRITURE', rapports: 'ECRITURE', photos: 'ECRITURE', documents: 'ECRITURE', parametres: 'LECTURE', 'gestion-acces': 'AUCUN' },
  SOUS_TRAITANT: { dashboard: 'AUCUN', chantiers: 'LECTURE', planning: 'AUCUN', pointage: 'AUCUN', personnel: 'AUCUN', paie: 'AUCUN', 'sous-traitants': 'ECRITURE', budget: 'LECTURE', stocks: 'AUCUN', engins: 'AUCUN', carburant: 'AUCUN', rapports: 'LECTURE', photos: 'LECTURE', documents: 'LECTURE', parametres: 'AUCUN', 'gestion-acces': 'AUCUN' },
}

const EMPTY_USER_FORM: UserFormData = {
  name: '',
  email: '',
  password: '',
  telephone: '',
  role: 'CONDUCTEUR',
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
      const res = await fetch('/api/users')
      if (res.ok) {
        const json = await res.json()
        setUsers(json.users || [])
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
        res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            telephone: form.telephone.trim() || null,
          }),
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
      const res = await fetch(`/api/users/${user.id}/toggle-active`, {
        method: 'PATCH',
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
      const res = await fetch(`/api/users/${resetPwdUser.id}/reset-password`, {
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
      const res = await fetch(`/api/users/${user.id}`, {
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
      const chantiersRes = await fetch('/api/chantiers')
      // Fetch user's current accesses
      const accessRes = await fetch(`/api/users/${user.id}/chantiers`)

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
      const res = await fetch(`/api/users/${chantierUser.id}/chantiers`, {
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
                          <Badge variant="outline" className={cn('text-xs', roleBadge.className)}>
                            {roleBadge.label}
                          </Badge>
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
                            {user._count.chantierAccess}
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
                onValueChange={(value) => setForm({ ...form, role: value })}
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
      const res = await fetch('/api/permissions')
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
      const res = await fetch('/api/permissions', {
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

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [oduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Summary stats
  const [todayCount, setTodayCount] = useState(0)
  const [activeUsers24h, setActiveUsers24h] = useState(0)
  const [lastActionTime, setLastActionTime] = useState<string | null>(null)

  const fetchLogs = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (moduleFilter) params.set('module', moduleFilter)
      if (actionFilter) params.set('action', actionFilter)

      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setLogs(json.logs || [])
        setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })

        // Compute summary from all logs
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        const allLogs: AuditLog[] = json.logs || []
        setTodayCount(allLogs.filter((l) => new Date(l.createdAt) >= todayStart).length)
        const activeUsers = new Set(
          allLogs
            .filter((l) => new Date(l.createdAt) >= h24ago && l.userId)
            .map((l) => l.userId)
        )
        setActiveUsers24h(activeUsers.size)
        setLastActionTime(allLogs.length > 0 ? allLogs[0].createdAt : null)
      } else {
        toast.error("Erreur lors du chargement du journal d'audit")
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, actionFilter])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const resetFilters = () => {
    setModuleFilter('')
    setActionFilter('')
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Journal d&apos;Audit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Historique de toutes les actions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Actions aujourd&apos;hui</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{todayCount}</p>
                </div>
                <div className="p-2 rounded-lg border bg-emerald-50 border-emerald-200">
                  <Activity className="w-4 h-4 text-emerald-600" />
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
                  <p className="text-sm text-muted-foreground font-medium">Utilisateurs actifs 24h</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{activeUsers24h}</p>
                </div>
                <div className="p-2 rounded-lg border bg-blue-50 border-blue-200">
                  <Users className="w-4 h-4 text-blue-600" />
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
                  <p className="text-sm text-muted-foreground font-medium">Dernière action</p>
                  <p className="text-lg font-bold mt-1 text-foreground">
                    {lastActionTime ? formatRelativeTime(lastActionTime) : '—'}
                  </p>
                </div>
                <div className="p-2 rounded-lg border bg-amber-50 border-amber-200">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={moduleFilter || '__all__'} onValueChange={(v) => setModuleFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_MODULE_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter || '__all__'} onValueChange={(v) => setActionFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_ACTION_FILTERS.map((f) => (
                  <SelectItem key={f.value || '__all__'} value={f.value || '__all__'}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(moduleFilter || actionFilter) && (
              <Button variant="outline" onClick={resetFilters} className="gap-2">
                <FilterX className="w-4 h-4" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      {loading ? (
        <AuditTableSkeleton />
      ) : logs.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <ScrollText className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Aucune action trouvée</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Aucune entrée ne correspond à vos filtres.
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
                    <TableHead className="pl-4">Date/Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="hidden sm:table-cell">Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, index) => {
                    const actionBadge = getActionBadge(log.action)
                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
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
                              {log.utilisateur ? getInitials(log.utilisateur.name) : '?'}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                              {log.utilisateur?.name || 'Utilisateur supprimé'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {getModuleLabel(log.module)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', actionBadge.className)}>
                            {actionBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground truncate block max-w-[250px]">
                            {log.details || '—'}
                          </span>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
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
