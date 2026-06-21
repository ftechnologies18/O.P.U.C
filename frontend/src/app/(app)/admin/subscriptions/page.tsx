'use client'

/**
 * Gestion des abonnements SaaS — SUPER_ADMIN.
 *
 * Stats (MRR total, trials actifs, churn rate), table des abonnements
 * avec filtres (plan + statut), actions (changer plan, annuler),
 * et cards présentant les 3 plans (Starter / Pro / Enterprise).
 *
 * Backend endpoints:
 *   GET    /api/v1/admin/subscriptions?plan=&statut=&entrepriseId=
 *   POST   /api/v1/admin/subscriptions               — {entrepriseId, plan}
 *   PUT    /api/v1/admin/subscriptions/{id}          — {plan}
 *   POST   /api/v1/admin/subscriptions/{id}/cancel
 *   GET    /api/v1/admin/entreprises                 — for entreprise name lookup
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  DollarSign,
  Sparkles,
  TrendingDown,
  Filter,
  RefreshCw,
  Loader2,
  Building2,
  CheckCircle2,
  XCircle,
  Pencil,
  Plus,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Subscription {
  id: string
  entrepriseId: string
  plan: string
  statut: string
  amount: number
  currency: string
  maxUsers: number
  maxChantiers: number
  maxStorageMB: number
  trialEndsAt?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  createdAt: string
  updatedAt: string
}

interface Entreprise {
  id: string
  nom: string
  status: string
}

interface ListResponse {
  data: Subscription[]
  total: number
  page: number
  pageSize: number
}

interface EntListResponse {
  data: Entreprise[]
  total: number
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PLAN_INFO: Record<string, { label: string; amount: number; maxUsers: number; maxChantiers: number; maxStorageMB: number; features: string[]; accent: string; badge: string }> = {
  STARTER: {
    label: 'Starter',
    amount: 0,
    maxUsers: 5,
    maxChantiers: 3,
    maxStorageMB: 500,
    features: ['5 utilisateurs', '3 chantiers actifs', '500 MB de stockage', 'Support standard'],
    accent: 'from-slate-500/10 to-slate-400/5 text-slate-700 dark:text-slate-300 border-slate-300/60 dark:border-slate-700/60',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  },
  PRO: {
    label: 'Pro',
    amount: 25000,
    maxUsers: 25,
    maxChantiers: 15,
    maxStorageMB: 5120,
    features: ['25 utilisateurs', '15 chantiers actifs', '5 GB de stockage', 'Support prioritaire', 'Export Excel/CSV'],
    accent: 'from-amber-500/15 to-orange-500/5 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-800/60',
    badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  ENTERPRISE: {
    label: 'Enterprise',
    amount: 75000,
    maxUsers: 999,
    maxChantiers: 999,
    maxStorageMB: 51200,
    features: ['Utilisateurs illimités', 'Chantiers illimités', '50 GB de stockage', 'Support dédié 24/7', 'API & intégrations', 'SSO / SAML'],
    accent: 'from-orange-500/15 to-red-500/5 text-orange-700 dark:text-orange-400 border-orange-300/60 dark:border-orange-800/60',
    badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  },
}

const STATUT_BADGES: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'Trial', cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  ACTIVE: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  PAST_DUE: { label: 'En retard', cls: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  CANCELED: { label: 'Annulé', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  EXPIRED: { label: 'Expiré', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
}

function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminSubscriptionsPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [planFilter, setPlanFilter] = useState('all')
  const [statutFilter, setStatutFilter] = useState('all')

  const [changePlanTarget, setChangePlanTarget] = useState<Subscription | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({ pageSize: '200' })
      if (planFilter !== 'all') params.set('plan', planFilter)
      if (statutFilter !== 'all') params.set('statut', statutFilter)

      const [subRes, entRes] = await Promise.allSettled([
        fetch(`/api/v1/admin/subscriptions?${params.toString()}`, { credentials: 'same-origin' }),
        fetch('/api/v1/admin/entreprises?pageSize=200', { credentials: 'same-origin' }),
      ])

      if (subRes.status === 'fulfilled' && subRes.value.ok) {
        const d: ListResponse = await subRes.value.json()
        setSubscriptions(d.data || [])
      }
      if (entRes.status === 'fulfilled' && entRes.value.ok) {
        const d: EntListResponse = await entRes.value.json()
        setEntreprises(d.data || [])
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement des abonnements', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [planFilter, statutFilter])

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load()
    }
  }, [userRole, load])

  // Lookup maps
  const entById = useMemo(() => new Map(entreprises.map((e) => [e.id, e])), [entreprises])

  // Derived stats
  const stats = useMemo(() => {
    const now = new Date()
    const active = subscriptions.filter((s) => s.statut === 'ACTIVE')
    const trials = subscriptions.filter((s) => s.statut === 'TRIAL')
    const canceled = subscriptions.filter((s) => s.statut === 'CANCELED')
    const mrr = active.reduce((sum, s) => sum + (s.amount || 0), 0)
    const totalEver = subscriptions.length
    // Churn rate = (canceled / (active + canceled)) * 100
    const churn = totalEver > 0 && (active.length + canceled.length) > 0
      ? (canceled.length / (active.length + canceled.length)) * 100
      : 0
    const trialsExpiring = trials.filter((s) => {
      if (!s.trialEndsAt) return false
      try {
        const end = parseISO(s.trialEndsAt)
        return isAfter(end, now) && isBefore(end, new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000))
      } catch {
        return false
      }
    }).length
    return { mrr, trials: trials.length, churn, active: active.length, total: totalEver, trialsExpiring }
  }, [subscriptions])

  if (userRole && userRole !== 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <p className="text-lg font-semibold">Accès restreint</p>
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux Super Administrateurs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Abonnements SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            MRR, trials, plans et churn de la plateforme.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel abonnement
          </Button>
        </div>
      </motion.div>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={DollarSign}
          label="MRR total"
          value={formatFCFA(stats.mrr)}
          subtitle={`${stats.active} actifs`}
          accent="amber"
          loading={loading}
        />
        <StatCard
          icon={Sparkles}
          label="Trials actifs"
          value={stats.trials}
          subtitle={`${stats.trialsExpiring} expirant bientôt`}
          accent="orange"
          loading={loading}
        />
        <StatCard
          icon={TrendingDown}
          label="Churn rate"
          value={`${stats.churn.toFixed(1)}%`}
          subtitle="Ratio d'annulation"
          accent="red"
          loading={loading}
        />
        <StatCard
          icon={Building2}
          label="Total abonnements"
          value={stats.total}
          subtitle="Tous statuts confondus"
          accent="amber"
          loading={loading}
        />
      </div>

      {/* ── PLAN CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(PLAN_INFO).map(([key, info], idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
          >
            <Card className={cn(
              'backdrop-blur-xl bg-white/70 border shadow-sm dark:bg-slate-900/50 h-full overflow-hidden',
              key === 'PRO' ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-200/50 dark:ring-amber-900/30' : 'border-white/60 dark:border-slate-800/60'
            )}>
              {key === 'PRO' && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider text-center py-1">
                  Le plus populaire
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={cn('text-lg font-bold', key === 'PRO' ? 'text-amber-700 dark:text-amber-400' : key === 'ENTERPRISE' ? 'text-orange-700 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300')}>
                    {info.label}
                  </CardTitle>
                  <Badge variant="outline" className={cn('text-[10px]', info.badge)}>
                    Plan
                  </Badge>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-extrabold tracking-tight">
                    {info.amount === 0 ? 'Gratuit' : formatFCFA(info.amount)}
                  </span>
                  {info.amount > 0 && <span className="text-xs text-muted-foreground"> / mois</span>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5">
                  {info.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', key === 'PRO' ? 'text-amber-500' : key === 'ENTERPRISE' ? 'text-orange-500' : 'text-slate-500')} />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer avec ce plan
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── FILTERS ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white/70 backdrop-blur-xl border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="STARTER">Starter</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white/70 backdrop-blur-xl border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="ACTIVE">Actif</SelectItem>
            <SelectItem value="PAST_DUE">En retard</SelectItem>
            <SelectItem value="CANCELED">Annulé</SelectItem>
            <SelectItem value="EXPIRED">Expiré</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── TABLE ──────────────────────────────────────────────── */}
      <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-40" />
              Aucun abonnement trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entreprise</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs">Montant</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Trial fin</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Période fin</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {subscriptions.map((s, idx) => {
                      const ent = entById.get(s.entrepriseId)
                      const planInfo = PLAN_INFO[s.plan] || PLAN_INFO.STARTER
                      const statutBadge = STATUT_BADGES[s.statut] || { label: s.statut, cls: '' }
                      return (
                        <motion.tr
                          key={s.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-sm font-medium truncate max-w-[180px]">
                                {ent?.nom || `Entreprise ${s.entrepriseId.slice(-6)}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn('text-[11px]', planInfo.badge)}>
                              {planInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn('text-[11px]', statutBadge.cls)}>
                              {statutBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium">
                            {s.amount === 0 ? 'Gratuit' : formatFCFA(s.amount)}
                          </TableCell>
                          <TableCell className="py-3 hidden md:table-cell text-xs text-muted-foreground">
                            {s.trialEndsAt ? (() => {
                              try { return format(parseISO(s.trialEndsAt), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
                            })() : '—'}
                          </TableCell>
                          <TableCell className="py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {s.currentPeriodEnd ? (() => {
                              try { return format(parseISO(s.currentPeriodEnd), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
                            })() : '—'}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 px-2 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                                  <span className="text-xs">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => setChangePlanTarget(s)}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4 mr-2" /> Changer le plan
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/entreprises/${s.entrepriseId}`} className="cursor-pointer">
                                    <Building2 className="w-4 h-4 mr-2" /> Voir entreprise
                                  </Link>
                                </DropdownMenuItem>
                                {s.statut !== 'CANCELED' && s.statut !== 'EXPIRED' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setCancelTarget(s)}
                                      className="cursor-pointer text-red-700 focus:text-red-700"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" /> Annuler l'abonnement
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DIALOGS ────────────────────────────────────────────── */}
      <ChangePlanDialog
        subscription={changePlanTarget}
        entrepriseName={changePlanTarget ? entById.get(changePlanTarget.entrepriseId)?.nom : undefined}
        onOpenChange={(open) => !open && setChangePlanTarget(null)}
        onUpdated={() => load(true)}
      />

      <CancelSubscriptionDialog
        subscription={cancelTarget}
        entrepriseName={cancelTarget ? entById.get(cancelTarget.entrepriseId)?.nom : undefined}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        onUpdated={() => load(true)}
      />

      <CreateSubscriptionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entreprises={entreprises}
        existingSubs={subscriptions}
        onCreated={() => {
          setCreateOpen(false)
          load(true)
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent,
  loading,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  subtitle?: string
  accent: 'amber' | 'orange' | 'red'
  loading: boolean
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    orange: 'from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-900/40',
    red: 'from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-900/40',
  }[accent]
  return (
    <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-lg sm:text-xl font-bold tracking-tight">{value}</p>
          )}
          {subtitle && !loading && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className={cn('shrink-0 rounded-lg p-2 border bg-gradient-to-br', accentClasses)}>
          <Icon className="w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChangePlanDialog({
  subscription,
  entrepriseName,
  onOpenChange,
  onUpdated,
}: {
  subscription: Subscription | null
  entrepriseName?: string
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const [plan, setPlan] = useState('STARTER')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (subscription) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan(subscription.plan)
    }
  }, [subscription])

  const handleSubmit = async () => {
    if (!subscription) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/admin/subscriptions/${subscription.id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success(`Plan changé vers ${PLAN_INFO[plan]?.label || plan}`)
      onOpenChange(false)
      onUpdated()
    } catch (e: any) {
      toast.error('Erreur lors du changement de plan', { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!subscription} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-500" />
            Changer le plan — {entrepriseName}
          </DialogTitle>
          <DialogDescription>
            Le plan actuel est <strong>{PLAN_INFO[subscription?.plan || '']?.label}</strong>.
            Sélectionnez un nouveau plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {Object.entries(PLAN_INFO).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setPlan(key)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-all',
                plan === key
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 ring-1 ring-amber-200/50 dark:ring-amber-900/30'
                  : 'border-border hover:border-amber-200 hover:bg-amber-50/30 dark:hover:bg-amber-900/10'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{info.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {info.maxUsers} users • {info.maxChantiers} chantiers • {info.maxStorageMB} MB
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{info.amount === 0 ? 'Gratuit' : formatFCFA(info.amount)}</p>
                  {info.amount > 0 && <p className="text-[10px] text-muted-foreground">/ mois</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelSubscriptionDialog({
  subscription,
  entrepriseName,
  onOpenChange,
  onUpdated,
}: {
  subscription: Subscription | null
  entrepriseName?: string
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const [submitting, setSubmitting] = useState(false)

  const handleCancel = async () => {
    if (!subscription) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/admin/subscriptions/${subscription.id}/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success('Abonnement annulé')
      onOpenChange(false)
      onUpdated()
    } catch (e: any) {
      toast.error("Erreur lors de l'annulation", { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={!!subscription} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Annuler l'abonnement de {entrepriseName} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            L'abonnement sera marqué comme <strong>annulé</strong>. L'entreprise perdra l'accès
            aux fonctionnalités payantes à la fin de la période en cours. Cette action est réversible
            (il faudra recréer un abonnement).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Retour</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={submitting}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Annuler l'abonnement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateSubscriptionDialog({
  open,
  onOpenChange,
  entreprises,
  existingSubs,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entreprises: Entreprise[]
  existingSubs: Subscription[]
  onCreated: () => void
}) {
  const [entrepriseId, setEntrepriseId] = useState('')
  const [plan, setPlan] = useState('STARTER')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntrepriseId('')
      setPlan('STARTER')
    }
  }, [open])

  // Entreprises sans abonnement existant
  const availableEntreprises = useMemo(() => {
    const withSub = new Set(existingSubs.map((s) => s.entrepriseId))
    return entreprises.filter((e) => !withSub.has(e.id))
  }, [entreprises, existingSubs])

  const handleSubmit = async () => {
    if (!entrepriseId) {
      toast.error('Veuillez sélectionner une entreprise')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/admin/subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrepriseId, plan }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success('Abonnement créé avec succès')
      onCreated()
    } catch (e: any) {
      toast.error('Erreur lors de la création', { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-500" />
            Nouvel abonnement
          </DialogTitle>
          <DialogDescription>
            Crée un abonnement (14 jours de trial par défaut).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Entreprise *</label>
            <Select value={entrepriseId} onValueChange={setEntrepriseId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez une entreprise" />
              </SelectTrigger>
              <SelectContent>
                {availableEntreprises.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    Toutes les entreprises ont déjà un abonnement.
                  </div>
                ) : (
                  availableEntreprises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Plan *</label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un plan" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label} — {info.amount === 0 ? 'Gratuit' : formatFCFA(info.amount)}/mois
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !entrepriseId}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer l'abonnement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
