'use client'

/**
 * ChefProjetDashboard — vue dashboard pour le Chef de Projet (CHEF_PROJET).
 *
 * Le CHEF_PROJET gère l'opérationnel (chantiers, pointage, stocks) mais PAS
 * le management financier/HR global. Ce dashboard se concentre sur :
 *   - Ses tâches assignées (en cours, en retard, à venir)
 *   - Les pointages du jour à valider
 *   - Les chantiers actifs qu'il supervise
 *   - Les alertes stock sur ses chantiers
 *
 * Backend endpoints :
 *   GET /api/v1/taches/mes-taches  → tâches assignées au user courant
 *   GET /api/v1/dashboard          → KPIs BTP (chantiersActifs, pointagesAujourdhui,
 *                                     tachesEnRetard, alertesActives, budgetData)
 *   GET /api/v1/pointage?summary   → agrégats pointage (pointages à valider)
 *   GET /api/v1/auth/me            → profil utilisateur
 *
 * Style : glassmorphism + amber/orange theme, animations Framer Motion,
 * responsive mobile-first.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  Bell,
  ArrowRight,
  ListChecks,
  Plus,
  Package,
  Users,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// ─── Types ───────────────────────────────────────────────────────────

interface MyTache {
  id: string
  nom: string
  description?: string
  statut: string // PLANIFIEE | EN_COURS | TERMINE | EN_RETARD
  avancement: number
  dateDebut?: string | null
  dateFin?: string | null
  phase: {
    id: string
    nom: string
    chantierId: string
    chantier: { id: string; nom: string }
  }
}

interface DashboardData {
  chantiersActifs: number
  journaliersSurSite: number
  pointagesAujourdhui: number
  tachesEnRetard: number
  alertesActives: number
}

interface NotificationItem {
  id: string
  titre: string
  message: string
  type: string
  lu: boolean
  createdAt: string
}

// ─── Constants ───────────────────────────────────────────────────────

const STATUT_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  PLANIFIEE: {
    label: 'Planifiée',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
  },
  EN_COURS: {
    label: 'En cours',
    badgeClass:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  },
  EN_RETARD: {
    label: 'En retard',
    badgeClass:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  },
  TERMINE: {
    label: 'Terminée',
    badgeClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  },
}

function getStatutConfig(statut: string) {
  return STATUT_CONFIG[statut] || STATUT_CONFIG.PLANIFIEE
}

const NOTIF_TYPE_ICONS: Record<string, string> = {
  STOCK_ALERT: '📦',
  BUDGET_ALERT: '💰',
  PAIEMENT: '💳',
  TACHE_RETARD: '⚠️',
  DOCUMENT: '📄',
}

// ─── Component ───────────────────────────────────────────────────────

export function ChefProjetDashboard() {
  const router = useRouter()
  const [taches, setTaches] = useState<MyTache[]>([])
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      try {
        const [tachesRes, dashRes, notifRes, meRes] = await Promise.all([
          fetch('/api/v1/taches/mes-taches', { credentials: 'same-origin' }),
          fetch('/api/v1/dashboard', { credentials: 'same-origin' }),
          fetch('/api/v1/notifications?limit=8', {
            credentials: 'same-origin',
          }),
          fetch('/api/v1/auth/me', { credentials: 'same-origin' }),
        ])

        let tachesList: MyTache[] = []
        if (tachesRes.ok) {
          const tJson = await tachesRes.json()
          tachesList = (tJson.data || []).map((t: any) => ({
            id: t.id,
            nom: t.nom,
            description: t.description,
            statut: t.statut,
            avancement: t.avancement,
            dateDebut: t.dateDebut,
            dateFin: t.dateFin,
            phase: {
              id: t.phase?.id || '',
              nom: t.phase?.nom || '',
              chantierId: t.phase?.chantierId || '',
              chantier: {
                id: t.phase?.chantier?.id || '',
                nom: t.phase?.chantier?.nom || 'Chantier inconnu',
              },
            },
          }))
        }

        let dash: DashboardData | null = null
        if (dashRes.ok) {
          const d = await dashRes.json()
          dash = {
            chantiersActifs: d.chantiersActifs || 0,
            journaliersSurSite: d.journaliersSurSite || 0,
            pointagesAujourdhui: d.pointagesAujourdhui || 0,
            tachesEnRetard: d.tachesEnRetard || 0,
            alertesActives: d.alertesActives || 0,
          }
        }

        let notifs: NotificationItem[] = []
        if (notifRes.ok) {
          const nJson = await notifRes.json()
          notifs = nJson.notifications || []
        }

        let me: any = null
        if (meRes.ok) me = await meRes.json()

        if (cancelled) return

        setTaches(tachesList)
        setDashData(dash)
        setNotifications(notifs)
        setUserName(me?.name || 'Chef de projet')
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-muted/60 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted/60 rounded-xl animate-pulse" />
          <div className="h-80 bg-muted/60 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // ─── Stats calculées ────────────────────────────────────────────────
  const tachesEnCours = taches.filter((t) => t.statut === 'EN_COURS')
  const tachesRetard = taches.filter((t) => t.statut === 'EN_RETARD')
  const tachesTerminees = taches.filter((t) => t.statut === 'TERMINE')

  const top5Taches = tachesEnCours
    .concat(tachesRetard)
    .slice(0, 5)

  // ─── KPI cards ──────────────────────────────────────────────────────
  const kpiCards = [
    {
      title: 'Mes tâches en cours',
      value: tachesEnCours.length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'Mes tâches en retard',
      value: tachesRetard.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
      borderColor: 'border-red-200 dark:border-red-500/20',
      highlight: tachesRetard.length > 0,
    },
    {
      title: 'Pointages aujourd\'hui',
      value: dashData?.pointagesAujourdhui ?? 0,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      borderColor: 'border-orange-200 dark:border-orange-500/20',
    },
    {
      title: 'Chantiers actifs',
      value: dashData?.chantiersActifs ?? 0,
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-500/20',
    },
  ]

  // ─── Quick actions ──────────────────────────────────────────────────
  const quickActions = [
    {
      label: 'Nouveau pointage',
      icon: Plus,
      view: 'pointage',
      description: 'Enregistrer la présence',
    },
    {
      label: 'Voir mes tâches',
      icon: ListChecks,
      view: 'mes-taches',
      description: 'Liste de mes tâches',
    },
    {
      label: 'Planning',
      icon: Calendar,
      view: 'planning',
      description: 'Diagramme de Gantt',
    },
    {
      label: 'Stocks',
      icon: Package,
      view: 'stocks',
      description: 'Entrées & sorties',
    },
  ]

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
            Chef de Projet — Voici vos tâches et l&apos;activité opérationnelle du
            jour.
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
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
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

      {/* ─── Mes tâches + Quick actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mes tâches assignées */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <ListChecks className="w-4.5 h-4.5 text-amber-500" />
                Mes tâches assignées
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {top5Taches.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {top5Taches.map((tache) => {
                    const cfg = getStatutConfig(tache.statut)
                    const isOverdue =
                      tache.dateFin &&
                      tache.statut !== 'TERMINE' &&
                      isPast(parseISO(tache.dateFin))
                    const daysLeft = tache.dateFin
                      ? differenceInDays(parseISO(tache.dateFin), new Date())
                      : null
                    return (
                      <button
                        key={tache.id}
                        onClick={() =>
                          router.push(`/chantiers/${tache.phase.chantierId}`)
                        }
                        className="block w-full text-left p-3 rounded-lg border border-border/60 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {tache.nom}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {tache.phase.chantier.nom} · {tache.phase.nom}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${cfg.badgeClass}`}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={tache.avancement}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(tache.avancement)}%
                          </span>
                          {tache.dateFin && (
                            <span
                              className={`text-xs flex items-center gap-1 ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : daysLeft !== null && daysLeft <= 3
                                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(tache.dateFin), 'dd MMM', {
                                locale: fr,
                              })}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                  <p className="text-sm">
                    Aucune tâche en cours — tout est à jour 🎉
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8 text-sm"
                onClick={() => router.push('/mes-taches')}
              >
                Voir toutes mes tâches <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">
                Actions rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
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

      {/* ─── Pointages du jour + Notifications + Alertes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pointages du jour */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-amber-500" />
                Pointages du jour
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Pointages aujourd&apos;hui
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {dashData?.pointagesAujourdhui ?? 0}
                    </p>
                  </div>
                  <ClipboardList className="w-8 h-8 text-amber-500/40" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Journaliers sur site
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {dashData?.journaliersSurSite ?? 0}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-emerald-500/40" />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8 text-sm"
                onClick={() => router.push('/pointage')}
              >
                Gérer le pointage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alertes */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card
            className={`backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full ${
              (dashData?.alertesActives ?? 0) > 0
                ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
                : ''
            }`}
          >
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Alertes stock
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-col items-center justify-center py-4">
                <p className="text-4xl font-bold text-red-600 dark:text-red-400">
                  {dashData?.alertesActives ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  alerte{(dashData?.alertesActives ?? 0) > 1 ? 's' : ''} active
                  {(dashData?.alertesActives ?? 0) > 1 ? 's' : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8 text-sm border-red-200 hover:bg-red-100 dark:border-red-500/30 dark:hover:bg-red-500/10"
                onClick={() => router.push('/stocks')}
              >
                Voir le stock <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications récentes */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {notifications.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-2 p-2 rounded-lg text-xs transition-colors ${
                        notif.lu
                          ? 'bg-muted/50'
                          : 'bg-amber-50 border border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20'
                      }`}
                    >
                      <span className="text-sm mt-0.5">
                        {NOTIF_TYPE_ICONS[notif.type] || '📌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-xs">
                          {notif.titre}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {notif.message}
                        </p>
                      </div>
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

export function ChefProjetDashboardLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  )
}
