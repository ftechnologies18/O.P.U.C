'use client'

/**
 * Gestion des entreprises (tenants) — SUPER_ADMIN.
 *
 * Tableau paginé avec recherche, filtre par statut, dialog de création,
 * et actions par ligne (voir détail, suspendre/réactiver, demander support).
 *
 * Backend endpoints:
 *   GET    /api/v1/admin/entreprises?search=&status=&page=&pageSize=
 *   POST   /api/v1/admin/entreprises
 *   POST   /api/v1/admin/entreprises/{id}/suspend
 *   POST   /api/v1/admin/entreprises/{id}/reactivate
 *   POST   /api/v1/admin/support-access/request   (body: {entrepriseId, raison})
 *   GET    /api/v1/admin/subscriptions            (for plan lookup)
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Building2,
  Search,
  Filter,
  Plus,
  Eye,
  Ban,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Users as UsersIcon,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
}

interface ListResponse {
  data: Entreprise[]
  total: number
  page: number
  pageSize: number
}

interface SubsResponse {
  data: Subscription[]
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

const PAGE_SIZE = 10

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminEntreprisesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined

  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [planByEntreprise, setPlanByEntreprise] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [supportTarget, setSupportTarget] = useState<Entreprise | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const [entRes, subRes] = await Promise.allSettled([
        fetch(`/api/v1/admin/entreprises?${params.toString()}`, { credentials: 'same-origin' }),
        fetch('/api/v1/admin/subscriptions?pageSize=200', { credentials: 'same-origin' }),
      ])

      if (entRes.status === 'fulfilled' && entRes.value.ok) {
        const d: ListResponse = await entRes.value.json()
        setEntreprises(d.data || [])
        setTotal(d.total || 0)
      }
      if (subRes.status === 'fulfilled' && subRes.value.ok) {
        const d: SubsResponse = await subRes.value.json()
        const m = new Map<string, string>()
        for (const s of d.data || []) m.set(s.entrepriseId, s.plan)
        setPlanByEntreprise(m)
      }
    } catch (e: any) {
      toast.error('Erreur lors du chargement des entreprises', { description: e?.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load()
    }
  }, [userRole, load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (page !== 1) setPage(1)
      else load()
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [page, statusFilter])

  const handleSuspend = async (e: Entreprise) => {
    try {
      const res = await fetch(`/api/v1/admin/entreprises/${e.id}/suspend`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Erreur')
      }
      toast.success(`${e.nom} a été suspendue`)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la suspension', { description: e?.message })
    }
  }

  const handleReactivate = async (e: Entreprise) => {
    try {
      const res = await fetch(`/api/v1/admin/entreprises/${e.id}/reactivate`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Erreur')
      }
      toast.success(`${e.nom} a été réactivée`)
      load(true)
    } catch (e: any) {
      toast.error('Erreur lors de la réactivation', { description: e?.message })
    }
  }

  // Stats derived from current page + total
  const stats = useMemo(() => {
    const actives = entreprises.filter((e) => e.status === 'active').length
    const suspended = entreprises.filter((e) => e.status === 'suspended').length
    return { total, actives, suspended }
  }, [entreprises, total])

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
            Gestion des entreprises
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tenants SaaS — création, suspension et abonnements.
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
            Nouvelle entreprise
          </Button>
        </div>
      </motion.div>

      {/* ── STATS BAR ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total entreprises" value={stats.total} accent="amber" loading={loading} />
        <StatCard label="Actives" value={stats.actives} accent="emerald" loading={loading} />
        <StatCard label="Suspendues" value={stats.suspended} accent="red" loading={loading} />
      </div>

      {/* ── FILTERS ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/70 backdrop-blur-xl border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white/70 backdrop-blur-xl border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actives</SelectItem>
            <SelectItem value="suspended">Suspendues</SelectItem>
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
          ) : entreprises.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-40" />
              Aucune entreprise trouvée.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entreprise</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Contact</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Créée le</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
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
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate max-w-[200px]">{e.nom}</p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px] md:hidden">
                                  {e.email || '—'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 hidden md:table-cell">
                            <div className="text-xs space-y-0.5">
                              {e.email && (
                                <p className="flex items-center gap-1 text-muted-foreground truncate max-w-[180px]">
                                  <Mail className="w-3 h-3 shrink-0" /> {e.email}
                                </p>
                              )}
                              {e.telephone && (
                                <p className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="w-3 h-3 shrink-0" /> {e.telephone}
                                </p>
                              )}
                              {!e.email && !e.telephone && <span className="text-muted-foreground/60">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn('text-[11px]', PLAN_BADGES[plan])}>
                              {PLAN_LABELS[plan] || plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {(() => {
                              try { return format(parseISO(e.createdAt), 'dd MMM yyyy', { locale: fr }) } catch { return '—' }
                            })()}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                                <Link href={`/admin/entreprises/${e.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 px-2 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                                    <span className="text-xs">Plus</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/admin/entreprises/${e.id}`} className="cursor-pointer">
                                      <Eye className="w-4 h-4 mr-2" /> Voir détail
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setSupportTarget(e)}
                                    className="cursor-pointer"
                                  >
                                    <ShieldAlert className="w-4 h-4 mr-2" /> Demander accès support
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {isSuspended ? (
                                    <DropdownMenuItem
                                      onClick={() => handleReactivate(e)}
                                      className="cursor-pointer text-emerald-700 focus:text-emerald-700"
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-2" /> Réactiver
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleSuspend(e)}
                                      className="cursor-pointer text-amber-700 focus:text-amber-700"
                                    >
                                      <Ban className="w-4 h-4 mr-2" /> Suspendre
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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

      {/* ── PAGINATION ─────────────────────────────────────────── */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {page} sur {totalPages} — {total} entreprise(s) au total
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Préc
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="h-8 gap-1"
            >
              Suiv <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── CREATE DIALOG ──────────────────────────────────────── */}
      <CreateEntrepriseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false)
          load(true)
        }}
      />

      {/* ── SUPPORT ACCESS DIALOG ──────────────────────────────── */}
      <SupportAccessDialog
        entreprise={supportTarget}
        onOpenChange={(open) => !open && setSupportTarget(null)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string
  value: number
  accent: 'amber' | 'emerald' | 'red'
  loading: boolean
}) {
  const accentClasses = {
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
    red: 'from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-900/40',
  }[accent]
  return (
    <Card className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-sm dark:bg-slate-900/50 dark:border-slate-800/60">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          {loading ? (
            <Skeleton className="h-6 w-12 mt-1" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{value}</p>
          )}
        </div>
        <div className={cn('shrink-0 rounded-lg p-2 border bg-gradient-to-br', accentClasses)}>
          <Building2 className="w-4 h-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function CreateEntrepriseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', email: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/admin/entreprises', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(),
          adresse: form.adresse.trim() || undefined,
          telephone: form.telephone.trim() || undefined,
          email: form.email.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Erreur')
      }
      toast.success('Entreprise créée avec succès')
      setForm({ nom: '', adresse: '', telephone: '', email: '' })
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
            Nouvelle entreprise
          </DialogTitle>
          <DialogDescription>
            Créez un nouveau tenant sur la plateforme SaaS.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Ex: BTP Construction SARL"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              placeholder="Ex: Cocody, Abidjan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                placeholder="+225 07 00 00 00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@btp.ci"
              />
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
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SupportAccessDialog({
  entreprise,
  onOpenChange,
}: {
  entreprise: Entreprise | null
  onOpenChange: (open: boolean) => void
}) {
  const [raison, setRaison] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (entreprise) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaison('')
    }
  }, [entreprise])

  const handleSubmit = async () => {
    if (!entreprise) return
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
        body: JSON.stringify({
          entrepriseId: entreprise.id,
          raison: raison.trim(),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Erreur')
      }
      toast.success(`Demande d'accès envoyée à ${entreprise.nom}. En attente d'autorisation du Gérant.`)
      setRaison('')
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (e: any) {
      toast.error("Erreur lors de la demande d'accès", { description: e?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={!!entreprise} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Demander accès support — {entreprise?.nom}
            </DialogTitle>
            <DialogDescription>
              Une demande sera envoyée au Gérant de l'entreprise. Si autorisée, l'accès sera limité à 4 heures.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="raison">Raison de la demande *</Label>
              <Textarea
                id="raison"
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="Expliquez pourquoi vous avez besoin d'accéder aux données de cette entreprise..."
                rows={4}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground text-right">{raison.length}/500</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-300">
              ⚠ Toutes les actions effectuées pendant l'accès seront enregistrées dans un journal d'audit.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting || raison.trim().length < 10}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <ShieldAlert className="w-4 h-4" />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la demande d'accès</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez demander un accès temporaire (max 4h) aux données de <strong>{entreprise?.nom}</strong>.
              Le Gérant devra autoriser explicitement cette demande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
