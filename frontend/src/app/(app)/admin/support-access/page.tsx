'use client'

/**
 * Demandes d'accès support — SUPER_ADMIN.
 *
 * Tableau des demandes (toutes entreprises), avec badge par statut
 * (DEMANDE/AUTORISE/REFUSE/EXPIRE/REVOQUE), nouvelle demande (dialog
 * select entreprise + raison), et révocabkation des accès actifs.
 *
 * Backend endpoints:
 *   GET    /api/v1/admin/support-access?statut=&entrepriseId=&superAdminId=
 *   POST   /api/v1/admin/support-access/request        — {entrepriseId, raison}
 *   POST   /api/v1/admin/support-access/{id}/revoke
 *   GET    /api/v1/admin/entreprises                    — for select
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
  Loader2,
  Filter,
  Ban,
  Eye,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

interface Entreprise {
  id: string
  nom: string
  status: string
}

interface ListResponse {
  data: SupportAccess[]
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

export default function AdminSupportAccessPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [requests, setRequests] = useState<SupportAccess[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [statutFilter, setStatutFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<SupportAccess | null>(null)
  const [logTarget, setLogTarget] = useState<SupportAccess | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({ pageSize: '200' })
      if (statutFilter !== 'all') params.set('statut', statutFilter)

      const [saRes, entRes] = await Promise.allSettled([
        fetch(`/api/v1/admin/support-access?${params.toString()}`, { credentials: 'same-origin' }),
        fetch('/api/v1/admin/entreprises?pageSize=200', { credentials: 'same-origin' }),
      ])

      if (saRes.status === 'fulfilled' && saRes.value.ok) {
        const d: ListResponse = await saRes.value.json()
        setRequests(d.data || [])
      }
      if (entRes.status === 'fulfilled' && entRes.value.ok) {
        const d: EntListResponse = await entRes.value.json()
        setEntreprises(d.data || [])
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statutFilter])

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') load()
  }, [userRole, load])

  const entById = useMemo(() => new Map(entreprises.map((e) => [e.id, e])), [entreprises])

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      const res = await fetch(`/api/v1/admin/support-access/${revokeTarget.id}/revoke`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur')
      toast.success('Accès révoqué')
      setRevokeTarget(null)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la révocation', { description: e?.message })
    }
  }

  // Stats derived
  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.statut === 'DEMANDE').length
    const active = requests.filter((r) => r.statut === 'AUTORISE').length
    const refused = requests.filter((r) => r.statut === 'REFUSE').length
    const expired = requests.filter((r) => r.statut === 'EXPIRE').length
    const revoked = requests.filter((r) => r.statut === 'REVOQUE').length
    return { pending, active, refused, expired, revoked, total: requests.length }
  }, [requests])

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
            Demandes d'accès support
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toutes les demandes d'accès temporaire aux données des entreprises.
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
            Nouvelle demande
          </Button>
        </div>
      </motion.div>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="En attente" value={stats.pending} accent="amber" icon={Clock} loading={loading} />
        <StatBox label="Actifs" value={stats.active} accent="emerald" icon={CheckCircle2} loading={loading} />
        <StatBox label="Refusés" value={stats.refused} accent="red" icon={XCircle} loading={loading} />
        <StatBox label="Expirés" value={stats.expired} accent="slate" icon={Clock} loading={loading} />
        <StatBox label="Révoqués" value={stats.revoked} accent="red" icon={Ban} loading={loading} />
      </div>

      {/* ── WARNING BANNER ─────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 backdrop-blur-xl p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">Accès temporaire limité à 4 heures.</p>
            <p className="text-xs mt-0.5 text-amber-700/80 dark:text-amber-400/80">
              Toutes les actions effectuées pendant un accès support sont enregistrées dans un journal d'audit traçable.
              Le Gérant de l'entreprise doit autoriser explicitement chaque demande.
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-56 bg-white/70 backdrop-blur-xl border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="DEMANDE">En attente</SelectItem>
            <SelectItem value="AUTORISE">Autorisé</SelectItem>
            <SelectItem value="REFUSE">Refusé</SelectItem>
            <SelectItem value="EXPIRE">Expiré</SelectItem>
            <SelectItem value="REVOQUE">Révoqué</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {stats.total} demande(s) au total
        </p>
      </div>

      {/* ── TABLE ──────────────────────────────────────────────── */}
      <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-40" />
              Aucune demande d'accès support.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entreprise</TableHead>
                    <TableHead className="text-xs">Raison</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Demandée</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Autorisée</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Expire</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {requests.map((sa, idx) => {
                      const ent = entById.get(sa.entrepriseId)
                      const badge = STATUT_BADGES[sa.statut] || { label: sa.statut, cls: '', icon: AlertTriangle }
                      const SIcon = badge.icon
                      const canRevoke = sa.statut === 'AUTORISE'
                      return (
                        <motion.tr
                          key={sa.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[140px]">
                                  {ent?.nom || `Entreprise ${sa.entrepriseId.slice(-6)}`}
                                </p>
                                <Link
                                  href={`/admin/entreprises/${sa.entrepriseId}`}
                                  className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline"
                                >
                                  Voir l'entreprise →
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 max-w-[280px]">
                            <p className="text-xs text-foreground/80 line-clamp-2">{sa.raison}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn('text-[11px] gap-1', badge.cls)}>
                              <SIcon className="w-3 h-3" />
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 hidden md:table-cell text-xs text-muted-foreground">
                            <p>{(() => { try { return format(parseISO(sa.demandeLe), 'dd MMM yyyy', { locale: fr }) } catch { return '—' } })()}</p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {(() => { try { return formatDistanceToNow(parseISO(sa.demandeLe), { addSuffix: true, locale: fr }) } catch { return '' } })()}
                            </p>
                          </TableCell>
                          <TableCell className="py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {sa.autoriseLe ? (() => { try { return format(parseISO(sa.autoriseLe), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' } })() : '—'}
                          </TableCell>
                          <TableCell className="py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {sa.expireLe ? (() => { try { return format(parseISO(sa.expireLe), 'dd MMM yyyy HH:mm', { locale: fr }) } catch { return '—' } })() : '—'}
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
                                  onClick={() => setLogTarget(sa)}
                                  className="cursor-pointer"
                                >
                                  <FileText className="w-4 h-4 mr-2" /> Voir le log
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/entreprises/${sa.entrepriseId}`} className="cursor-pointer">
                                    <Eye className="w-4 h-4 mr-2" /> Voir entreprise
                                  </Link>
                                </DropdownMenuItem>
                                {canRevoke && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setRevokeTarget(sa)}
                                      className="cursor-pointer text-red-700 focus:text-red-700"
                                    >
                                      <Ban className="w-4 h-4 mr-2" /> Révoquer l'accès
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

      {/* ── CREATE DIALOG ──────────────────────────────────────── */}
      <CreateRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entreprises={entreprises}
        onCreated={() => {
          setCreateOpen(false)
          load(true)
        }}
      />

      {/* ── REVOKE ALERT ───────────────────────────────────────── */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Révoquer cet accès ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'accès support sera immédiatement révoqué. Le SUPER_ADMIN perdra l'accès
              aux données de l'entreprise <strong>{entById.get(revokeTarget?.entrepriseId || '')?.nom || ''}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Révoquer
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
              Journal d'audit
            </DialogTitle>
            <DialogDescription>
              Demande pour <strong>{entById.get(logTarget?.entrepriseId || '')?.nom || 'entreprise'}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Raison</p>
              <p className="text-sm">{logTarget?.raison}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <LogRow label="Demandée le" value={logTarget?.demandeLe} />
              <LogRow label="Statut" value={logTarget?.statut} />
              <LogRow label="Autorisée le" value={logTarget?.autoriseLe} />
              <LogRow label="Expire le" value={logTarget?.expireLe} />
              <LogRow label="Révoquée le" value={logTarget?.revoqueLe} />
              <LogRow label="Demandeur ID" value={logTarget?.superAdminId} />
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
  accent: 'amber' | 'emerald' | 'red' | 'slate'
  icon: React.ElementType
  loading: boolean
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
    red: 'from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-900/40',
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

function CreateRequestDialog({
  open,
  onOpenChange,
  entreprises,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entreprises: Entreprise[]
  onCreated: () => void
}) {
  const [entrepriseId, setEntrepriseId] = useState('')
  const [raison, setRaison] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setEntrepriseId('')
      setRaison('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!entrepriseId) {
      toast.error('Veuillez sélectionner une entreprise')
      return
    }
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
      toast.success('Demande envoyée. En attente d’autorisation du Gérant.')
      onCreated()
    } catch (e: any) {
      toast.error("Erreur lors de l'envoi de la demande", { description: e?.message })
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
            Nouvelle demande d'accès support
          </DialogTitle>
          <DialogDescription>
            Demande un accès temporaire (max 4h) aux données d'une entreprise.
            Le Gérant devra autoriser explicitement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Entreprise *</Label>
            <Select value={entrepriseId} onValueChange={setEntrepriseId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez une entreprise" />
              </SelectTrigger>
              <SelectContent>
                {entreprises.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    Aucune entreprise disponible.
                  </div>
                ) : (
                  entreprises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom} {e.status === 'suspended' ? '(suspendue)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="raison">Raison *</Label>
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
            <span>L'accès est limité à 4h. Toutes les actions seront enregistrées.</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !entrepriseId || raison.trim().length < 10}
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
