'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  Handshake,
  AlertTriangle,
  CheckCircle2,
  Warehouse,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/store/app-store'

// ─── Types ───────────────────────────────────────────────────────────
interface Chantier {
  id: string
  nom: string
  statut: string
}

interface BudgetData {
  budgetPrevisionnel: number
  coutPersonnel: number
  coutMateriaux: number
  coutSousTraitants: number
  coutTotal: number
  ecart: number
  ecartPourcentage: number
  niveauAlerte: 'OK' | 'ATTENTION' | 'CRITIQUE'
  historique: { mois: string; cout: number }[]
  repartition: {
    categorie: string
    reel: number
    pourcentage: number
  }[]
}

// ─── Formatting helpers ──────────────────────────────────────────────
const moneyFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function fmtMoney(n: number) {
  return moneyFmt.format(Math.round(n)) + ' FCFA'
}

function fmtShort(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' Md'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' K'
  return String(Math.round(n))
}

function fmtPercent(n: number) {
  return n.toFixed(1) + '%'
}

// ─── Custom tooltip for charts ───────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{fmtMoney(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom progress bar with color ──────────────────────────────────
function ColoredProgress({
  value,
  colorClass,
  className = '',
}: {
  value: number
  colorClass: string
  className?: string
}) {
  const pct = Math.min(value, 100)
  return (
    <div
      className={`relative h-3 w-full overflow-hidden rounded-full bg-primary/20 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Progress bar color ──────────────────────────────────────────────
function getBarColor(pct: number) {
  if (pct < 60) return 'bg-emerald-500'
  if (pct < 80) return 'bg-amber-500'
  return 'bg-red-500'
}

// ─── Alert level badge ───────────────────────────────────────────────
function AlertBadge({ niveau }: { niveau: string }) {
  const config: Record<string, {
    className: string
    icon: typeof CheckCircle2
    label: string
  }> = {
    OK: {
      className:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      icon: CheckCircle2,
      label: 'OK',
    },
    ATTENTION: {
      className:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      icon: AlertTriangle,
      label: 'ATTENTION',
    },
    CRITIQUE: {
      className:
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
      icon: AlertTriangle,
      label: 'CRITIQUE',
    },
  }

  const cfg = config[niveau] || {
    className: 'bg-slate-100 text-slate-800',
    icon: CheckCircle2,
    label: niveau,
  }

  const Icon = cfg.icon

  return (
    <Badge
      variant="outline"
      className={`${cfg.className} px-3 py-1 text-sm font-semibold gap-1.5`}
    >
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </Badge>
  )
}

// ─── Component ───────────────────────────────────────────────────────
export function BudgetView() {
  const { selectedChantierId } = useAppStore()

  // State
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [activeChantierId, setActiveChantierId] = useState<string>('')
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(false)

  // ─── Fetch chantiers ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchChantiers() {
      try {
        const res = await fetch('/api/chantiers')
        if (res.ok) {
          const data = await res.json()
          setChantiers(data.chantiers || [])
        }
      } catch {
        // silent
      }
    }
    fetchChantiers()
  }, [])

  // Auto-select from global store
  useEffect(() => {
    if (selectedChantierId && !activeChantierId) {
      setActiveChantierId(selectedChantierId)
    }
  }, [selectedChantierId, activeChantierId])

  // ─── Fetch budget data ─────────────────────────────────────────────
  const fetchBudget = useCallback(async () => {
    if (!activeChantierId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/budget/${activeChantierId}`)
      if (res.ok) {
        const data = await res.json()
        setBudget(data)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors du chargement du budget')
        setBudget(null)
      }
    } catch {
      toast.error('Erreur lors du chargement du budget')
      setBudget(null)
    } finally {
      setLoading(false)
    }
  }, [activeChantierId])

  useEffect(() => {
    fetchBudget()
  }, [fetchBudget])

  // ─── Chart data: comparison ────────────────────────────────────────
  const comparisonData = budget
    ? [
        {
          categorie: 'Personnel',
          Prévisionnel: budget.budgetPrevisionnel * 0.4,
          Réel: budget.coutPersonnel,
        },
        {
          categorie: 'Matériaux',
          Prévisionnel: budget.budgetPrevisionnel * 0.35,
          Réel: budget.coutMateriaux,
        },
        {
          categorie: 'Sous-traitants',
          Prévisionnel: budget.budgetPrevisionnel * 0.25,
          Réel: budget.coutSousTraitants,
        },
        {
          categorie: 'Total',
          Prévisionnel: budget.budgetPrevisionnel,
          Réel: budget.coutTotal,
        },
      ]
    : []

  // ─── Chart data: historical ────────────────────────────────────────
  const historicalData = budget
    ? budget.historique.map((h) => ({
        mois: h.mois,
        dépenses: h.cout,
        budget: budget.budgetPrevisionnel,
      }))
    : []

  // ─── Breakdown cards ───────────────────────────────────────────────
  const breakdownCards = budget
    ? [
        {
          label: 'Personnel',
          value: budget.coutPersonnel,
          percentage:
            budget.coutTotal > 0
              ? (budget.coutPersonnel / budget.coutTotal) * 100
              : 0,
          icon: Users,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          barColor: 'bg-blue-500',
        },
        {
          label: 'Matériaux',
          value: budget.coutMateriaux,
          percentage:
            budget.coutTotal > 0
              ? (budget.coutMateriaux / budget.coutTotal) * 100
              : 0,
          icon: Package,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          barColor: 'bg-amber-500',
        },
        {
          label: 'Sous-traitants',
          value: budget.coutSousTraitants,
          percentage:
            budget.coutTotal > 0
              ? (budget.coutSousTraitants / budget.coutTotal) * 100
              : 0,
          icon: Handshake,
          color: 'text-violet-600 dark:text-violet-400',
          bgColor: 'bg-violet-100 dark:bg-violet-900/30',
          barColor: 'bg-violet-500',
        },
      ]
    : []

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PieChartIcon className="w-6 h-6 text-amber-500" />
            Suivi Budgétaire
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyse des coûts et suivi du budget par chantier
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBudget}
          disabled={!activeChantierId || loading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
          />
          Actualiser
        </Button>
      </div>

      {/* Chantier selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Label className="text-sm font-medium whitespace-nowrap">
              <Warehouse className="w-4 h-4 inline mr-1.5 text-amber-500" />
              Chantier :
            </Label>
            <Select
              value={activeChantierId}
              onValueChange={(v) => {
                setActiveChantierId(v)
                setBudget(null)
              }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Sélectionner un chantier..." />
              </SelectTrigger>
              <SelectContent>
                {chantiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!activeChantierId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <PieChartIcon className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Sélectionnez un chantier pour voir le suivi budgétaire
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      ) : budget ? (
        <>
          {/* ─── Main Budget Card ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Budget Prévisionnel
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                      {fmtMoney(budget.budgetPrevisionnel)}
                    </p>
                  </div>
                  <AlertBadge niveau={budget.niveauAlerte} />
                </div>

                {/* Budget réel progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      Budget Réel (dépenses)
                    </p>
                    <p className="text-sm font-semibold">
                      {fmtMoney(budget.coutTotal)}
                    </p>
                  </div>
                  <ColoredProgress
                    value={budget.ecartPourcentage}
                    colorClass={getBarColor(budget.ecartPourcentage)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtPercent(budget.ecartPourcentage)} du budget consommé
                  </p>
                </div>

                <Separator className="my-4" />

                {/* Écart */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {budget.ecart >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">Écart restant</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-lg font-bold ${
                        budget.ecart >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {budget.ecart >= 0 ? '+' : ''}
                      {fmtMoney(budget.ecart)}
                    </span>
                    <span
                      className={`text-xs ml-2 ${
                        budget.ecart >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      ({fmtPercent(100 - budget.ecartPourcentage)} restant)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ─── Breakdown Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {breakdownCards.map((card, idx) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${card.bgColor}`}>
                        <card.icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.label}
                      </p>
                    </div>
                    <p className="text-xl font-bold">{fmtMoney(card.value)}</p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Part du total</span>
                        <span>{fmtPercent(card.percentage)}</span>
                      </div>
                      <ColoredProgress
                        value={card.percentage}
                        colorClass={card.barColor}
                        className="h-1.5"
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ─── Charts Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Comparison Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Prévisionnel vs Réel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={comparisonData}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="categorie"
                          tick={{ fontSize: 12 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tickFormatter={(v) => fmtShort(v)}
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          width={60}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar
                          dataKey="Prévisionnel"
                          fill="#d97706"
                          radius={[4, 4, 0, 0]}
                          barSize={28}
                        />
                        <Bar
                          dataKey="Réel"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                          barSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Historical Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Dépenses cumulées par mois
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historicalData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Aucune donnée historique
                      </p>
                    </div>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={historicalData}
                          margin={{
                            top: 5,
                            right: 20,
                            left: 10,
                            bottom: 5,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="colorDepenses"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#f59e0b"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#f59e0b"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis
                            dataKey="mois"
                            tick={{ fontSize: 11 }}
                            className="fill-muted-foreground"
                          />
                          <YAxis
                            tickFormatter={(v) => fmtShort(v)}
                            tick={{ fontSize: 11 }}
                            className="fill-muted-foreground"
                            width={60}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <ReferenceLine
                            y={budget.budgetPrevisionnel}
                            stroke="#dc2626"
                            strokeDasharray="6 3"
                            label={{
                              value: 'Budget',
                              position: 'right',
                              fontSize: 11,
                              fill: '#dc2626',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="dépenses"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorDepenses)"
                            name="Dépenses cumulées"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ─── Detailed Breakdown Table ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Tableau récapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Catégorie</TableHead>
                        <TableHead className="text-xs text-right">
                          Budget Prévu
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Dépensé (Réel)
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Écart
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          % Consommé
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budget.repartition.map((row) => {
                        const ecartVal =
                          budget.budgetPrevisionnel - row.reel
                        const pctConso =
                          budget.budgetPrevisionnel > 0
                            ? (row.reel / budget.budgetPrevisionnel) * 100
                            : 0
                        return (
                          <TableRow key={row.categorie}>
                            <TableCell className="text-sm font-medium">
                              {row.categorie === 'Personnel' && (
                                <Users className="w-4 h-4 inline mr-2 text-blue-600" />
                              )}
                              {row.categorie === 'Matériaux' && (
                                <Package className="w-4 h-4 inline mr-2 text-amber-600" />
                              )}
                              {row.categorie === 'Sous-traitants' && (
                                <Handshake className="w-4 h-4 inline mr-2 text-violet-600" />
                              )}
                              {row.categorie}
                            </TableCell>
                            <TableCell className="text-sm text-right text-muted-foreground">
                              —
                            </TableCell>
                            <TableCell className="text-sm text-right font-semibold">
                              {fmtMoney(row.reel)}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <span
                                className={
                                  ecartVal >= 0
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                                }
                              >
                                {ecartVal >= 0 ? '+' : ''}
                                {fmtMoney(ecartVal)}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <span
                                className={
                                  pctConso >= 80
                                    ? 'text-red-600 font-semibold'
                                    : pctConso >= 60
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                }
                              >
                                {fmtPercent(pctConso)}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="text-sm">Total</TableCell>
                        <TableCell className="text-sm text-right">
                          {fmtMoney(budget.budgetPrevisionnel)}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {fmtMoney(budget.coutTotal)}
                        </TableCell>
                        <TableCell
                          className={`text-sm text-right ${
                            budget.ecart >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {budget.ecart >= 0 ? '+' : ''}
                          {fmtMoney(budget.ecart)}
                        </TableCell>
                        <TableCell
                          className={`text-sm text-right ${
                            budget.ecartPourcentage >= 80
                              ? 'text-red-600'
                              : budget.ecartPourcentage >= 60
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        >
                          {fmtPercent(budget.ecartPourcentage)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <PieChartIcon className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Aucune donnée budgétaire disponible
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
