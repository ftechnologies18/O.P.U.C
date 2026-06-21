'use client'

/**
 * Gestion des Délégations — page GERANT (et co-GERANT).
 *
 * Liste les délégations émises par l'utilisateur (ou toutes les délégations
 * si GERANT principal), avec actions:
 *  - Nouvelle délégation (Dialog)
 *  - Modifier (Dialog, pré-rempli)
 *  - Révoquer (confirm Dialog)
 *
 * Backend endpoints (tous sous /api/v1/):
 *   GET    /delegations
 *   POST   /delegations
 *   GET    /delegations/{id}
 *   PUT    /delegations/{id}
 *   POST   /delegations/{id}/revoke
 *   GET    /users  (pour le select d'utilisateur)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  KeyRound,
  Plus,
  Pencil,
  Ban,
  RefreshCw,
  Loader2,
  Calendar,
  AlertCircle,
  UserCircle2,
  Inbox,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type DelegationDomain = 'FINANCE' | 'RH' | 'LOGISTIQUE' | 'COMMERCIAL' | 'CHANTIER' | 'DOCUMENTS'
type DelegationPermission = 'LECTURE' | 'ECRITURE' | 'GESTION'
type DelegationStatut = 'ACTIF' | 'REVOCQUE' | 'EXPIRE'

interface Delegation {
  id: string
  entrepriseId: string
  fromUserId: string
  toUserId: string
  domain: DelegationDomain
  permissions: DelegationPermission
  statut: DelegationStatut
  expiresLe: string | null
  raison: string | null
  createdAt: string
  updatedAt: string
}

interface UserOption {
  id: string
  email: string
  name: string
  role: string
  active: boolean
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DOMAIN_LABELS: Record<DelegationDomain, string> = {
  FINANCE: 'Gestion Financière',
  RH: 'Gestion RH',
  LOGISTIQUE: 'Gestion Logistique',
  COMMERCIAL: 'Gestion Commercial',
  CHANTIER: 'Gestion Chantiers',
  DOCUMENTS: 'Gestion Documents',
}

const DOMAIN_BADGES: Record<DelegationDomain, string> = {
  FINANCE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  RH: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:border-slate-700',
  LOGISTIQUE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  COMMERCIAL: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:border-slate-700',
  CHANTIER: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  DOCUMENTS: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700',
}

const PERM_LABELS: Record<DelegationPermission, string> = {
  LECTURE: 'Lecture',
  ECRITURE: 'Écriture',
  GESTION: 'Gestion complète',
}

const PERM_BADGES: Record<DelegationPermission, string> = {
  LECTURE: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700',
  ECRITURE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  GESTION: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
}

const STATUT_LABELS: Record<DelegationStatut, string> = {
  ACTIF: 'Actif',
  REVOCQUE: 'Révoqué',
  EXPIRE: 'Expiré',
}

const STATUT_BADGES: Record<DelegationStatut, string> = {
  ACTIF: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  REVOCQUE: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  EXPIRE: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700',
}

const DOMAIN_OPTIONS = Object.entries(DOMAIN_LABELS).map(([value, label]) => ({ value, label }))
const PERM_OPTIONS = Object.entries(PERM_LABELS).map(([value, label]) => ({ value, label }))

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DelegationsPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined
  const isCoGerant = (session?.user as any)?.isCoGerant === true

  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Delegation | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Revoke state
  const [revokeTarget, setRevokeTarget] = useState<Delegation | null>(null)
  const [revoking, setRevoking] = useState(false)

  // Form fields
  const [toUserId, setToUserId] = useState('')
  const [domain, setDomain] = useState<DelegationDomain>('FINANCE')
  const [permissions, setPermissions] = useState<DelegationPermission>('LECTURE')
  const [expiresLe, setExpiresLe] = useState<Date | undefined>(undefined)
  const [raison, setRaison] = useState('')

  // ── Fetch delegations + users ────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const res = await fetch('/api/v1/delegations', { credentials: 'same-origin' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`)
      const data = await res.json()
      const list: Delegation[] = Array.isArray(data) ? data : (data?.delegations || data?.data || [])
      setDelegations(list)
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/users', { credentials: 'same-origin' })
      if (!res.ok) return
      const json = await res.json()
      const list: UserOption[] = json.users || json.data || []
      // On exclut l'utilisateur courant, les GERANTS et co-GERANTS (ils ont déjà tous les droits)
      setUsers(list.filter((u) =>
        u.id !== session?.user?.id &&
        u.role !== 'GERANT' &&
        u.role !== 'SUPER_ADMIN' &&
        u.active
      ))
    } catch {
      // Silencieux : le select sera vide.
    }
  }, [session?.user?.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    if (formOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUsers()
    }
  }, [formOpen, loadUsers])

  // ── Helpers ──────────────────────────────────────────────────
  const userById = useMemo(() => {
    const map = new Map<string, UserOption>()
    users.forEach((u) => map.set(u.id, u))
    return map
  }, [users])

  const displayUserName = (uid: string) => {
    const u = userById.get(uid)
    if (u) return u.name
    // Si l'utilisateur n'est pas dans la liste filtrée, on affiche l'id tronqué
    return uid.length > 8 ? `${uid.slice(0, 8)}…` : uid
  }

  const displayUserEmail = (uid: string) => {
    const u = userById.get(uid)
    return u?.email || ''
  }

  // ── Dialog handlers ──────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setToUserId('')
    setDomain('FINANCE')
    setPermissions('LECTURE')
    setExpiresLe(undefined)
    setRaison('')
    setFormOpen(true)
  }

  const openEdit = (d: Delegation) => {
    setEditing(d)
    setToUserId(d.toUserId)
    setDomain(d.domain)
    setPermissions(d.permissions)
    setExpiresLe(d.expiresLe ? parseISO(d.expiresLe) : undefined)
    setRaison(d.raison || '')
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const submitForm = async () => {
    // Validation
    if (!toUserId) {
      toast.error('Veuillez sélectionner un utilisateur')
      return
    }
    if (!domain) {
      toast.error('Veuillez sélectionner un domaine')
      return
    }
    if (!permissions) {
      toast.error('Veuillez sélectionner un niveau de permission')
      return
    }

    setSubmitting(true)
    try {
      const body: any = {
        toUserId,
        domain,
        permissions,
        raison: raison.trim() || null,
      }
      if (expiresLe) {
        // On envoie la date en ISO à minuit (fin de journée)
        const endOfDay = new Date(expiresLe)
        endOfDay.setHours(23, 59, 59, 0)
        body.expiresLe = endOfDay.toISOString()
      } else if (!editing) {
        body.expiresLe = null
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/v1/delegations/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/delegations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }

      toast.success(editing ? 'Délégation modifiée' : 'Délégation créée')
      closeForm()
      load(true)
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement", { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/v1/delegations/${revokeTarget.id}/revoke`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      toast.success('Délégation révoquée')
      setRevokeTarget(null)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la révocation', { description: e?.message })
    } finally {
      setRevoking(false)
    }
  }

  // ── Derived stats ────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total: delegations.length,
      actives: delegations.filter((d) =>
        d.statut === 'ACTIF' && (!d.expiresLe || isAfter(parseISO(d.expiresLe), now))
      ).length,
      expires: delegations.filter((d) => d.statut === 'EXPIRE').length,
      revocques: delegations.filter((d) => d.statut === 'REVOCQUE').length,
    }
  }, [delegations])

  const isGerantLevel = userRole === 'GERANT' || userRole === 'SUPER_ADMIN' || isCoGerant

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  if (!isGerantLevel) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="backdrop-blur-xl bg-white/70 border border-white/60 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">Accès restreint</h2>
            <p className="text-sm text-muted-foreground">
              Seuls les gérants (et co-gérants) peuvent gérer les délégations.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══════ Header ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 shrink-0">
            <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Gestion des Délégations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Déléguez l'accès à un domaine (Finance, RH, Chantier…) à un membre de votre équipe.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => load(true)}
            disabled={refreshing}
            className="border-white/60 bg-white/60"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle délégation</span>
            <span className="sm:hidden">Nouvelle</span>
          </Button>
        </div>
      </motion.div>

      {/* ═══════ Stats ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700 dark:text-slate-200' },
          { label: 'Actives', value: stats.actives, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Expirées', value: stats.expires, color: 'text-gray-600 dark:text-gray-400' },
          { label: 'Révoquées', value: stats.revocques, color: 'text-red-600 dark:text-red-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="backdrop-blur-xl bg-white/70 border border-white/60 rounded-xl p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ═══════ Table ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Liste des délégations</CardTitle>
            <CardDescription className="text-xs">
              Les délégations actives peuvent être modifiées ou révoquées.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : delegations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                  <Inbox className="w-7 h-7 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucune délégation</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Créez une délégation pour permettre à un membre de votre équipe d'accéder à un domaine spécifique en votre absence.
                </p>
                <Button
                  onClick={openCreate}
                  variant="outline"
                  className="mt-4 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-800"
                >
                  <Plus className="w-4 h-4" />
                  Créer ma première délégation
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground">Utilisateur</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Domaine</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Niveau</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Expire le</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Statut</TableHead>
                        <TableHead className="font-semibold text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {delegations.map((d, idx) => (
                          <motion.tr
                            key={d.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className="group"
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                  <UserCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {displayUserName(d.toUserId)}
                                  </p>
                                  {displayUserEmail(d.toUserId) && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {displayUserEmail(d.toUserId)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={DOMAIN_BADGES[d.domain]}>
                                {DOMAIN_LABELS[d.domain]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={PERM_BADGES[d.permissions]}>
                                {PERM_LABELS[d.permissions]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {d.expiresLe ? (
                                <div className="flex items-center gap-1.5 text-sm text-foreground">
                                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{format(parseISO(d.expiresLe), 'dd MMM yyyy', { locale: fr })}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Illimitée</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUT_BADGES[d.statut]}>
                                {STATUT_LABELS[d.statut]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {d.statut === 'ACTIF' && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(d)}
                                    className="h-8 px-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span className="hidden lg:inline">Modifier</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRevokeTarget(d)}
                                    className="h-8 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span className="hidden lg:inline">Révoquer</span>
                                  </Button>
                                </div>
                              )}
                              {d.statut !== 'ACTIF' && (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {delegations.map((d) => (
                    <div key={d.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                            <UserCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {displayUserName(d.toUserId)}
                            </p>
                            {displayUserEmail(d.toUserId) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {displayUserEmail(d.toUserId)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={STATUT_BADGES[d.statut]}>
                          {STATUT_LABELS[d.statut]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={DOMAIN_BADGES[d.domain]}>
                          {DOMAIN_LABELS[d.domain]}
                        </Badge>
                        <Badge variant="outline" className={PERM_BADGES[d.permissions]}>
                          {PERM_LABELS[d.permissions]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {d.expiresLe ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(d.expiresLe), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          ) : (
                            <span className="italic">Illimitée</span>
                          )}
                        </div>
                        {d.statut === 'ACTIF' && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(d)}
                              className="h-7 px-2 text-xs"
                            >
                              <Pencil className="w-3 h-3" />
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRevokeTarget(d)}
                              className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Ban className="w-3 h-3" />
                              Révoquer
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════ Create / Edit Dialog ═══════ */}
      <Dialog open={formOpen} onOpenChange={(v) => v ? setFormOpen(true) : closeForm()}>
        <DialogContent className="sm:max-w-[520px] backdrop-blur-xl bg-white/95 border border-white/60 dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              {editing ? 'Modifier la délégation' : 'Nouvelle délégation'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Modifiez les paramètres de cette délégation.'
                : 'Déléguez temporairement l\'accès à un domaine à un membre de votre équipe.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Utilisateur */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-user" className="text-sm font-medium">
                Utilisateur <span className="text-red-500">*</span>
              </Label>
              {editing ? (
                <Input
                  id="dlg-user"
                  value={displayUserName(editing.toUserId)}
                  disabled
                  className="bg-muted/50"
                />
              ) : (
                <Select value={toUserId} onValueChange={setToUserId}>
                  <SelectTrigger id="dlg-user" className="w-full">
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {users.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Aucun utilisateur disponible
                      </div>
                    ) : (
                      users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Les gérants et co-gérants ne peuvent pas recevoir de délégation (ils ont déjà tous les droits).
              </p>
            </div>

            {/* Domaine */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-domain" className="text-sm font-medium">
                Domaine <span className="text-red-500">*</span>
              </Label>
              <Select
                value={domain}
                onValueChange={(v) => setDomain(v as DelegationDomain)}
                disabled={!!editing}
              >
                <SelectTrigger id="dlg-domain" className="w-full">
                  <SelectValue placeholder="Sélectionner un domaine" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && (
                <p className="text-xs text-muted-foreground italic">
                  Le domaine ne peut pas être modifié après création.
                </p>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-perm" className="text-sm font-medium">
                Niveau de permission <span className="text-red-500">*</span>
              </Label>
              <Select
                value={permissions}
                onValueChange={(v) => setPermissions(v as DelegationPermission)}
              >
                <SelectTrigger id="dlg-perm" className="w-full">
                  <SelectValue placeholder="Sélectionner un niveau" />
                </SelectTrigger>
                <SelectContent>
                  {PERM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Expiration <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expiresLe && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="w-4 h-4" />
                      {expiresLe
                        ? format(expiresLe, 'dd MMMM yyyy', { locale: fr })
                        : 'Illimitée (pas de date)'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={expiresLe}
                      onSelect={setExpiresLe}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {expiresLe && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpiresLe(undefined)}
                    className="text-xs text-muted-foreground"
                  >
                    Effacer
                  </Button>
                )}
              </div>
            </div>

            {/* Raison */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-raison" className="text-sm font-medium">
                Raison <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <Textarea
                id="dlg-raison"
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="Ex: Congés, mission sur un autre chantier, formation…"
                className="min-h-[72px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{raison.length}/500</p>
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeForm} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={submitForm}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Créer la délégation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Revoke Confirm Dialog ═══════ */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(v) => !v && setRevokeTarget(null)}>
        <AlertDialogContent className="backdrop-blur-xl bg-white/95 border border-white/60 dark:bg-slate-900/95">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              Révoquer cette délégation ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && (
                <>
                  Cette action retirera immédiatement à <strong>{displayUserName(revokeTarget.toUserId)}</strong>{' '}
                  l'accès délégué au domaine{' '}
                  <strong>{DOMAIN_LABELS[revokeTarget.domain]}</strong>.
                  <br />
                  Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              disabled={revoking}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
