'use client'

/**
 * Accès Support — vue GERANT (et SUPER_ADMIN en lecture seule sur son entreprise).
 *
 * Liste les demandes d'accès support pour SON entreprise, avec actions:
 * - DEMANDE → Approuver / Refuser
 * - AUTORISE → Révoquer
 * - EXPIRE / REVOQUE / REFUSE → historique (read-only)
 *
 * Banner d'avertissement + section historique séparée.
 *
 * Backend endpoints:
 *   GET  /api/v1/support-access
 *   POST /api/v1/support-access/{id}/approve
 *   POST /api/v1/support-access/{id}/refuse
 *   POST /api/v1/support-access/{id}/revoke
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Ban,
  RefreshCw,
  Loader2,
  Clock,
  AlertTriangle,
  History,
  UserCircle,
  FileText,
  Info,
} from 'lucide-react'
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
  revoqueParId?: string | null
  actionsLog?: string | null
  createdAt: string
}

interface ListResponse {
  data: SupportAccess[]
  total: number
  page: number
  pageSize: number
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUT_BADGES: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  DEMANDE: { label: 'En attente', cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', icon: Clock },
  AUTORISE: { label: 'Autorisé', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle2 },
  REFUSE: { label: 'Refusé', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
  EXPIRE: { label: 'Expiré', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700', icon: Clock },
  REVOQUE: { label: 'Révoqué', cls: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: Ban },
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AccesSupportPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [requests, setRequests] = useState<SupportAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ sa: SupportAccess; action: 'approve' | 'refuse' | 'revoke' } | null>(null)
  const [logTarget, setLogTarget] = useState<SupportAccess | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const res = await fetch('/api/v1/support-access?pageSize=100', { credentials: 'same-origin' })
      if (res.ok) {
        const d: ListResponse = await res.json()
        setRequests(d.data || [])
      } else {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (userRole && userRole !== 'SOUS_TRAITANT' && userRole !== 'EMPLOYE') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load()
    }
  }, [userRole, load])

  const handleAction = async () => {
    if (!actionTarget) return
    const { sa, action } = actionTarget
    try {
      const res = await fetch(`/api/v1/support-access/${sa.id}/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      const labels: Record<string, string> = {
        approve: 'Demande approuvée — accès accordé pour 4h',
        refuse: 'Demande refusée',
        revoke: 'Accès révoqué',
      }
      toast.success(labels[action])
      setActionTarget(null)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de l’action', { description: e?.message })
    }
  }

  // Split pending vs history
  const { pending, active, history } = useMemo(() => {
    const pending = requests.filter((r) => r.statut === 'DEMANDE')
    const active = requests.filter((r) => r.statut === 'AUTORISE')
    const history = requests.filter((r) => ['REFUSE', 'EXPIRE', 'REVOQUE'].includes(r.statut))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return { pending, active, history }
  }, [requests])

  // RBAC guard
  if (userRole && (userRole === 'SOUS_TRAITANT' || userRole === 'EMPLOYE')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <p className="text-lg font-semibold">Accès restreint</p>
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux Gérants et Super Administrateurs.
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
            Accès Support
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Autorisez et contrôlez les accès temporaires du support technique à votre entreprise.
          </p>
        </div>
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
      </motion.div>

      {/* ── WARNING BANNER ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 backdrop-blur-xl p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              L'accès est limité à 4 heures.
            </p>
            <p className="text-xs mt-1 text-amber-800/80 dark:text-amber-300/80">
              Toutes les actions effectuées par le support pendant la période d'accès sont enregistrées
              dans un journal d'audit (consultable sur cette page). Vous pouvez révoquer l'accès à tout moment.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="En attente" value={pending.length} accent="amber" icon={Clock} loading={loading} />
        <StatBox label="Actifs" value={active.length} accent="emerald" icon={CheckCircle2} loading={loading} />
        <StatBox label="Historique" value={history.length} accent="slate" icon={History} loading={loading} />
      </div>

      {/* ── ACTIVE ACCESS HIGHLIGHT (if any) ─────────────────── */}
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-emerald-200 bg-emerald-50/50 backdrop-blur-xl dark:border-emerald-900/50 dark:bg-emerald-900/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                Accès actifs ({active.length})
              </CardTitle>
              <CardDescription className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                Le support a actuellement accès à votre entreprise. Révoquez l'accès si nécessaire.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {active.map((sa) => {
                const remaining = sa.expireLe ? (() => {
                  try {
                    const end = parseISO(sa.expireLe)
                    if (isAfter(end, new Date())) {
                      return formatDistanceToNow(end, { addSuffix: false, locale: fr })
                    }
                    return 'expiré'
                  } catch { return '—' }
                })() : '—'
                return (
                  <div
                    key={sa.id}
                    className="rounded-lg border border-emerald-200 bg-white/70 dark:bg-slate-900/40 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sa.raison}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Expire dans <strong className="text-emerald-700 dark:text-emerald-400">{remaining}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLogTarget(sa)}>
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActionTarget({ sa, action: 'revoke' })}
                        className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Révoquer
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── PENDING TABLE ─────────────────────────────────────── */}
      <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Demandes en attente
          </CardTitle>
          <CardDescription className="text-xs">
            Décidez d'approuver ou de refuser chaque demande.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
              Aucune demande en attente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Demandé par</TableHead>
                    <TableHead className="text-xs">Raison</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Demandée le</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {pending.map((sa, idx) => (
                      <motion.tr
                        key={sa.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.04 }}
                        className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/15 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
                              <UserCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">Support N°{sa.superAdminId.slice(-6)}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{sa.superAdminId}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 max-w-[300px]">
                          <p className="text-xs text-foreground/80 line-clamp-2">{sa.raison}</p>
                        </TableCell>
                        <TableCell className="py-3 hidden md:table-cell text-xs text-muted-foreground">
                          <p>{(() => { try { return format(parseISO(sa.demandeLe), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' } })()}</p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {(() => { try { return formatDistanceToNow(parseISO(sa.demandeLe), { addSuffix: true, locale: fr }) } catch { return '' } })()}
                          </p>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLogTarget(sa)}
                              className="h-8 w-8 p-0"
                              title="Voir détails"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setActionTarget({ sa, action: 'approve' })}
                              className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActionTarget({ sa, action: 'refuse' })}
                              className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Refuser
                            </Button>
                          </div>
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

      {/* ── HISTORY ────────────────────────────────────────────── */}
      <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Historique
          </CardTitle>
          <CardDescription className="text-xs">
            Demandes refusées, expirées ou révoquées (lecture seule).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Aucun historique.
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Demandé par</TableHead>
                      <TableHead className="text-xs">Raison</TableHead>
                      <TableHead className="text-xs">Statut</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Demandée</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Expire/Revoquée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((sa) => {
                      const badge = STATUT_BADGES[sa.statut] || { label: sa.statut, cls: '', icon: AlertTriangle }
                      const SIcon = badge.icon
                      return (
                        <TableRow key={sa.id} className="hover:bg-muted/30">
                          <TableCell className="py-2.5">
                            <p className="text-xs font-medium">Support N°{sa.superAdminId.slice(-6)}</p>
                          </TableCell>
                          <TableCell className="py-2.5 max-w-[280px]">
                            <p className="text-xs text-muted-foreground line-clamp-2">{sa.raison}</p>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className={cn('text-[11px] gap-1', badge.cls)}>
                              <SIcon className="w-3 h-3" />
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                            {(() => { try { return format(parseISO(sa.demandeLe), 'dd MMM yyyy', { locale: fr }) } catch { return '—' } })()}
                          </TableCell>
                          <TableCell className="py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                            {sa.revoqueLe
                              ? (() => { try { return format(parseISO(sa.revoqueLe), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' } })()
                              : sa.expireLe
                              ? (() => { try { return format(parseISO(sa.expireLe), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' } })()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── CONFIRM DIALOG ─────────────────────────────────────── */}
      <AlertDialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionTarget?.action === 'approve' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {actionTarget?.action === 'refuse' && <XCircle className="w-5 h-5 text-red-500" />}
              {actionTarget?.action === 'revoke' && <Ban className="w-5 h-5 text-red-500" />}
              {actionTarget?.action === 'approve' && 'Approuver la demande'}
              {actionTarget?.action === 'refuse' && 'Refuser la demande'}
              {actionTarget?.action === 'revoke' && 'Révoquer cet accès'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.action === 'approve' && (
                <>
                  L'accès sera accordé pour <strong>4 heures maximum</strong>. Toutes les actions
                  du support seront enregistrées. Vous pourrez révoquer l'accès à tout moment.
                </>
              )}
              {actionTarget?.action === 'refuse' && (
                <>La demande sera marquée comme refusée. Le support ne pourra pas accéder à votre entreprise.</>
              )}
              {actionTarget?.action === 'revoke' && (
                <>L'accès sera immédiatement révoqué. Le support perdra l'accès à votre entreprise instantanément.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={cn(
                actionTarget?.action === 'approve'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              )}
            >
              {actionTarget?.action === 'approve' && 'Approuver'}
              {actionTarget?.action === 'refuse' && 'Refuser'}
              {actionTarget?.action === 'revoke' && 'Révoquer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── LOG DIALOG ─────────────────────────────────────────── */}
      <Dialog open={!!logTarget} onOpenChange={(o) => !o && setLogTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Détails de la demande
            </DialogTitle>
            <DialogDescription>
              Demandé par le support N°{logTarget?.superAdminId.slice(-6)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Raison</p>
              <p className="text-sm">{logTarget?.raison}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <LogRow label="Statut" value={logTarget?.statut} />
              <LogRow label="Demandée le" value={logTarget?.demandeLe} />
              <LogRow label="Autorisée le" value={logTarget?.autoriseLe} />
              <LogRow label="Expire le" value={logTarget?.expireLe} />
              <LogRow label="Révoquée le" value={logTarget?.revoqueLe} />
              <LogRow label="Demandeur" value={logTarget?.superAdminId} />
            </div>
            {logTarget?.actionsLog ? (
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 p-3">
                <p className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400 mb-1">Actions enregistrées</p>
                <ScrollArea className="h-32">
                  <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono">
                    {logTarget.actionsLog}
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-3 italic">
                Aucune action enregistrée pour cette demande.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatBox({
  label,
  value,
  accent,
  icon: Icon,
  loading,
}: {
  label: string
  value: number
  accent: 'amber' | 'emerald' | 'slate'
  icon: React.ElementType
  loading: boolean
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
    slate: 'from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40',
  }[accent]
  return (
    <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
      <CardContent className="p-3 flex items-center gap-2">
        <div className={cn('shrink-0 rounded-lg p-1.5 border bg-gradient-to-br', accentClasses)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          {loading ? <Skeleton className="h-4 w-6 mt-0.5" /> : <p className="text-base font-bold">{value}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function LogRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded border bg-muted/20 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground font-bold">{label}</p>
      <p className="text-xs font-mono break-all">
        {value ? (() => {
          try {
            return format(parseISO(value), 'dd MMM yyyy HH:mm', { locale: fr })
          } catch {
            return value
          }
        })() : '—'}
      </p>
    </div>
  )
}
