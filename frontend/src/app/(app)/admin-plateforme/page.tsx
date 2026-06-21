'use client'

/**
 * SaaS Plateforme Dashboard — vue SUPER_ADMIN.
 *
 * KPIs plateforme (entreprises, users, MRR, trials), chart de croissance
 * (entreprises créées par mois), tables récentes (entreprises + demandes
 * support en attente), et activity feed (trials expirant + nouvelles
 * inscriptions). Thème amber/orange, glassmorphism, animations Framer Motion.
 *
 * Backend endpoints:
 *   GET /api/v1/admin/dashboard
 *   GET /api/v1/admin/entreprises?pageSize=5
 *   GET /api/v1/admin/subscriptions
 *   GET /api/v1/admin/support-access?statut=DEMANDE
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, isAfter, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2,
  Users,
  DollarSign,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Eye,
  ShieldAlert,
  Activity,
  Loader2,
  RefreshCw,
  CalendarClock,
  UserPlus,
  Building,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface DashboardStats {
  totalEntreprises: number
  totalUsers: number
  activeSubscriptions: number
  trialSubscriptions: number
  mrr: number
}

interface Entreprise {
  id: string
  nom: string
  adresse?: string | null
  telephone?: string | null
  email?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface Subscription {
  id: string
  entrepriseId: string
  plan: string
  statut: string
  trialEndsAt?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  amount: number
  currency: string
  maxUsers: number
  maxChantiers: number
  maxStorageMB: number
  createdAt: string
  updatedAt: string
}

interface SupportAccess {
  id: string
  superAdminId: string
  entrepriseId: string
  raison: string
  statut: string
  demandeLe: string
  autoriseLe?: string | null
  autoriseParId?: string | null
  expireLe?: string | null
  revoqueLe?: string | null
  createdAt: string
}

interface EntreprisesResponse {
  data: Entreprise[]
  total: number
  page: number
  pageSize: number
}

interface SubscriptionsResponse {
  data: Subscription[]
  total: number
}

interface SupportAccessResponse {
  data: SupportAccess[]
  total: number
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const PLAN_BADGES: Record<string, string> = {
  STARTER: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  PRO: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  ENTERPRISE: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
}

const STATUT_BADGES: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'Trial', cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  ACTIVE: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  PAST_DUE: { label: 'En retard', cls: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  CANCELED: { label: 'Annulé', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  EXPIRED: { label: 'Expiré', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
}

const SUPPORT_STATUT_BADGES: Record<string, { label: string; cls: string }> = {
  DEMANDE: { label: 'En attente', cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  AUTORISE: { label: 'Autorisé', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  REFUSE: { label: 'Refusé', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  EXPIRE: { label: 'Expiré', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
  REVOQUE: { label: 'Révoqué', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
}

function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminPlateformePage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [supportRequests, setSupportRequests] = useState<SupportAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const [dashRes, entRes, subRes, saRes] = await Promise.allSettled([
        fetch('/api/v1/admin/dashboard', { credentials: 'same-origin' }),
        fetch('/api/v1/admin/entreprises?pageSize=6', { credentials: 'same-origin' }),
        fetch('/api/v1/admin/subscriptions?pageSize=100', { credentials: 'same-origin' }),
        fetch('/api/v1/admin/support-access?statut=DEMANDE&pageSize=10', { credentials: 'same-origin' }),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const d = await dashRes.value.json()
        setStats(d)
      }
      if (entRes.status === 'fulfilled' && entRes.value.ok) {
        const d: EntreprisesResponse = await entRes.value.json()
        setEntreprises(d.data || [])
      }
      if (subRes.status === 'fulfilled' && subRes.value.ok) {
        const d: SubscriptionsResponse = await subRes.value.json()
        setSubscriptions(d.data || [])
      }
      if (saRes.status === 'fulfilled' && saRes.value.ok) {
        const d: SupportAccessResponse = await saRes.value.json()
        setSupportRequests(d.data || [])
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement du tableau de bord', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll()
    }
  }, [userRole, loadAll])

  // ── Derived: growth chart (entreprises créées par mois) ───────
  const growthData = (() => {
    const now = new Date()
    const months: { key: string; label: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = format(d, 'MMM', { locale: fr })
      months.push({ key, label, count: 0 })
    }
    for (const e of entreprises) {
      try {
        const d = parseISO(e.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const m = months.find((x) => x.key === key)
        if (m) m.count += 1
      } catch {}
    }
    return months
  })()

  // ── Derived: trials expirant dans les 3 prochains jours ───────
  const trialsExpiringSoon = subscriptions
    .filter((s) => s.statut === 'TRIAL' && s.trialEndsAt)
    .filter((s) => {
      try {
        const end = parseISO(s.trialEndsAt!)
        const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        return isAfter(end, new Date()) && isAfter(in3Days, end)
      } catch {
        return false
      }
    })
    .slice(0, 5)

  // ── Derived: nouvelles inscriptions (5 plus récentes entreprises) ──
  const newInscriptions = [...entreprises]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  // Map entrepriseId → plan for quick lookup
  const planByEntreprise = new Map(subscriptions.map((s) => [s.entrepriseId, s.plan]))

  // ── RBAC guard ────────────────────────────────────────────────
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
            Plateforme SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de la plateforme — tenants, abonnements et support.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Actualiser
        </Button>
      </motion.div>

      {/* ── KPI CARDS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Entreprises"
          value={stats ? formatNumber(stats.totalEntreprises) : '—'}
          loading={loading}
          accent="amber"
          delay={0.05}
          href="/admin/entreprises"
        />
        <KpiCard
          icon={Users}
          label="Utilisateurs totaux"
          value={stats ? formatNumber(stats.totalUsers) : '—'}
          loading={loading}
          accent="orange"
          delay={0.1}
        />
        <KpiCard
          icon={DollarSign}
          label="MRR (FCFA)"
          value={stats ? formatFCFA(stats.mrr) : '—'}
          loading={loading}
          accent="amber"
          delay={0.15}
          href="/admin/subscriptions"
        />
        <KpiCard
          icon={Sparkles}
          label="Trials actifs"
          value={stats ? formatNumber(stats.trialSubscriptions) : '—'}
          loading={loading}
          accent="orange"
          delay={0.2}
          subtitle={stats ? `${formatNumber(stats.activeSubscriptions)} abonnements actifs` : undefined}
        />
      </div>

      {/* ── GROWTH CHART + ACTIVITY FEED ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Growth chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="lg:col-span-2"
        >
          <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Croissance des entreprises
              </CardTitle>
              <CardDescription className="text-xs">
                Nouvelles entreprises créées par mois (12 derniers mois)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 90%)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'hsl(0 0% 45%)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(0 0% 45%)' }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid hsl(0 0% 90%)',
                          boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [`${value} entreprise(s)`, 'Créées']}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fill="url(#growthGrad)"
                        dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Activité récente
              </CardTitle>
              <CardDescription className="text-xs">
                Trials expirant et nouvelles inscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ScrollArea className="h-64 pr-3">
                <div className="space-y-3">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                  ) : (
                    <>
                      {trialsExpiringSoon.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            Trials expirant (3j)
                          </p>
                          {trialsExpiringSoon.map((s) => (
                            <ActivityItem
                              key={`trial-${s.id}`}
                              icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                              title={`Entreprise ${s.entrepriseId.slice(-6)}`}
                              subtitle={`Plan ${PLAN_LABELS[s.plan] || s.plan}`}
                              time={`Expire ${formatDistanceToNow(parseISO(s.trialEndsAt!), { addSuffix: true, locale: fr })}`}
                            />
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-500 mb-1.5 flex items-center gap-1">
                          <UserPlus className="w-3 h-3" />
                          Nouvelles inscriptions
                        </p>
                        {newInscriptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic px-2 py-1.5">
                            Aucune entreprise récente.
                          </p>
                        ) : (
                          newInscriptions.map((e) => (
                            <ActivityItem
                              key={`new-${e.id}`}
                              icon={<Building className="w-3.5 h-3.5 text-orange-500" />}
                              title={e.nom}
                              subtitle={e.email || 'Pas d’email'}
                              time={`Inscrite ${formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true, locale: fr })}`}
                            />
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── TABLES ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent entreprises */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  Entreprises récentes
                </CardTitle>
                <CardDescription className="text-xs">
                  Les dernières entreprises inscrites
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                <Link href="/admin/entreprises">
                  Voir tout <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : entreprises.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  Aucune entreprise enregistrée.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nom</TableHead>
                        <TableHead className="text-xs">Plan</TableHead>
                        <TableHead className="text-xs">Statut</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {entreprises.map((e, idx) => {
                          const plan = planByEntreprise.get(e.id) || 'STARTER'
                          const isSuspended = e.status === 'suspended'
                          return (
                            <motion.tr
                              key={e.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.03 }}
                              className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                            >
                              <TableCell className="py-2.5 font-medium text-sm">
                                <div className="flex flex-col">
                                  <span className="truncate max-w-[160px]">{e.nom}</span>
                                  {e.email && (
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{e.email}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={cn('text-[11px]', PLAN_BADGES[plan])}>
                                  {PLAN_LABELS[plan] || plan}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                {isSuspended ? (
                                  <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                                    Suspendue
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                                  <Link href={`/admin/entreprises/${e.id}`}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </Link>
                                </Button>
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
        </motion.div>

        {/* Pending support requests */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Demandes support en attente
                </CardTitle>
                <CardDescription className="text-xs">
                  En attente d'autorisation du Gérant
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20">
                <Link href="/admin/support-access">
                  Voir tout <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : supportRequests.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
                  Aucune demande en attente.
                </div>
              ) : (
                <ScrollArea className="h-72 pr-3">
                  <div className="space-y-2">
                    {supportRequests.map((sa, idx) => {
                      const badge = SUPPORT_STATUT_BADGES[sa.statut] || { label: sa.statut, cls: '' }
                      return (
                        <motion.div
                          key={sa.id}
                          layout
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.04 }}
                          className="rounded-lg border border-amber-100 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-900/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{sa.raison}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Entreprise {sa.entrepriseId.slice(-6)} • {formatDistanceToNow(parseISO(sa.demandeLe), { addSuffix: true, locale: fr })}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn('text-[10px] shrink-0', badge.cls)}>
                              {badge.label}
                            </Badge>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── QUICK LINKS ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <QuickLink
          href="/admin/entreprises"
          icon={<Building2 className="w-4 h-4" />}
          title="Gérer les entreprises"
          subtitle="Créer, suspendre, consulter"
        />
        <QuickLink
          href="/admin/subscriptions"
          icon={<DollarSign className="w-4 h-4" />}
          title="Gérer les abonnements"
          subtitle="Plans, MRR, trials"
        />
        <QuickLink
          href="/admin/support-access"
          icon={<ShieldAlert className="w-4 h-4" />}
          title="Demandes d'accès support"
          subtitle="Révoquer un accès actif"
        />
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  loading,
  accent,
  delay,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  subtitle?: string
  loading: boolean
  accent: 'amber' | 'orange'
  delay: number
  href?: string
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    orange: 'from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-900/40',
  }[accent]

  const Wrapper = href ? Link : 'div'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Wrapper
        // @ts-ignore href only exists on Link
        href={href}
        className={cn(
          'block rounded-xl border bg-gradient-to-br backdrop-blur-xl p-4 transition-all duration-200',
          'bg-white/70 border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60',
          href && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-24 mt-1.5" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-1 text-foreground">
                {value}
              </p>
            )}
            {subtitle && !loading && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className={cn('shrink-0 rounded-lg p-2 border bg-gradient-to-br', accentClasses)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-500">
            Ouvrir <ArrowUpRight className="w-3 h-3" />
          </div>
        )}
      </Wrapper>
    </motion.div>
  )
}

function ActivityItem({
  icon,
  title,
  subtitle,
  time,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  time: string
}) {
  return (
    <div className="flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{time}</p>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-amber-100 bg-white/70 backdrop-blur-xl p-4 hover:shadow-md hover:border-amber-300 transition-all dark:bg-slate-900/50 dark:border-slate-800/60 dark:hover:border-amber-900/50"
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-lg p-2 bg-gradient-to-br from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}
