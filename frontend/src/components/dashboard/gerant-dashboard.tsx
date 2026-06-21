'use client'

/**
 * GerantDashboard — vue dashboard pour le Gérant d'entreprise (GERANT).
 *
 * Le GERANT est le propriétaire/gérant du tenant (entreprise BTP). Il a accès à
 * TOUTES les données opérationnelles + financières de son entreprise. Ce dashboard
 * lui donne une vision 360° de l'activité : KPIs opérationnels, budget global,
 * alertes stock, tâches en retard, notifications, et quick actions vers les
 * modules clés (nouveau chantier, paie, gestion users).
 *
 * Backend endpoints :
 *   GET /api/v1/dashboard         → KPIs BTP (chantiersActifs, journaliersSurSite,
 *                                    pointagesAujourdhui, tachesEnRetard,
 *                                    alertesActives, budgetData, stockAlerts,
 *                                    tachesEnRetardDetails)
 *   GET /api/v1/chantiers        → liste des chantiers (pour top 3 + statusDistribution)
 *   GET /api/v1/notifications     → notifications récentes
 *   GET /api/v1/auth/me           → profil utilisateur (nom, role)
 *
 * Style : glassmorphism + amber/orange theme, animations Framer Motion,
 * responsive mobile-first (grille 2 cols sur mobile, 4 cols sur desktop).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2,
  Users,
  ClipboardList,
  Bell,
  TrendingUp,
  Calendar,
  Package,
  FileText,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Wallet,
  BarChart3,
  UserCog,
  Plus,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────

interface BudgetItem {
  chantierId: string
  nom: string
  budgetPrevisionnel: number
  budgetReel: number
}

interface ChantierItem {
  id: string
  nom: string
  budgetPrevisionnel: number
  statut: string
}

interface NotificationItem {
  id: string
  titre: string
  message: string
  type: string
  lu: boolean
  createdAt: string
}

interface DashboardData {
  chantiersActifs: number
  journaliersSurSite: number
  pointagesAujourdhui: number
  alertesActives: number
  tachesEnRetard: number
  budgetData: BudgetItem[]
  tachesEnRetardDetails: Array<{
    id: string
    nom: string
    dateFin: string | null
    avancement: number
    phase: { nom: string; chantier: { nom: string } }
  }>
}

// ─── Constants ───────────────────────────────────────────────────────

const statutColors: Record<string, string> = {
  EN_COURS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_PREPARATION: 'bg-amber-100 text-amber-700 border-amber-200',
  EN_PAUSE: 'bg-orange-100 text-orange-700 border-orange-200',
  TERMINE: 'bg-slate-100 text-slate-700 border-slate-200',
  RECEPTIONNE: 'bg-blue-100 text-blue-700 border-blue-200',
}

const statutLabels: Record<string, string> = {
  EN_COURS: 'En cours',
  EN_PREPARATION: 'En préparation',
  EN_PAUSE: 'En pause',
  TERMINE: 'Terminé',
  RECEPTIONNE: 'Réceptionné',
}

const AMBER_COLORS = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f']

const NOTIF_TYPE_ICONS: Record<string, string> = {
  STOCK_ALERT: '📦',
  BUDGET_ALERT: '💰',
  PAIEMENT: '💳',
  TACHE_RETARD: '⚠️',
  DOCUMENT: '📄',
}

const formatFCFA = (value: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(value))

// ─── Component ───────────────────────────────────────────────────────

export function GerantDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [chantiers, setChantiers] = useState<ChantierItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      try {
        const [dashRes, chantiersRes, notifRes, meRes] = await Promise.all([
          fetch('/api/v1/dashboard', { credentials: 'same-origin' }),
          fetch('/api/v1/chantiers', { credentials: 'same-origin' }),
          fetch('/api/v1/notifications?limit=10', { credentials: 'same-origin' }),
          fetch('/api/v1/auth/me', { credentials: 'same-origin' }),
        ])

        if (!dashRes.ok) throw new Error('Failed to fetch dashboard')
        const dash = await dashRes.json()

        let chantiersList: ChantierItem[] = []
        if (chantiersRes.ok) {
          const chJson = await chantiersRes.json()
          chantiersList = (chJson.chantiers || []).map((c: any) => ({
            id: c.id,
            nom: c.nom,
            budgetPrevisionnel: c.budgetPrevisionnel || 0,
            statut: c.statut,
          }))
        }

        let notifs: NotificationItem[] = []
        if (notifRes.ok) {
          const nJson = await notifRes.json()
          notifs = nJson.notifications || []
        }

        let me: any = null
        if (meRes.ok) me = await meRes.json()

        if (cancelled) return

        setData({
          chantiersActifs: dash.chantiersActifs || 0,
          journaliersSurSite: dash.journaliersSurSite || 0,
          pointagesAujourdhui: dash.pointagesAujourdhui || 0,
          alertesActives: dash.alertesActives || 0,
          tachesEnRetard: dash.tachesEnRetard || 0,
          budgetData: (dash.budgetData || []).map((b: any) => ({
            chantierId: b.id,
            nom: b.nom,
            budgetPrevisionnel: b.budgetPrevisionnel || 0,
            budgetReel: b.coutReel || 0,
          })),
          tachesEnRetardDetails: dash.tachesEnRetardDetails || [],
        })
        setChantiers(chantiersList)
        setNotifications(notifs)
        setUserName(me?.name || 'Gérant')
      } catch (err: any) {
        if (!cancelled) {
          toast.error('Erreur lors du chargement du tableau de bord', {
            description: err?.message,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  // ─── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-muted/60 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-muted/60 rounded-xl animate-pulse" />
          <div className="h-80 bg-muted/60 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted/60 rounded-xl animate-pulse" />
          <div className="h-64 bg-muted/60 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!data) return null

  // ─── KPI cards ──────────────────────────────────────────────────────
  const kpiCards = [
    {
      title: 'Chantiers actifs',
      value: data.chantiersActifs,
      icon: Building2,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'Journaliers sur site',
      value: data.journaliersSurSite,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: "Pointages aujourd'hui",
      value: data.pointagesAujourdhui,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      borderColor: 'border-orange-200 dark:border-orange-500/20',
    },
    {
      title: 'Tâches en retard',
      value: data.tachesEnRetard,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
      borderColor: 'border-red-200 dark:border-red-500/20',
      highlight: data.tachesEnRetard > 0,
    },
    {
      title: 'Alertes actives',
      value: data.alertesActives,
      icon: Bell,
      color: 'text-rose-600',
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      borderColor: 'border-rose-200 dark:border-rose-500/20',
      highlight: data.alertesActives > 0,
    },
  ]

  // ─── Budget chart data ──────────────────────────────────────────────
  const budgetChartData = data.budgetData.map((b) => ({
    name: b.nom.length > 18 ? b.nom.substring(0, 16) + '…' : b.nom.split(' - ')[0],
    prévisionnel: Math.round(b.budgetPrevisionnel / 1000000),
    réel: Math.round(b.budgetReel / 1000000),
  }))

  // ─── Status distribution (pie) ──────────────────────────────────────
  const statusDistribution = chantiers.reduce((acc, c) => {
    const label = statutLabels[c.statut] || c.statut
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const pieData = Object.entries(statusDistribution).map(([name, value]) => ({
    name,
    value,
  }))

  // ─── Top 3 chantiers (par budget) ───────────────────────────────────
  const topChantiers = [...chantiers]
    .sort((a, b) => b.budgetPrevisionnel - a.budgetPrevisionnel)
    .slice(0, 3)

  // ─── Quick actions ──────────────────────────────────────────────────
  const quickActions = [
    {
      label: 'Nouveau chantier',
      icon: Plus,
      view: 'chantiers',
      description: 'Créer un chantier',
    },
    {
      label: 'Générer paie',
      icon: Wallet,
      view: 'paie',
      description: 'Valider les paiements',
    },
    {
      label: 'Gérer users',
      icon: UserCog,
      view: 'gestion-acces',
      description: 'Utilisateurs & accès',
    },
    {
      label: 'Suivi budget',
      icon: BarChart3,
      view: 'budget',
      description: 'Consulter les dépenses',
    },
    {
      label: 'Planning',
      icon: Calendar,
      view: 'planning',
      description: 'Diagramme de Gantt',
    },
    {
      label: 'Rapports',
      icon: FileText,
      view: 'rapports',
      description: 'Rédiger un rapport',
    },
  ]

  // ─── Total budget entreprise ────────────────────────────────────────
  const totalBudget = data.budgetData.reduce(
    (sum, b) => sum + b.budgetPrevisionnel,
    0,
  )
  const totalReel = data.budgetData.reduce((sum, b) => sum + b.budgetReel, 0)
  const budgetConsommationPct =
    totalBudget > 0 ? Math.round((totalReel / totalBudget) * 100) : 0

  return (
    <div className="space-y-6">
      {/* ─── Welcome header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2"
      >
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            Bonjour, {userName} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérant — Voici un aperçu global de votre entreprise et de
            l&apos;activité du jour.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </motion.div>

      {/* ─── KPI cards ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-5 gap-4"
      >
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.title}
              className={`backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-shadow ${
                card.highlight ? 'ring-2 ring-red-300 dark:ring-red-500/40' : ''
              }`}
            >
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs lg:text-sm text-muted-foreground font-medium">
                      {card.title}
                    </p>
                    <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`p-2 lg:p-2.5 rounded-lg ${card.bg} ${card.borderColor} border`}
                  >
                    <Icon className={`w-4.5 h-4.5 lg:w-5 lg:h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* ─── Budget global entreprise ─── */}
      {data.budgetData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Wallet className="w-4.5 h-4.5 text-amber-500" />
                Budget global entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Budget prévisionnel
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatFCFA(totalBudget)}{' '}
                    <span className="text-xs text-muted-foreground">FCFA</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Dépenses réelles
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatFCFA(totalReel)}{' '}
                    <span className="text-xs text-muted-foreground">FCFA</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Consommation
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={budgetConsommationPct} className="h-2 flex-1" />
                    <span
                      className={`text-sm font-bold ${
                        budgetConsommationPct >= 100
                          ? 'text-red-600'
                          : budgetConsommationPct >= 80
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                      }`}
                    >
                      {budgetConsommationPct}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget chart */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="lg:col-span-2"
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-amber-500" />
                Budget par chantier (millions FCFA)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {budgetChartData.length > 0 ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetChartData} barGap={8}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(0 0% 90%)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: 'hsl(0 0% 40%)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(0 0% 40%)' }}
                          axisLine={false}
                          tickLine={false}
                          width={50}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid hsl(0 0% 90%)',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value}M FCFA`]}
                        />
                        <Bar
                          dataKey="prévisionnel"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                          barSize={32}
                        />
                        <Bar
                          dataKey="réel"
                          fill="#fbbf24"
                          radius={[4, 4, 0, 0]}
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-muted-foreground">
                        Prévisionnel
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-sm text-muted-foreground">
                        Réel (dépenses)
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée budgétaire disponible
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Statut des chantiers (pie) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">
                Statut des chantiers
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {pieData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={AMBER_COLORS[index % AMBER_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid hsl(0 0% 90%)',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                    {chantiers.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        className="flex items-center justify-between text-sm w-full text-left hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors"
                        onClick={() => router.push(`/chantiers/${c.id}`)}
                      >
                        <span className="text-muted-foreground truncate max-w-[140px]">
                          {c.nom.split(' - ')[0]}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statutColors[c.statut] || ''}`}
                        >
                          {statutLabels[c.statut] || c.statut}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Aucun chantier
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Top chantiers + Quick actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 3 chantiers */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-amber-500" />
                Chantiers en cours
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {topChantiers.length > 0 ? (
                <div className="space-y-3">
                  {topChantiers.map((c) => {
                    const budgetItem = data.budgetData.find(
                      (b) => b.chantierId === c.id,
                    )
                    const pct =
                      budgetItem && budgetItem.budgetPrevisionnel > 0
                        ? Math.round(
                            (budgetItem.budgetReel /
                              budgetItem.budgetPrevisionnel) *
                              100,
                          )
                        : 0
                    return (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/chantiers/${c.id}`)}
                        className="block w-full text-left p-3 rounded-lg border border-border/60 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="font-medium text-sm text-foreground truncate">
                            {c.nom}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ml-2 shrink-0 ${statutColors[c.statut] || ''}`}
                          >
                            {statutLabels[c.statut] || c.statut}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {formatFCFA(c.budgetPrevisionnel)} FCFA
                          </span>
                          {budgetItem && (
                            <span
                              className={
                                pct >= 100
                                  ? 'text-red-600 font-medium'
                                  : pct >= 80
                                    ? 'text-amber-600 font-medium'
                                    : 'text-emerald-600'
                              }
                            >
                              {pct}% consommé
                            </span>
                          )}
                        </div>
                        {budgetItem && (
                          <Progress value={pct} className="h-1.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Building2 className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Aucun chantier</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 text-amber-600"
                    onClick={() => router.push('/chantiers')}
                  >
                    Créer un chantier
                  </Button>
                </div>
              )}
              {chantiers.length > 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full h-8 text-sm"
                  onClick={() => router.push('/chantiers')}
                >
                  Voir tous les chantiers{' '}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">
                Actions rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.view}
                      variant="outline"
                      title={action.description}
                      className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/30 transition-colors"
                      onClick={() => router.push(`/${action.view}`)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium text-center leading-tight">
                        {action.label}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Tâches en retard + Notifications ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tâches en retard */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <Card
            className={`backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full ${
              data.tachesEnRetard > 0
                ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5'
                : ''
            }`}
          >
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                Tâches en retard ({data.tachesEnRetard})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {data.tachesEnRetardDetails.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.tachesEnRetardDetails.map((tache) => (
                    <div
                      key={tache.id}
                      className="flex items-center justify-between text-sm bg-white dark:bg-background rounded-lg px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {tache.nom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tache.phase.chantier.nom} · {tache.phase.nom}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(tache.avancement)}%
                        </span>
                        {tache.dateFin && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-orange-300 text-orange-700 dark:text-orange-400"
                          >
                            {format(new Date(tache.dateFin), 'dd MMM', {
                              locale: fr,
                            })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <CheckCircle2 className="w-6 h-6 mb-1 text-emerald-500" />
                  <p className="text-xs">Aucune tâche en retard 🎉</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8 text-sm border-orange-200 hover:bg-orange-100 dark:border-orange-500/30 dark:hover:bg-orange-500/10"
                onClick={() => router.push('/planning')}
              >
                Voir le planning <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications récentes */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Notifications récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {notifications.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                        notif.lu
                          ? 'bg-muted/50'
                          : 'bg-amber-50 border border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20'
                      }`}
                    >
                      <span className="text-base mt-0.5">
                        {NOTIF_TYPE_ICONS[notif.type] || '📌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">
                          {notif.titre}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {notif.message}
                        </p>
                      </div>
                      {!notif.lu && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Bell className="w-6 h-6 mb-1 opacity-50" />
                  <p className="text-xs">Aucune notification</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// Export a small loader for external use (e.g. dashboard page.tsx loading state)
export function GerantDashboardLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  )
}
