'use client'

/**
 * EmployeDashboard — vue dashboard pour l'Employé (EMPLOYE / SOUS_TRAITANT).
 *
 * L'EMPLOYE n'a PAS accès aux données opérationnelles agrégées de l'entreprise
 * (chantiersActifs, budget global, journaliers sur site, etc.) — le RLS côté
 * backend bloque ces requêtes. Ce dashboard se concentre UNIQUEMENT sur les
 * données personnelles :
 *   - Ses tâches assignées (total, en cours, en retard, terminées)
 *   - Ses tâches du jour (filtrées par date)
 *   - Ses tâches en retard (alerte rouge)
 *   - Ses notifications récentes
 *   - Quick action : "Voir mes tâches" → /mes-taches
 *
 * Backend endpoints :
 *   GET /api/v1/taches/mes-taches  → tâches assignées au user courant
 *   GET /api/v1/notifications      → notifications du user courant
 *   GET /api/v1/auth/me            → profil utilisateur (nom, role, fonction)
 *
 * Style : glassmorphism + amber/orange theme, animations Framer Motion,
 * responsive mobile-first.
 *
 * NOTE : NE PAS afficher de KPIs entreprise (chantiersActifs, budget, etc.) —
 * l'EMPLOYE n'y a pas accès.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  format,
  parseISO,
  isPast,
  differenceInDays,
  isToday,
  isFuture,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Bell,
  ArrowRight,
  ListChecks,
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

export function EmployeDashboard() {
  const router = useRouter()
  const [taches, setTaches] = useState<MyTache[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      try {
        const [tachesRes, notifRes, meRes] = await Promise.all([
          fetch('/api/v1/taches/mes-taches', { credentials: 'same-origin' }),
          fetch('/api/v1/notifications?limit=10', {
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

        let notifs: NotificationItem[] = []
        if (notifRes.ok) {
          const nJson = await notifRes.json()
          notifs = nJson.notifications || []
        }

        let me: any = null
        if (meRes.ok) me = await meRes.json()

        if (cancelled) return

        setTaches(tachesList)
        setNotifications(notifs)
        setUserName(me?.name || 'Employé')
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
  const total = taches.length
  const enCours = taches.filter((t) => t.statut === 'EN_COURS')
  const enRetard = taches.filter(
    (t) =>
      t.statut === 'EN_RETARD' ||
      (t.dateFin && t.statut !== 'TERMINE' && isPast(parseISO(t.dateFin))),
  )
  const terminees = taches.filter((t) => t.statut === 'TERMINE')

  // ─── Tâches du jour (dateFin == today) ──────────────────────────────
  const tachesDuJour = taches
    .filter((t) => {
      if (!t.dateFin) return false
      try {
        return isToday(parseISO(t.dateFin))
      } catch {
        return false
      }
    })
    .filter((t) => t.statut !== 'TERMINE')
    .slice(0, 5)

  // ─── Tâches à venir (dateFin future, non terminées) ─────────────────
  const tachesAVenir = taches
    .filter((t) => {
      if (!t.dateFin) return false
      try {
        return (
          isFuture(parseISO(t.dateFin)) &&
          !isToday(parseISO(t.dateFin)) &&
          t.statut !== 'TERMINE'
        )
      } catch {
        return false
      }
    })
    .slice(0, 5)

  // ─── Notifications non lues ─────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.lu).length

  // ─── KPI cards ──────────────────────────────────────────────────────
  const kpiCards = [
    {
      title: 'Mes tâches (total)',
      value: total,
      icon: ClipboardList,
      color: 'text-slate-600',
      bg: 'bg-slate-50 dark:bg-slate-500/10',
      borderColor: 'border-slate-200 dark:border-slate-500/20',
    },
    {
      title: 'En cours',
      value: enCours.length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'En retard',
      value: enRetard.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
      borderColor: 'border-red-200 dark:border-red-500/20',
      highlight: enRetard.length > 0,
    },
    {
      title: 'Terminées',
      value: terminees.length,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-500/20',
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
            Voici vos tâches assignées et vos notifications.
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

      {/* ─── Alert: tâches en retard ─── */}
      {enRetard.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="backdrop-blur-xl bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800/60 shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Tâches en retard ({enRetard.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {enRetard.slice(0, 5).map((tache) => {
                  const cfg = getStatutConfig(tache.statut)
                  const daysLate = tache.dateFin
                    ? Math.abs(differenceInDays(parseISO(tache.dateFin), new Date()))
                    : 0
                  return (
                    <button
                      key={tache.id}
                      onClick={() =>
                        router.push(`/chantiers/${tache.phase.chantierId}`)
                      }
                      className="block w-full text-left p-3 rounded-lg bg-white dark:bg-background border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm text-foreground truncate">
                          {tache.nom}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {tache.phase.chantier.nom} · {tache.phase.nom}
                      </p>
                      {tache.dateFin && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                          En retard de {daysLate} jour{daysLate > 1 ? 's' : ''} ·
                          échéance{' '}
                          {format(parseISO(tache.dateFin), 'dd MMM yyyy', {
                            locale: fr,
                          })}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8 text-sm border-red-200 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                onClick={() => router.push('/mes-taches')}
              >
                Voir toutes mes tâches <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Mes tâches du jour + Notifications ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes tâches du jour */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-amber-500" />
                Mes tâches du jour
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {tachesDuJour.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {tachesDuJour.map((tache) => {
                    const cfg = getStatutConfig(tache.statut)
                    return (
                      <button
                        key={tache.id}
                        onClick={() =>
                          router.push(`/chantiers/${tache.phase.chantierId}`)
                        }
                        className="block w-full text-left p-3 rounded-lg border border-border/60 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
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
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Calendar className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Aucune tâche pour aujourd&apos;hui</p>
                  {tachesAVenir.length > 0 && (
                    <p className="text-xs mt-1">
                      {tachesAVenir.length} tâche
                      {tachesAVenir.length > 1 ? 's' : ''} à venir
                    </p>
                  )}
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

        {/* Notifications récentes */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 shadow-sm h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Notifications
                {unreadCount > 0 && (
                  <Badge className="ml-1 bg-amber-500 text-white text-[10px]">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {notifications.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
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
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {(() => {
                            try {
                              return format(parseISO(notif.createdAt), 'dd MMM, HH:mm', {
                                locale: fr,
                              })
                            } catch {
                              return ''
                            }
                          })()}
                        </p>
                      </div>
                      {!notif.lu && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Aucune notification</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Quick action CTA ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <Card className="backdrop-blur-xl bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Consulter toutes mes tâches
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Accédez à la liste complète de vos tâches assignées et suivez
                    leur avancement.
                  </p>
                </div>
              </div>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                onClick={() => router.push('/mes-taches')}
              >
                Voir mes tâches <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export function EmployeDashboardLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  )
}
