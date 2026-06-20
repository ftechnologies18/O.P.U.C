'use client'

/**
 * Co-Gérant — page réservée au GERANT principal.
 *
 * Liste les co-gérants (max 2), avec actions:
 *  - Promouvoir un chef de projet en co-gérant (Dialog)
 *  - Rétrograder un co-gérant (confirm Dialog)
 *
 * Si l'utilisateur est lui-même co-gérant, on affiche un avertissement
 * et on désactive toutes les actions.
 *
 * Backend endpoints (tous sous /api/v1/):
 *   GET  /users/co-gerants
 *   POST /users/{id}/promote-co-gerant
 *   POST /users/{id}/demote-co-gerant
 *   GET  /users  (pour le select d'utilisateur, filtre CHEF_PROJET)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Crown,
  UserPlus,
  UserMinus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldAlert,
  UserCircle2,
  Inbox,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CoGerant {
  id: string
  email: string
  name: string
  role: string
  telephone?: string | null
  active: boolean
  isCoGerant: boolean
  promotedAt?: string | null
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

const MAX_CO_GERANTS = 2

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CoGerantPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined
  const isCoGerant = (session?.user as any)?.isCoGerant === true

  const [coGerants, setCoGerants] = useState<CoGerant[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Promote state
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoteUserId, setPromoteUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Demote state
  const [demoteTarget, setDemoteTarget] = useState<CoGerant | null>(null)
  const [demoting, setDemoting] = useState(false)

  // ── Fetch co-gerants ─────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const res = await fetch('/api/v1/users/co-gerants', { credentials: 'same-origin' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      const data = await res.json()
      const list: CoGerant[] = Array.isArray(data) ? data : (data?.users || data?.data || [])
      setCoGerants(list)
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
      // On ne montre que les CHEF_PROJET actifs qui ne sont pas déjà co-gerants
      setUsers(list.filter((u) =>
        u.role === 'CHEF_PROJET' &&
        u.active &&
        !coGerants.some((c) => c.id === u.id)
      ))
    } catch {
      // Silencieux
    }
  }, [coGerants])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (promoteOpen) loadUsers()
  }, [promoteOpen, loadUsers])

  // ── Handlers ─────────────────────────────────────────────────
  const openPromote = () => {
    setPromoteUserId('')
    setPromoteOpen(true)
  }

  const submitPromote = async () => {
    if (!promoteUserId) {
      toast.error('Veuillez sélectionner un chef de projet')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/users/${promoteUserId}/promote-co-gerant`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      toast.success('Chef de projet promu co-gérant')
      setPromoteOpen(false)
      load(true)
    } catch (e: any) {
      toast.error("Erreur lors de la promotion", { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDemote = async () => {
    if (!demoteTarget) return
    setDemoting(true)
    try {
      const res = await fetch(`/api/v1/users/${demoteTarget.id}/demote-co-gerant`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      toast.success('Co-gérant rétrogradé')
      setDemoteTarget(null)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la rétrogradation', { description: e?.message })
    } finally {
      setDemoting(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────
  const activeCount = useMemo(
    () => coGerants.filter((c) => c.active).length,
    [coGerants]
  )
  const canAdd = activeCount < MAX_CO_GERANTS

  const isPrincipalGerant = userRole === 'GERANT' && !isCoGerant

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Read-only mode (co-GERANT user)
  // ═══════════════════════════════════════════════════════════════
  if (!isPrincipalGerant) {
    // Si l'utilisateur est co-GERANT, on affiche un message l'informant
    // qu'il ne peut pas gérer les co-gérants. Sinon (CHEF_PROJET normal,
    // EMPLOYE), on affiche un message d'accès refusé.
    const isCoGerantUser = isCoGerant
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start gap-3"
        >
          <div className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 shrink-0">
            <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Co-Gérant
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion des co-gérants de l'entreprise.
            </p>
          </div>
        </motion.div>

        <Card className="backdrop-blur-xl bg-amber-50/80 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                {isCoGerantUser
                  ? 'Vous êtes co-gérant'
                  : 'Accès restreint'}
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {isCoGerantUser
                  ? "Seul le gérant principal peut gérer les co-gérants. Vous avez les mêmes droits que le gérant, mais vous ne pouvez ni promouvoir ni rétrograder d'autres co-gérants."
                  : "Seul le gérant principal de l'entreprise peut accéder à cette page."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tableau en lecture seule si co-gerant */}
        {isCoGerantUser && (
          <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Co-gérants actuels</CardTitle>
              <CardDescription className="text-xs">
                Lecture seule — vous ne pouvez pas modifier cette liste.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : coGerants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Inbox className="w-7 h-7 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun co-gérant actuellement.</p>
                </div>
              ) : (
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground">Nom</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Email</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Promu le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coGerants.map((c, idx) => (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
                                <UserCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{c.name}</span>
                              {c.id === session?.user?.id && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                                  Vous
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.promotedAt
                              ? format(parseISO(c.promotedAt), 'dd MMM yyyy', { locale: fr })
                              : c.createdAt
                                ? format(parseISO(c.createdAt), 'dd MMM yyyy', { locale: fr })
                                : '—'}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Principal GERANT mode (full management)
  // ═══════════════════════════════════════════════════════════════
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
            <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Co-Gérant
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Désignez un co-gérant pour gérer l'entreprise en votre absence.
            </p>
          </div>
        </div>
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
      </motion.div>

      {/* ═══════ Warning ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card className="backdrop-blur-xl bg-amber-50/80 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Le co-gérant a les mêmes droits que le gérant.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Il peut gérer l'entreprise en votre absence. Maximum {MAX_CO_GERANTS} co-gérants par entreprise.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════ Stats ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Co-gérants actifs
            </p>
            <p className="text-2xl font-bold text-foreground">
              {activeCount}
              <span className="text-base text-muted-foreground font-normal"> / {MAX_CO_GERANTS}</span>
            </p>
          </div>
        </div>
        <Button
          onClick={openPromote}
          disabled={!canAdd}
          className={cn(
            'gap-2',
            canAdd
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Promouvoir un co-gérant</span>
          <span className="sm:hidden">Promouvoir</span>
        </Button>
      </motion.div>

      {!canAdd && (
        <p className="text-xs text-amber-700 dark:text-amber-400 -mt-3">
          Vous avez atteint la limite de {MAX_CO_GERANTS} co-gérants. Réterogradez un co-gérant pour en ajouter un nouveau.
        </p>
      )}

      {/* ═══════ Table ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Liste des co-gérants</CardTitle>
            <CardDescription className="text-xs">
              Vous pouvez rétrograder un co-gérant à tout moment.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : coGerants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                  <Crown className="w-7 h-7 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucun co-gérant</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Promouvez un chef de projet de votre entreprise en co-gérant pour qu'il puisse gérer l'entreprise en votre absence.
                </p>
                <Button
                  onClick={openPromote}
                  variant="outline"
                  className="mt-4 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-800"
                >
                  <UserPlus className="w-4 h-4" />
                  Promouvoir un chef de projet
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-muted-foreground">Nom</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Email</TableHead>
                        <TableHead className="font-semibold text-muted-foreground">Promu le</TableHead>
                        <TableHead className="font-semibold text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coGerants.map((c, idx) => (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <UserCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">{c.name}</p>
                                {c.telephone && (
                                  <p className="text-xs text-muted-foreground">{c.telephone}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {c.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.promotedAt
                              ? format(parseISO(c.promotedAt), 'dd MMM yyyy', { locale: fr })
                              : c.createdAt
                                ? format(parseISO(c.createdAt), 'dd MMM yyyy', { locale: fr })
                                : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDemoteTarget(c)}
                              className="h-8 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Rétrograder</span>
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {coGerants.map((c) => (
                    <div key={c.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <UserCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          {c.telephone && (
                            <p className="text-xs text-muted-foreground">{c.telephone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{c.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {c.promotedAt
                            ? `Promu le ${format(parseISO(c.promotedAt), 'dd MMM yyyy', { locale: fr })}`
                            : c.createdAt
                              ? `Depuis ${format(parseISO(c.createdAt), 'dd MMM yyyy', { locale: fr })}`
                              : '—'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDemoteTarget(c)}
                          className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <UserMinus className="w-3 h-3" />
                          Rétrograder
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══════ Promote Dialog ═══════ */}
      <Dialog open={promoteOpen} onOpenChange={(v) => !v && setPromoteOpen(false)}>
        <DialogContent className="sm:max-w-[460px] backdrop-blur-xl bg-white/95 border border-white/60 dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Promouvoir un co-gérant
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un chef de projet à promouvoir. Il aura les mêmes droits que vous.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cg-user" className="text-sm font-medium">
                Chef de projet <span className="text-red-500">*</span>
              </Label>
              <Select value={promoteUserId} onValueChange={setPromoteUserId}>
                <SelectTrigger id="cg-user" className="w-full">
                  <SelectValue placeholder="Sélectionner un chef de projet" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {users.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Aucun chef de projet disponible
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
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Le co-gérant pourra gérer tous les modules de l'entreprise, y compris la gestion des accès et des délégations.
              </p>
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPromoteOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={submitPromote}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Promouvoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ Demote Confirm Dialog ═══════ */}
      <AlertDialog open={!!demoteTarget} onOpenChange={(v) => !v && setDemoteTarget(null)}>
        <AlertDialogContent className="backdrop-blur-xl bg-white/95 border border-white/60 dark:bg-slate-900/95">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <UserMinus className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              Rétrograder ce co-gérant ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {demoteTarget && (
                <>
                  <strong>{demoteTarget.name}</strong> perdra immédiatement ses droits de co-gérant
                  et redeviendra un simple chef de projet.
                  <br />
                  Il conservera ses accès chef de projet habituels.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={demoting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDemote}
              disabled={demoting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {demoting && <Loader2 className="w-4 h-4 animate-spin" />}
              Rétrograder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
