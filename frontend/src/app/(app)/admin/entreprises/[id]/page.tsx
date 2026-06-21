'use client'

/**
 * Détail d'une entreprise (tenant) — SUPER_ADMIN.
 *
 * Cards: infos entreprise, abonnement, stats (users, chantiers, factures).
 * Table des utilisateurs de cette entreprise (visible seulement si le
 * SUPER_ADMIN a un accès support actif — RLS côté backend).
 * Actions: demander accès support, suspendre/réactiver.
 *
 * Backend endpoints:
 *   GET    /api/v1/admin/entreprises/{id}              — détail + stats + abonnement
 *   POST   /api/v1/admin/entreprises/{id}/suspend
 *   POST   /api/v1/admin/entreprises/{id}/reactivate
 *   POST   /api/v1/admin/support-access/request        — body {entrepriseId, raison}
 *   GET    /api/v1/users                                — users (RLS filter by support access)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users as UsersIcon,
  ShieldAlert,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Pencil,
  ClipboardList,
  Receipt,
  HardDrive,
  Calendar,
  Eye,
  ShieldCheck,
  Clock,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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
  amount: number
  currency: string
  maxUsers: number
  maxChantiers: number
  maxStorageMB: number
  trialEndsAt?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  createdAt: string
}

interface EntrepriseDetail {
  entreprise: Entreprise
  stats: Record<string, any>
  subscription?: Subscription | null
}

interface User {
  id: string
  name: string
  email: string
  role: string
  telephone?: string | null
  active: boolean
  entrepriseId?: string | null
  lastLoginAt?: string | null
  createdAt: string
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

const SUB_STATUT_BADGES: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'Trial', cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  ACTIVE: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  PAST_DUE: { label: 'En retard', cls: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  CANCELED: { label: 'Annulé', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  EXPIRED: { label: 'Expiré', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  GERANT: 'Gérant',
  CHEF_PROJET: 'Chef de Projet',
  EMPLOYE: 'Employé',
}

const ROLE_BADGES: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  GERANT: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  CHEF_PROJET: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMPLOYE: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400',
}

function formatFCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function EntrepriseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [detail, setDetail] = useState<EntrepriseDetail | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const id = params?.id

  const load = useCallback(async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const [detailRes, usersRes] = await Promise.allSettled([
        fetch(`/api/v1/admin/entreprises/${id}`, { credentials: 'same-origin' }),
        fetch('/api/v1/users', { credentials: 'same-origin' }),
      ])

      if (detailRes.status === 'fulfilled' && detailRes.value.ok) {
        const d: EntrepriseDetail = await detailRes.value.json()
        setDetail(d)
      } else if (detailRes.status === 'fulfilled') {
        toast.error('Entreprise introuvable')
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const data = await usersRes.value.json()
        const all: User[] = Array.isArray(data) ? data : (data.data || [])
        setUsers(all.filter((u) => u.entrepriseId === id))
      } else {
        setUsers([])
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load()
    }
  }, [userRole, load])

  const handleSuspend = async () => {
    if (!detail) return
    try {
      const res = await fetch(`/api/v1/admin/entreprises/${detail.entreprise.id}/suspend`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success(`${detail.entreprise.nom} a été suspendue`)
      setSuspendOpen(false)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la suspension', { description: e?.message })
    }
  }

  const handleReactivate = async () => {
    if (!detail) return
    try {
      const res = await fetch(`/api/v1/admin/entreprises/${detail.entreprise.id}/reactivate`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success(`${detail.entreprise.nom} a été réactivée`)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la réactivation', { description: e?.message })
    }
  }

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

  const entreprise = detail?.entreprise
  const stats = detail?.stats || {}
  const subscription = detail?.subscription
  const isSuspended = entreprise?.status === 'suspended'

  return (
    <div className="space-y-6 pb-4">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/entreprises')}
            className="shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent truncate">
              {loading ? <Skeleton className="h-8 w-48" /> : entreprise?.nom || 'Entreprise'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Détails et statistiques du tenant
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
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
            variant="outline"
            size="sm"
            onClick={() => setSupportOpen(true)}
            className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            <ShieldAlert className="w-4 h-4" />
            Accès support
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Éditer
          </Button>
          {isSuspended ? (
            <Button
              size="sm"
              onClick={handleReactivate}
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              Réactiver
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSuspendOpen(true)}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Ban className="w-4 h-4" />
              Suspendre
            </Button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      ) : !detail ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-40" />
            Entreprise introuvable.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── INFOS + ABONNEMENT ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Infos entreprise */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:col-span-2"
            >
              <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-500" />
                    Informations
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0">
                  <InfoRow
                    icon={<Building2 className="w-4 h-4" />}
                    label="Nom"
                    value={entreprise?.nom || '—'}
                  />
                  <InfoRow
                    icon={<span className="text-xs font-bold">{isSuspended ? '⛔' : '✓'}</span>}
                    label="Statut"
                    value={
                      isSuspended ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                          Suspendue
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                          Active
                        </Badge>
                      )
                    }
                  />
                  <InfoRow
                    icon={<Mail className="w-4 h-4" />}
                    label="Email"
                    value={entreprise?.email || '—'}
                  />
                  <InfoRow
                    icon={<Phone className="w-4 h-4" />}
                    label="Téléphone"
                    value={entreprise?.telephone || '—'}
                  />
                  <InfoRow
                    icon={<MapPin className="w-4 h-4" />}
                    label="Adresse"
                    value={entreprise?.adresse || '—'}
                    full
                  />
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Créée le"
                    value={(() => {
                      try { return format(parseISO(entreprise!.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr }) } catch { return '—' }
                    })()}
                    full
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Abonnement */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-orange-500" />
                    Abonnement
                  </CardTitle>
                  {subscription && (
                    <CardDescription className="text-xs">
                      <Link href="/admin/subscriptions" className="text-amber-700 dark:text-amber-400 hover:underline">
                        Gérer les abonnements →
                      </Link>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {!subscription ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      Aucun abonnement actif.
                      <div className="mt-3">
                        <Button asChild size="sm" className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                          <Link href="/admin/subscriptions">Créer un abonnement</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Plan</span>
                        <Badge variant="outline" className={cn('text-xs', PLAN_BADGES[subscription.plan])}>
                          {PLAN_LABELS[subscription.plan] || subscription.plan}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Statut</span>
                        {(() => {
                          const b = SUB_STATUT_BADGES[subscription.statut] || { label: subscription.statut, cls: '' }
                          return <Badge variant="outline" className={cn('text-xs', b.cls)}>{b.label}</Badge>
                        })()}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Montant</span>
                        <span className="text-sm font-semibold">{formatFCFA(subscription.amount)} / mois</span>
                      </div>
                      {subscription.trialEndsAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Fin trial</span>
                          <span className="text-xs font-medium">{(() => {
                            try { return format(parseISO(subscription.trialEndsAt), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
                          })()}</span>
                        </div>
                      )}
                      {subscription.currentPeriodEnd && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Période fin</span>
                          <span className="text-xs font-medium">{(() => {
                            try { return format(parseISO(subscription.currentPeriodEnd), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
                          })()}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-border/60 space-y-1.5">
                        <QuotaRow icon={<UsersIcon className="w-3.5 h-3.5" />} label="Utilisateurs" value={subscription.maxUsers} />
                        <QuotaRow icon={<ClipboardList className="w-3.5 h-3.5" />} label="Chantiers" value={subscription.maxChantiers} />
                        <QuotaRow icon={<HardDrive className="w-3.5 h-3.5" />} label="Stockage" value={`${subscription.maxStorageMB} MB`} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── STATS GRID ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatBox
              icon={UsersIcon}
              label="Utilisateurs"
              value={Number(stats.users ?? 0)}
              accent="amber"
            />
            <StatBox
              icon={ClipboardList}
              label="Chantiers"
              value={Number(stats.chantiers ?? 0)}
              accent="orange"
            />
            <StatBox
              icon={Receipt}
              label="Factures"
              value={Number(stats.factures ?? 0)}
              accent="amber"
            />
            <StatBox
              icon={HardDrive}
              label="Stockage (MB)"
              value={subscription?.maxStorageMB ?? '—'}
              accent="orange"
            />
          </div>

          {/* ── USERS TABLE ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-amber-500" />
                  Utilisateurs de l'entreprise
                </CardTitle>
                <CardDescription className="text-xs">
                  Visibles si vous avez un accès support actif sur ce tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {users.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">Aucun utilisateur visible.</p>
                    <p className="text-xs mt-1 flex items-center justify-center gap-1">
                      <Info className="w-3 h-3" />
                      Demandez un accès support pour visualiser les utilisateurs de cette entreprise.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSupportOpen(true)}
                      className="mt-3 gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Demander l'accès
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nom</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Email</TableHead>
                          <TableHead className="text-xs">Rôle</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Statut</TableHead>
                          <TableHead className="text-xs hidden lg:table-cell">Dernière connexion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence mode="popLayout">
                          {users.map((u, idx) => (
                            <motion.tr
                              key={u.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2, delay: idx * 0.02 }}
                              className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                            >
                              <TableCell className="py-2.5 text-sm font-medium">{u.name}</TableCell>
                              <TableCell className="py-2.5 text-xs hidden md:table-cell text-muted-foreground">{u.email}</TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={cn('text-[11px]', ROLE_BADGES[u.role] || '')}>
                                  {ROLE_LABELS[u.role] || u.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                {u.active ? (
                                  <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                                    Actif
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
                                    Inactif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                                {u.lastLoginAt ? (() => {
                                  try { return format(parseISO(u.lastLoginAt), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' }
                                })() : 'Jamais'}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* ── SUPPORT ACCESS DIALOG ──────────────────────────────── */}
      <SupportAccessDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        entrepriseId={entreprise?.id}
        entrepriseName={entreprise?.nom}
      />

      {/* ── EDIT DIALOG ────────────────────────────────────────── */}
      <EditEntrepriseDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entreprise={entreprise || null}
        onUpdated={() => load(true)}
      />

      {/* ── SUSPEND ALERT ──────────────────────────────────────── */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Suspendre {entreprise?.nom} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'entreprise sera suspendue. Les utilisateurs ne pourront plus se connecter.
              Cette action est réversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Suspendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function InfoRow({
  icon,
  label,
  value,
  full,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={cn('space-y-0.5', full && 'sm:col-span-2')}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <span className="text-amber-500">{icon}</span>
        {label}
      </p>
      <div className="text-sm text-foreground break-words">{value}</div>
    </div>
  )
}

function QuotaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-amber-500">{icon}</span>
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function StatBox({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  accent: 'amber' | 'orange'
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    orange: 'from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-900/40',
  }[accent]
  return (
    <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('shrink-0 rounded-lg p-2 border bg-gradient-to-br', accentClasses)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SupportAccessDialog({
  open,
  onOpenChange,
  entrepriseId,
  entrepriseName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entrepriseId?: string
  entrepriseName?: string
}) {
  const [raison, setRaison] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaison('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!entrepriseId) return
    if (raison.trim().length < 10) {
      toast.error('Veuillez détailler la raison (min. 10 caractères)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/admin/support-access/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrepriseId, raison: raison.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success(`Demande envoyée à ${entrepriseName}. En attente d'autorisation du Gérant.`)
      setRaison('')
      onOpenChange(false)
    } catch (e: any) {
      toast.error("Erreur lors de la demande d'accès", { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Demander accès support — {entrepriseName}
          </DialogTitle>
          <DialogDescription>
            Une demande sera envoyée au Gérant. Si autorisée, l'accès sera limité à 4 heures.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="raison">Raison de la demande *</Label>
            <Textarea
              id="raison"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Expliquez pourquoi vous avez besoin d'accéder aux données..."
              rows={4}
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground text-right">{raison.length}/500</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-300 flex gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>L'accès est limité à 4h. Toutes les actions effectuées seront enregistrées dans un journal d'audit.</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || raison.trim().length < 10}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditEntrepriseDialog({
  open,
  onOpenChange,
  entreprise,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entreprise: Entreprise | null
  onUpdated: () => void
}) {
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', email: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (entreprise && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        nom: entreprise.nom || '',
        adresse: entreprise.adresse || '',
        telephone: entreprise.telephone || '',
        email: entreprise.email || '',
      })
    }
  }, [entreprise, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entreprise) return
    if (!form.nom.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/admin/entreprises/${entreprise.id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(),
          adresse: form.adresse.trim() || undefined,
          telephone: form.telephone.trim() || undefined,
          email: form.email.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success('Entreprise mise à jour')
      onOpenChange(false)
      onUpdated()
    } catch (e: any) {
      toast.error('Erreur lors de la mise à jour', { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-500" />
            Éditer {entreprise?.nom}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nom">Nom *</Label>
            <Input id="edit-nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-adresse">Adresse</Label>
            <Input id="edit-adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tel">Téléphone</Label>
              <Input id="edit-tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
