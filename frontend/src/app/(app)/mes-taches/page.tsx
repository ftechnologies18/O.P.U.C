'use client'

/**
 * Mes Tâches — vue personnelle des tâches assignées à l'utilisateur courant.
 *
 * Accessible à TOUS les rôles authentifiés (y compris EMPLOYE sans délégation).
 * C'est le point d'entrée pour la "délégation de suivi" : un CHEF_PROJET ou GERANT
 * assigne des tâches à un EMPLOYE via /chantiers/{id}, et l'EMPLOYE les retrouve ici.
 *
 * Backend endpoint:
 *   GET /api/v1/taches/mes-taches
 *     → { data: [{ id, nom, statut, avancement, dateDebut, dateFin,
 *                  phase: { id, nom, chantierId, chantier: { id, nom } },
 *                  responsableId }], total: N }
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from '@/lib/auth-session'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  Loader2,
  ListChecks,
  ArrowRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
    chantier: {
      id: string
      nom: string
    }
  }
  responsableId?: string
}

type StatutFilter = 'TOUS' | 'PLANIFIEE' | 'EN_COURS' | 'EN_RETARD' | 'TERMINE'

// ─── Statut helpers ──────────────────────────────────────────────────

const STATUT_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; badgeClass: string }
> = {
  PLANIFIEE: {
    label: 'Planifiée',
    icon: ClipboardList,
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
  },
  EN_COURS: {
    label: 'En cours',
    icon: Clock,
    badgeClass:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  },
  EN_RETARD: {
    label: 'En retard',
    icon: AlertTriangle,
    badgeClass:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  },
  TERMINE: {
    label: 'Terminée',
    icon: CheckCircle2,
    badgeClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  },
}

function getStatutConfig(statut: string) {
  return STATUT_CONFIG[statut] || STATUT_CONFIG.PLANIFIEE
}

// ─── Page Component ──────────────────────────────────────────────────

export default function MesTachesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [taches, setTaches] = useState<MyTache[]>([])
  const [loading, setLoading] = useState(true)
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('TOUS')

  const userName = (session?.user as any)?.name || ''
  const userRole = (session?.user as any)?.role as string | undefined

  const fetchTaches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/taches/mes-taches')
      if (res.ok) {
        const data = await res.json()
        setTaches(data.data || [])
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors du chargement des tâches')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTaches()
  }, [fetchTaches])

  // ─── Stats calculées ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = taches.length
    const enCours = taches.filter((t) => t.statut === 'EN_COURS').length
    const enRetard = taches.filter((t) => t.statut === 'EN_RETARD').length
    const terminees = taches.filter((t) => t.statut === 'TERMINE').length
    const planifiees = taches.filter((t) => t.statut === 'PLANIFIEE').length
    return { total, enCours, enRetard, terminees, planifiees }
  }, [taches])

  // ─── Filtre ─────────────────────────────────────────────────────────
  const filteredTaches = useMemo(() => {
    if (statutFilter === 'TOUS') return taches
    return taches.filter((t) => t.statut === statutFilter)
  }, [taches, statutFilter])

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="w-7 h-7 text-amber-500" />
            Mes Tâches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userName ? `Bonjour ${userName.split(' ')[0]}, ` : ''}
            voici les tâches qui vous sont assignées
            {userRole === 'EMPLOYE' && ' (délégation de suivi)'}.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/chantiers')}
          className="gap-2"
        >
          <Building2 className="w-4 h-4" />
          Voir les chantiers
        </Button>
      </motion.div>

      {/* ─── Stats Cards ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
      >
        <StatCard
          label="Total"
          value={stats.total}
          icon={ClipboardList}
          color="slate"
        />
        <StatCard
          label="Planifiées"
          value={stats.planifiees}
          icon={ClipboardList}
          color="slate"
        />
        <StatCard
          label="En cours"
          value={stats.enCours}
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="En retard"
          value={stats.enRetard}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label="Terminées"
          value={stats.terminees}
          icon={CheckCircle2}
          color="emerald"
        />
      </motion.div>

      {/* ─── Filter ─── */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Filtrer :
        </span>
        <Select
          value={statutFilter}
          onValueChange={(v) => setStatutFilter(v as StatutFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Toutes les tâches</SelectItem>
            <SelectItem value="PLANIFIEE">Planifiées</SelectItem>
            <SelectItem value="EN_COURS">En cours</SelectItem>
            <SelectItem value="EN_RETARD">En retard</SelectItem>
            <SelectItem value="TERMINE">Terminées</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredTaches.length} tâche
          {filteredTaches.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ─── Liste des tâches ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : filteredTaches.length === 0 ? (
        <EmptyState statutFilter={statutFilter} userRole={userRole} />
      ) : (
        <div className="grid gap-3">
          {filteredTaches.map((tache, idx) => (
            <TacheCard
              key={tache.id}
              tache={tache}
              index={idx}
              onNavigate={(chantierId) => router.push(`/chantiers/${chantierId}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stat Card Component ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Clock
  color: 'slate' | 'amber' | 'red' | 'emerald'
}) {
  const colorClasses = {
    slate: 'text-slate-600 dark:text-slate-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <Card className="p-4 backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
      </div>
    </Card>
  )
}

// ─── Tache Card Component ────────────────────────────────────────────

function TacheCard({
  tache,
  index,
  onNavigate,
}: {
  tache: MyTache
  index: number
  onNavigate: (chantierId: string) => void
}) {
  const cfg = getStatutConfig(tache.statut)
  const StatutIcon = cfg.icon

  // Vérifier si la tâche est en retard (dateFin passée et non terminée)
  const isOverdue =
    tache.dateFin &&
    tache.statut !== 'TERMINE' &&
    isPast(parseISO(tache.dateFin))

  const daysLeft = tache.dateFin
    ? differenceInDays(parseISO(tache.dateFin), new Date())
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className="p-4 backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 hover:shadow-md transition-shadow">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* ─── Statut icon + avancement ─── */}
          <div className="flex items-center gap-3 md:w-48">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cfg.badgeClass}`}
            >
              <StatutIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge
                variant="outline"
                className={`text-xs ${cfg.badgeClass} mb-1`}
              >
                {cfg.label}
              </Badge>
              <div className="flex items-center gap-2">
                <Progress
                  value={tache.avancement}
                  className="h-2 w-20"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round(tache.avancement)}%
                </span>
              </div>
            </div>
          </div>

          {/* ─── Nom + description ─── */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{tache.nom}</h3>
            {tache.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {tache.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {tache.phase?.chantier?.nom || 'Chantier inconnu'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>{tache.phase?.nom || 'Phase inconnue'}</span>
            </div>
          </div>

          {/* ─── Dates ─── */}
          <div className="flex flex-col gap-1 md:items-end text-xs">
            {tache.dateFin && (
              <div
                className={`flex items-center gap-1 ${
                  isOverdue
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : daysLeft !== null && daysLeft <= 3
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-muted-foreground'
                }`}
              >
                <Calendar className="w-3 h-3" />
                Échéance : {format(parseISO(tache.dateFin), 'dd MMM yyyy', { locale: fr })}
                {isOverdue && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold uppercase">
                    En retard
                  </span>
                )}
                {!isOverdue && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold uppercase">
                    {daysLeft === 0 ? 'Aujourd\'hui' : `${daysLeft}j`}
                  </span>
                )}
              </div>
            )}
            {tache.dateDebut && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Début : {format(parseISO(tache.dateDebut), 'dd MMM yyyy', { locale: fr })}
              </div>
            )}
          </div>

          {/* ─── Action ─── */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(tache.phase?.chantierId)}
            className="gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            Ouvrir
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({
  statutFilter,
  userRole,
}: {
  statutFilter: StatutFilter
  userRole?: string
}) {
  const isFiltered = statutFilter !== 'TOUS'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-12 backdrop-blur-xl bg-white/70 border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ListChecks className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {isFiltered
                ? `Aucune tâche "${getStatutConfig(statutFilter).label.toLowerCase()}"`
                : 'Aucune tâche assignée'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {isFiltered
                ? 'Essayez un autre filtre pour voir vos autres tâches.'
                : userRole === 'EMPLOYE'
                  ? "Votre responsable peut vous assigner des tâches depuis la page d'un chantier. Revenez ici pour les suivre."
                  : "Vous n'avez aucune tâche assignée pour le moment. Vous pouvez en créer depuis la page d'un chantier (onglet Phases & Tâches)."}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
