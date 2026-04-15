'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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

      {/* Users Table */}
      {loading ? (
        <UsersTableSkeleton />
      ) : users.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Aucun utilisateur</h3>
            <p className="text-sm text-muted-foreground mt-1">Commencez par créer un utilisateur.</p>
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
                  {users.map((user, index) => {
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
                          <Badge variant="secondary" className="text-xs">
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
    </motion.div>
  )
}

// ─── Tab 2: RolesTab (ADMIN only) ────────────────────────────────────────────

function RolesTab({ session }: { session: any }) {
  const [permissions, setPermissions] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/permissions')
      if (res.ok) {
        const json = await res.json()
        setPermissions(json.permissions || {})
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

  const handleResetDefault = () => {
    setPermissions(JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)))
    toast.success('Permissions réinitialisées par défaut')
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
        <Button
          variant="outline"
          onClick={handleResetDefault}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Réinitialiser par défaut
        </Button>
      </div>

      {/* Permissions Matrix */}
      {loading ? (
        <PermissionsTableSkeleton />
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 min-w-[160px] sticky left-0 bg-background z-10">Rôle</TableHead>
                    {PERMISSION_MODULES.map((mod) => (
                      <TableHead key={mod.key} className="min-w-[120px] text-center text-xs font-medium px-2 py-3">
                        {mod.label}
                      </TableHead>
                    ))}
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
                          const levelConfig = PERMISSION_LEVELS[currentLevel] || PERMISSION_LEVELS.AUCUN
                          return (
                            <TableCell key={mod.key} className="px-2 py-2 text-center">
                              <Select
                                value={currentLevel}
                                onValueChange={(value) => updatePermission(role, mod.key, value)}
                              >
                                <SelectTrigger
                                  className={cn(
                                    'h-8 text-xs border',
                                    levelConfig.bgClass,
                                    levelConfig.borderClass,
                                    'hover:opacity-90 transition-opacity'
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PERMISSION_LEVELS).map(([value, config]) => (
                                    <SelectItem key={value} value={value} className="text-xs">
                                      {config.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          Appliquer les permissions
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Tab 3: AuditTab ────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [moduleFilter, setModuleFilter] = useState('')
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
