'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import {
  format,
  parseISO,
  isValid,
  differenceInDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachMonthOfInterval,
  min,
  max,
  subMonths,
  addDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  GanttChart,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronRight,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Loader2,
  Building2,
  ExternalLink,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'

// ─── Types ────────────────────────────────────────────────

interface Tache {
  id: string
  nom: string
  description?: string | null
  ordre: number
  avancement: number
  statut: string
  dateDebut?: string | null
  dateFin?: string | null
  responsableId?: string | null
  responsable?: { id: string; name: string } | null
}

interface Phase {
  id: string
  nom: string
  ordre: number
  description?: string | null
  avancement: number
  dateDebut?: string | null
  dateFin?: string | null
  taches: Tache[]
}

interface Chantier {
  id: string
  nom: string
  statut: string
  phases: Phase[]
}

interface ChantierOption {
  id: string
  nom: string
  statut: string
  _count: { phases: number }
}

type GanttRowType = 'chantier' | 'phase' | 'task'

interface GanttRow {
  type: GanttRowType
  id: string
  chantier?: Chantier
  phase?: Phase
  task?: Tache
}

interface DetailDialogData {
  type: GanttRowType
  data: Chantier | Phase | Tache
  chantierId?: string
  phase?: Phase
}

// ─── Constants ────────────────────────────────────────────

const STATUT_COLORS: Record<string, { bg: string; border: string; text: string; bar: string; barLight: string }> = {
  PLANIFIEE: {
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-600',
    bar: 'bg-slate-400',
    barLight: 'bg-slate-300',
  },
  EN_COURS: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    text: 'text-amber-700',
    bar: 'bg-amber-500',
    barLight: 'bg-amber-200',
  },
  TERMINEE: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    barLight: 'bg-emerald-200',
  },
  EN_RETARD: {
    bg: 'bg-red-100',
    border: 'border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-500',
    barLight: 'bg-red-200',
  },
}

const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  EN_RETARD: 'En retard',
}

const CHANTIER_ROW_HEIGHT = 44
const PHASE_ROW_HEIGHT = 38
const TASK_ROW_HEIGHT = 34
const TIMELINE_HEADER_HEIGHT = 48
const LEFT_COL_WIDTH = 300

// ─── Helpers ──────────────────────────────────────────────

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try {
    const parsed = parseISO(d)
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy', { locale: fr }) : '—'
  } catch {
    return '—'
  }
}

const fmtDateShort = (d: Date) => format(d, 'dd MMM', { locale: fr })

const safeParse = (d?: string | null): Date | null => {
  if (!d) return null
  try {
    const p = parseISO(d)
    return isValid(p) ? p : null
  } catch {
    return null
  }
}

const getRowHeight = (type: GanttRowType) => {
  switch (type) {
    case 'chantier': return CHANTIER_ROW_HEIGHT
    case 'phase': return PHASE_ROW_HEIGHT
    case 'task': return TASK_ROW_HEIGHT
  }
}

const getBarHexColor = (statut: string): string => {
  switch (statut) {
    case 'EN_COURS': return '#f59e0b'
    case 'TERMINEE': return '#10b981'
    case 'EN_RETARD': return '#ef4444'
    default: return '#94a3b8'
  }
}

// ─── Sub-components ───────────────────────────────────────

function EmptyState({ hasData }: { hasData: boolean }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
          <GanttChart className="w-10 h-10 text-amber-500" />
        </div>
        <h3 className="text-[17px] font-semibold text-foreground mb-1">
          {hasData ? 'Aucune phase planifiée' : 'Aucun chantier'}
        </h3>
        <p className="text-[15px] text-muted-foreground text-center max-w-sm">
          {hasData
            ? 'Aucun chantier ne comporte de phases. Ajoutez des phases et tâches depuis la vue détail du chantier.'
            : 'Commencez par créer des chantiers avec des phases pour voir le planning apparaître ici.'}
        </p>
      </CardContent>
    </Card>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-medium text-muted-foreground">Légende :</span>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-5 rounded-sm bg-gradient-to-r from-amber-400 to-amber-200" />
        <span className="text-muted-foreground">Phase</span>
      </div>
      {Object.entries(STATUT_LABELS).map(([key, label]) => {
        const colors = STATUT_COLORS[key]
        return (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-3 w-5 rounded-sm ${colors.bar}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        )
      })}
      <Separator orientation="vertical" className="h-3 mx-1" />
      <div className="flex items-center gap-1.5">
        <div className="h-0 w-5 border-t-2 border-dashed border-red-500" />
        <span className="text-muted-foreground">Aujourd&apos;hui</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────

export function PlanningView() {
  const { setCurrentView, setSelectedChantierId: setAppChantierId } = useAppStore()

  // Data
  const [chantierOptions, setChantierOptions] = useState<ChantierOption[]>([])
  const [allChantiers, setAllChantiers] = useState<Chantier[]>([])
  const [loadingChantiers, setLoadingChantiers] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // UI state
  const [filterChantierId, setFilterChantierId] = useState<string>('all')
  const [zoom, setZoom] = useState<'month' | 'week'>('month')
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<DetailDialogData | null>(null)

  // Refs
  const timelineBodyRef = useRef<HTMLDivElement>(null)
  const leftColBodyRef = useRef<HTMLDivElement>(null)

  // ─── Fetch chantiers list ───

  useEffect(() => {
    const fetchChantiers = async () => {
      try {
        const res = await fetch('/api/chantiers')
        if (res.ok) {
          const data = await res.json()
          const list: ChantierOption[] = data.chantiers || []
          setChantierOptions(list)

          // Fetch all chantier details in parallel
          if (list.length > 0) {
            setLoadingDetails(true)
            const results = await Promise.allSettled(
              list.map((c) => fetch(`/api/chantiers/${c.id}`).then((r) => r.ok ? r.json() : null))
            )
            const successful: Chantier[] = results
              .filter((r): r is PromiseFulfilledResult<Chantier> => r.status === 'fulfilled' && !!r.value)
              .map((r) => r.value)
            setAllChantiers(successful)
          }
        }
      } catch {
        toast.error('Erreur de chargement des chantiers')
      } finally {
        setLoadingChantiers(false)
        setLoadingDetails(false)
      }
    }
    fetchChantiers()
  }, [])

  // ─── Filtered chantiers ───

  const filteredChantiers = useMemo(() => {
    if (filterChantierId === 'all') return allChantiers
    return allChantiers.filter((c) => c.id === filterChantierId)
  }, [allChantiers, filterChantierId])

  // ─── Build rows ───

  const rows = useMemo(() => {
    const result: GanttRow[] = []
    filteredChantiers.forEach((chantier) => {
      result.push({ type: 'chantier', id: `ch-${chantier.id}`, chantier })
      if (!collapsedItems.has(`ch-${chantier.id}`)) {
        chantier.phases.forEach((phase) => {
          result.push({ type: 'phase', id: `ph-${phase.id}`, chantier, phase })
          if (!collapsedItems.has(`ph-${phase.id}`)) {
            phase.taches.forEach((task) => {
              result.push({ type: 'task', id: `tk-${task.id}`, chantier, phase, task })
            })
          }
        })
      }
    })
    return result
  }, [filteredChantiers, collapsedItems])

  // ─── Timeline range ───

  const timelineRange = useMemo(() => {
    const allDates: Date[] = []
    filteredChantiers.forEach((chantier) => {
      chantier.phases.forEach((phase) => {
        const dS = safeParse(phase.dateDebut)
        const dE = safeParse(phase.dateFin)
        if (dS) allDates.push(dS)
        if (dE) allDates.push(dE)
        phase.taches.forEach((t) => {
          const tS = safeParse(t.dateDebut)
          const tE = safeParse(t.dateFin)
          if (tS) allDates.push(tS)
          if (tE) allDates.push(tE)
        })
      })
    })

    if (allDates.length === 0) {
      // Default: today ± 3 months
      const now = new Date()
      return {
        start: startOfMonth(subMonths(now, 3)),
        end: endOfMonth(addMonths(now, 3)),
        totalDays: differenceInDays(endOfMonth(addMonths(now, 3)), startOfMonth(subMonths(now, 3))) + 1,
      }
    }

    const earliest = min(allDates)
    const latest = max(allDates)
    const rangeStart = startOfMonth(addMonths(earliest, -1))
    const rangeEnd = endOfMonth(addMonths(latest, 1))
    const totalDays = differenceInDays(rangeEnd, rangeStart) + 1

    return { start: rangeStart, end: rangeEnd, totalDays }
  }, [filteredChantiers])

  // ─── Time slots ───

  const timeSlots = useMemo(() => {
    if (!timelineRange) return []

    if (zoom === 'month') {
      const months = eachMonthOfInterval({
        start: timelineRange.start,
        end: timelineRange.end,
      })
      return months.map((m) => ({
        label: format(m, 'MMM yyyy', { locale: fr }),
        shortLabel: format(m, 'MMM', { locale: fr }),
        start: startOfMonth(m),
        end: endOfMonth(m),
        width:
          ((differenceInDays(endOfMonth(m), startOfMonth(m)) + 1) /
            timelineRange.totalDays) *
          100,
      }))
    } else {
      const weeks = eachWeekOfInterval(
        { start: timelineRange.start, end: timelineRange.end },
        { weekStartsOn: 1, locale: fr }
      )
      return weeks.map((w) => ({
        label: fmtDateShort(w),
        shortLabel: fmtDateShort(w),
        start: startOfWeek(w, { weekStartsOn: 1 }),
        end: endOfWeek(w, { weekStartsOn: 1 }),
        width: (7 / timelineRange.totalDays) * 100,
      }))
    }
  }, [timelineRange, zoom])

  // ─── Bar position helper ───

  const getBarStyle = (dateDebut?: string | null, dateFin?: string | null) => {
    if (!timelineRange || !dateDebut || !dateFin)
      return { left: 0, width: 0, visible: false }

    const dStart = safeParse(dateDebut)
    const dEnd = safeParse(dateFin)
    if (!dStart || !dEnd) return { left: 0, width: 0, visible: false }

    const startOffset = differenceInDays(dStart, timelineRange.start)
    const duration = differenceInDays(dEnd, dStart) + 1

    const left = (startOffset / timelineRange.totalDays) * 100
    const width = Math.max((duration / timelineRange.totalDays) * 100, 0.5)

    return { left, width, visible: true }
  }

  // ─── Today line ───

  const todayPosition = useMemo(() => {
    if (!timelineRange) return null
    const today = new Date()
    if (today < timelineRange.start || today > timelineRange.end) return null
    const offset = differenceInDays(today, timelineRange.start)
    return (offset / timelineRange.totalDays) * 100
  }, [timelineRange])

  // ─── Total rows height ───

  const totalHeight = useMemo(() => {
    return rows.reduce((acc, row) => acc + getRowHeight(row.type), 0)
  }, [rows])

  // ─── Row top position (memoized helper) ───

  const rowTopPositions = useMemo(() => {
    const positions: number[] = []
    let acc = 0
    for (const row of rows) {
      positions.push(acc)
      acc += getRowHeight(row.type)
    }
    return positions
  }, [rows])

  // ─── Stats ───

  const stats = useMemo(() => {
    let totalPhases = 0
    let totalTasks = 0
    let tasksEnCours = 0
    let tasksEnRetard = 0
    filteredChantiers.forEach((c) => {
      c.phases.forEach((p) => {
        totalPhases++
        p.taches.forEach((t) => {
          totalTasks++
          if (t.statut === 'EN_COURS') tasksEnCours++
          if (t.statut === 'EN_RETARD') tasksEnRetard++
        })
      })
    })
    return { totalPhases, totalTasks, tasksEnCours, tasksEnRetard }
  }, [filteredChantiers])

  // ─── Toggle collapse ───

  const toggleCollapse = (id: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Sync scroll ───

  const handleTimelineScroll = useCallback(() => {
    if (timelineBodyRef.current && leftColBodyRef.current) {
      leftColBodyRef.current.scrollTop = timelineBodyRef.current.scrollTop
    }
  }, [])

  const handleLeftColScroll = useCallback(() => {
    if (leftColBodyRef.current && timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = leftColBodyRef.current.scrollTop
    }
  }, [])

  // ─── Navigate to chantier detail ───

  const handleNavigateToChantier = (chantierId: string) => {
    setDetailData(null)
    setAppChantierId(chantierId)
    setCurrentView('chantier-detail')
  }

  // ─── Loading state ───

  if (loadingChantiers) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  const hasRows = rows.length > 0
  const hasData = allChantiers.some((c) => c.phases.length > 0)

  // ─── Render ───

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 border border-amber-200">
              <GanttChart className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Planning</h2>
              <p className="text-sm text-muted-foreground">
                Diagramme de Gantt consolidé de tous les chantiers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Legend />
          </div>
        </div>

        {/* ─── Controls ─── */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Chantier selector */}
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto min-w-0">
                <label className="text-sm font-medium text-muted-foreground shrink-0">
                  Chantier :
                </label>
                <Select
                  value={filterChantierId}
                  onValueChange={(val) => {
                    setFilterChantierId(val)
                    setCollapsedItems(new Set())
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Tous les chantiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="font-medium">Tous les chantiers</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({chantierOptions.length})
                      </span>
                    </SelectItem>
                    {chantierOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="truncate">{c.nom}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({c._count.phases} phase{c._count.phases !== 1 ? 's' : ''})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1.5 border rounded-lg p-1 shrink-0">
                <Button
                  variant={zoom === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs gap-1"
                  onClick={() => setZoom('month')}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  Mois
                </Button>
                <Button
                  variant={zoom === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs gap-1"
                  onClick={() => setZoom('week')}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  Semaines
                </Button>
              </div>

              {/* Loading indicator */}
              {loadingDetails && (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Gantt Chart ─── */}
        {!hasRows && !loadingDetails ? (
          <EmptyState hasData={hasData} />
        ) : (
          <Card className="border shadow-sm overflow-hidden">
            <div className="flex">
              {/* ─── Left column: Names ─── */}
              <div
                className="shrink-0 border-r bg-background/95 backdrop-blur-sm z-10"
                style={{ width: LEFT_COL_WIDTH }}
              >
                {/* Left header */}
                <div
                  className="flex items-center px-4 border-b bg-muted/50 font-semibold text-xs text-muted-foreground uppercase tracking-wide"
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                >
                  Chantier / Phase / Tâche
                </div>

                {/* Left body */}
                <div
                  ref={leftColBodyRef}
                  onScroll={handleLeftColScroll}
                  className="overflow-hidden"
                  style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}
                >
                  {rows.map((row, idx) => {
                    const h = getRowHeight(row.type)

                    // ── Chantier row ──
                    if (row.type === 'chantier' && row.chantier) {
                      const c = row.chantier
                      const isCollapsed = collapsedItems.has(row.id)
                      const sc = STATUT_COLORS[c.statut]
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 px-3 border-b bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                          style={{ height: h }}
                          onClick={() => toggleCollapse(row.id)}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-sm font-bold text-foreground truncate flex-1">
                            {c.nom}
                          </span>
                          {sc && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}
                            >
                              {STATUT_LABELS[c.statut] || c.statut}
                            </Badge>
                          )}
                        </div>
                      )
                    }

                    // ── Phase row ──
                    if (row.type === 'phase' && row.phase) {
                      const p = row.phase
                      const isCollapsed = collapsedItems.has(row.id)
                      const hasDates = !!(p.dateDebut && p.dateFin)
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 pl-8 pr-3 border-b bg-amber-50/40 cursor-pointer hover:bg-amber-50/70 transition-colors"
                          style={{ height: h }}
                          onClick={() => toggleCollapse(row.id)}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3 h-3 text-amber-600 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                          <span className="text-[13px] font-semibold text-foreground truncate flex-1">
                            {p.nom}
                          </span>
                          {!hasDates && (
                            <span className="text-[10px] text-muted-foreground italic shrink-0">
                              — no date
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                          >
                            {Math.round(p.avancement)}%
                          </Badge>
                        </div>
                      )
                    }

                    // ── Task row ──
                    if (row.type === 'task' && row.task) {
                      const t = row.task
                      const colors = STATUT_COLORS[t.statut] || STATUT_COLORS.PLANIFIEE
                      const hasDates = !!(t.dateDebut && t.dateFin)
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 pl-14 pr-3 border-b hover:bg-muted/30 transition-colors cursor-pointer"
                          style={{ height: h }}
                          onClick={() =>
                            setDetailData({
                              type: 'task',
                              data: t,
                              chantierId: row.chantier?.id,
                              phase: row.phase,
                            })
                          }
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${colors.bar}`} />
                          <span className="text-xs text-foreground truncate flex-1">
                            {t.nom}
                          </span>
                          {!hasDates && (
                            <span className="text-[10px] text-muted-foreground italic shrink-0">
                              — no date
                            </span>
                          )}
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              </div>

              {/* ─── Right: Timeline ─── */}
              <div className="flex-1 min-w-0 overflow-hidden">
                {/* Timeline header */}
                <div
                  className="flex border-b bg-muted/50"
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                >
                  {timeSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center border-r border-border/50 text-xs text-muted-foreground font-medium shrink-0 px-1"
                      style={{ width: `${slot.width}%` }}
                    >
                      {slot.width > 4 ? slot.label : ''}
                    </div>
                  ))}
                </div>

                {/* Timeline body */}
                <ScrollArea className="w-full">
                  <div
                    ref={timelineBodyRef}
                    onScroll={handleTimelineScroll}
                    className="relative"
                    style={{
                      minHeight: `${totalHeight}px`,
                      width: '100%',
                    }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 pointer-events-none">
                      {timeSlots.map((slot, i) => {
                        let leftAcc = 0
                        for (let j = 0; j < i; j++) leftAcc += timeSlots[j].width
                        return (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 border-r border-border/30"
                            style={{ left: `${leftAcc}%` }}
                          />
                        )
                      })}
                      {/* Horizontal row separators */}
                      {rows.map((row, idx) => {
                        return (
                          <div
                            key={`hline-${idx}`}
                            className="absolute left-0 right-0 border-b border-border/20"
                            style={{ top: `${rowTopPositions[idx] + getRowHeight(row.type)}px` }}
                          />
                        )
                      })}
                    </div>

                    {/* Today line */}
                    {todayPosition !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-0 pointer-events-none z-20"
                        style={{ left: `${todayPosition}%` }}
                      >
                        <div className="w-0 h-full border-l-2 border-dashed border-red-500" />
                      </div>
                    )}

                    {/* Bars */}
                    {rows.map((row, idx) => {
                      const top = rowTopPositions[idx]

                      // ── Chantier row: no bar ──
                      if (row.type === 'chantier') return null

                      // ── Phase row ──
                      if (row.type === 'phase' && row.phase) {
                        const phase = row.phase
                        const bar = getBarStyle(phase.dateDebut, phase.dateFin)
                        const isCollapsed = collapsedItems.has(row.id)
                        const displayHeight = isCollapsed ? 14 : 16
                        const barTop = top + (PHASE_ROW_HEIGHT - displayHeight) / 2

                        if (!bar.visible) {
                          // No bar for phase without dates
                          return null
                        }

                        return (
                          <Tooltip key={row.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded-md cursor-pointer group hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all"
                                style={{
                                  left: `${bar.left}%`,
                                  width: `${bar.width}%`,
                                  top: `${barTop}px`,
                                  height: `${displayHeight}px`,
                                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${phase.avancement}%, #fde68a ${phase.avancement}%, #fde68a 100%)`,
                                  minWidth: '4px',
                                }}
                                onClick={() =>
                                  setDetailData({
                                    type: 'phase',
                                    data: phase,
                                    chantierId: row.chantier?.id,
                                  })
                                }
                                onMouseEnter={() => setHoveredItem(row.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/20 to-black/10" />
                                {bar.width > 8 && (
                                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-amber-900 truncate px-1">
                                    {Math.round(phase.avancement)}%
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold text-xs">{phase.nom}</p>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {fmtDate(phase.dateDebut)} → {fmtDate(phase.dateFin)}
                                </div>
                                <div className="flex items-center gap-1 text-[11px]">
                                  <TrendingUp className="w-3 h-3" />
                                  Avancement : {Math.round(phase.avancement)}%
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {phase.taches.length} tâche{phase.taches.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      }

                      // ── Task row ──
                      if (row.type === 'task' && row.task) {
                        const task = row.task
                        const tBar = getBarStyle(task.dateDebut, task.dateFin)
                        const barHeight = 12
                        const barTop = top + (TASK_ROW_HEIGHT - barHeight) / 2

                        if (!tBar.visible) {
                          // Task without dates — show a dot marker
                          return (
                            <Tooltip key={row.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute w-2.5 h-2.5 rounded-full left-1 cursor-pointer"
                                  style={{
                                    top: `${top + (TASK_ROW_HEIGHT - 10) / 2}px`,
                                    backgroundColor: getBarHexColor(task.statut),
                                  }}
                                  onClick={() =>
                                    setDetailData({
                                      type: 'task',
                                      data: task,
                                      chantierId: row.chantier?.id,
                                      phase: row.phase,
                                    })
                                  }
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="space-y-1">
                                  <p className="font-semibold text-xs">{task.nom}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Sans date planifiée
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${STATUT_COLORS[task.statut]?.bg} ${STATUT_COLORS[task.statut]?.text} ${STATUT_COLORS[task.statut]?.border}`}
                                  >
                                    {STATUT_LABELS[task.statut] || task.statut}
                                  </Badge>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        }

                        const colors = STATUT_COLORS[task.statut] || STATUT_COLORS.PLANIFIEE

                        return (
                          <Tooltip key={row.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded cursor-pointer group hover:ring-2 hover:ring-offset-1 transition-all"
                                style={{
                                  left: `${tBar.left}%`,
                                  width: `${tBar.width}%`,
                                  top: `${barTop}px`,
                                  height: `${barHeight}px`,
                                  minWidth: '3px',
                                }}
                                onClick={() =>
                                  setDetailData({
                                    type: 'task',
                                    data: task,
                                    chantierId: row.chantier?.id,
                                    phase: row.phase,
                                  })
                                }
                                onMouseEnter={() => setHoveredItem(row.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                {/* Background bar */}
                                <div
                                  className={`absolute inset-0 rounded ${colors.barLight} opacity-60`}
                                />
                                {/* Progress fill */}
                                <div
                                  className={`absolute inset-y-0 left-0 rounded ${colors.bar} opacity-90`}
                                  style={{ width: `${task.avancement}%` }}
                                />
                                {/* Hover shine */}
                                <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-white/10" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-semibold text-xs">{task.nom}</p>
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {fmtDate(task.dateDebut)} → {fmtDate(task.dateFin)}
                                </div>
                                <div className="flex items-center gap-1 text-[11px]">
                                  <TrendingUp className="w-3 h-3" />
                                  Avancement : {Math.round(task.avancement)}%
                                </div>
                                {task.responsable && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Users className="w-3 h-3" />
                                    {task.responsable.name}
                                  </div>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${STATUT_COLORS[task.statut]?.bg} ${STATUT_COLORS[task.statut]?.text} ${STATUT_COLORS[task.statut]?.border}`}
                                >
                                  {STATUT_LABELS[task.statut] || task.statut}
                                </Badge>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      }

                      return null
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          </Card>
        )}

        {/* ─── Stats cards ─── */}
        {hasRows && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total phases" value={stats.totalPhases} />
            <StatCard label="Total tâches" value={stats.totalTasks} />
            <StatCard label="Tâches en cours" value={stats.tasksEnCours} color="text-amber-600" />
            <StatCard label="Tâches en retard" value={stats.tasksEnRetard} color="text-red-600" />
          </div>
        )}

        {/* ─── Detail Dialog ─── */}
        <Dialog
          open={!!detailData}
          onOpenChange={(open) => !open && setDetailData(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detailData?.type === 'task' && (
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${STATUT_COLORS[(detailData.data as Tache).statut]?.bar ?? 'bg-slate-400'}`}
                  />
                )}
                {detailData?.type === 'phase' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                )}
                {detailData?.type === 'chantier' && (
                  <Building2 className="w-4 h-4 text-amber-600" />
                )}
                {detailData?.data.nom}
              </DialogTitle>
              <DialogDescription>
                {detailData?.type === 'chantier'
                  ? 'Détails du chantier'
                  : detailData?.type === 'phase'
                    ? `Phase — ${(detailData?.chantierId ? allChantiers.find(c => c.id === detailData.chantierId)?.nom : '')}`
                    : `Tâche — ${detailData?.phase?.nom ?? ''}`}
              </DialogDescription>
            </DialogHeader>

            {detailData && (
              <div className="space-y-4">
                {/* Status badge (task) */}
                {detailData.type === 'task' && (
                  <Badge
                    variant="outline"
                    className={`${STATUT_COLORS[(detailData.data as Tache).statut]?.bg} ${STATUT_COLORS[(detailData.data as Tache).statut]?.text} ${STATUT_COLORS[(detailData.data as Tache).statut]?.border}`}
                  >
                    {STATUT_LABELS[(detailData.data as Tache).statut] ||
                      (detailData.data as Tache).statut}
                  </Badge>
                )}

                {/* Status badge (chantier) */}
                {detailData.type === 'chantier' && (
                  <Badge
                    variant="outline"
                    className={`${STATUT_COLORS[(detailData.data as Chantier).statut]?.bg} ${STATUT_COLORS[(detailData.data as Chantier).statut]?.text} ${STATUT_COLORS[(detailData.data as Chantier).statut]?.border}`}
                  >
                    {STATUT_LABELS[(detailData.data as Chantier).statut] ||
                      (detailData.data as Chantier).statut}
                  </Badge>
                )}

                {/* Progress (phase or task) */}
                {detailData.type !== 'chantier' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Avancement
                      </span>
                      <span className="font-semibold">
                        {Math.round(detailData.data.avancement)}%
                      </span>
                    </div>
                    <Progress value={detailData.data.avancement} className="h-2" />
                  </div>
                )}

                {/* Dates (phase or task) */}
                {detailData.type !== 'chantier' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Date début
                      </p>
                      <p className="text-[15px] font-medium">
                        {fmtDate(detailData.data.dateDebut)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Date fin
                      </p>
                      <p className="text-[15px] font-medium">
                        {fmtDate(detailData.data.dateFin)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Duration */}
                {detailData.type !== 'chantier' &&
                  detailData.data.dateDebut &&
                  detailData.data.dateFin &&
                  (() => {
                    const s = safeParse(detailData.data.dateDebut)
                    const e = safeParse(detailData.data.dateFin)
                    if (!s || !e) return null
                    const days = differenceInDays(e, s) + 1
                    return (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        Durée :{' '}
                        <span className="font-medium text-foreground">
                          {days} jour{days > 1 ? 's' : ''}
                        </span>
                      </div>
                    )
                  })()}

                {/* Responsable (task) */}
                {detailData.type === 'task' &&
                  (detailData.data as Tache).responsable && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      Responsable :{' '}
                      <span className="font-medium text-foreground">
                        {(detailData.data as Tache).responsable!.name}
                      </span>
                    </div>
                  )}

                {/* Description (phase or task) */}
                {detailData.data.description && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-[15px] text-foreground/80 whitespace-pre-line">
                        {detailData.data.description}
                      </p>
                    </div>
                  </>
                )}

                {/* Chantier stats (chantier detail) */}
                {detailData.type === 'chantier' && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Résumé</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Phases : </span>
                          <span className="font-medium">
                            {(detailData.data as Chantier).phases.length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tâches : </span>
                          <span className="font-medium">
                            {(detailData.data as Chantier).phases.reduce(
                              (a, p) => a + p.taches.length,
                              0
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Task list (phase detail) */}
                {detailData.type === 'phase' &&
                  (detailData.data as Phase).taches.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">
                          Tâches ({(detailData.data as Phase).taches.length})
                        </p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {(detailData.data as Phase).taches.map((t) => {
                            const c =
                              STATUT_COLORS[t.statut] || STATUT_COLORS.PLANIFIEE
                            return (
                              <div
                                key={t.id}
                                className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30"
                              >
                                <div
                                  className={`w-1.5 h-4 rounded-full shrink-0 ${c.bar}`}
                                />
                                <span className="text-sm font-medium flex-1 truncate">
                                  {t.nom}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs shrink-0 ${c.bg} ${c.text} ${c.border}`}
                                >
                                  {Math.round(t.avancement)}%
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}

                {/* Navigate to chantier detail */}
                {detailData.chantierId && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() =>
                        handleNavigateToChantier(detailData.chantierId!)
                      }
                    >
                      <ExternalLink className="w-4 h-4" />
                      Voir le chantier
                    </Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
