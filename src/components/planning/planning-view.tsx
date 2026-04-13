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
  isToday,
  isSameMonth,
  isSameWeek,
  min,
  max,
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
  Eye,
  X,
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

const ROW_HEIGHT = 36
const PHASE_ROW_HEIGHT = 40
const TIMELINE_HEADER_HEIGHT = 52
const LEFT_COL_WIDTH = 280

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

// ─── Sub-components ───────────────────────────────────────

function EmptyState({ hasChantier }: { hasChantier: boolean }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
          <GanttChart className="w-10 h-10 text-amber-500" />
        </div>
        <h3 className="text-[17px] font-semibold text-foreground mb-1">
          {hasChantier ? 'Aucune phase planifiée' : 'Sélectionnez un chantier'}
        </h3>
        <p className="text-[15px] text-muted-foreground text-center max-w-sm">
          {hasChantier
            ? 'Ce chantier ne comporte pas encore de phases avec des dates. Ajoutez des phases et tâches depuis la vue détail du chantier.'
            : 'Choisissez un chantier dans le menu déroulant ci-dessus pour visualiser son planning.'}
        </p>
      </CardContent>
    </Card>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-medium text-muted-foreground">Légende :</span>
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

// ─── Main Component ───────────────────────────────────────

export function PlanningView() {
  // Data
  const [chantiers, setChantiers] = useState<ChantierOption[]>([])
  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [loadingChantiers, setLoadingChantiers] = useState(true)
  const [loadingChantier, setLoadingChantier] = useState(false)

  // UI state
  const [selectedChantierId, setSelectedChantierId] = useState<string>('')
  const [zoom, setZoom] = useState<'month' | 'week'>('month')
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<{
    type: 'phase' | 'task'
    data: Phase | Tache
    phase?: Phase
  } | null>(null)

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
          setChantiers(data.chantiers || [])
          // Auto-select first chantier with phases
          const withPhases = (data.chantiers || []).find(
            (c: ChantierOption) => c._count.phases > 0
          )
          if (withPhases) {
            setSelectedChantierId(withPhases.id)
          }
        }
      } catch {
        toast.error('Erreur de chargement des chantiers')
      } finally {
        setLoadingChantiers(false)
      }
    }
    fetchChantiers()
  }, [])

  // ─── Fetch selected chantier ───

  const fetchChantier = useCallback(async (id: string) => {
    if (!id) return
    setLoadingChantier(true)
    try {
      const res = await fetch(`/api/chantiers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setChantier(data)
        setCollapsedPhases(new Set())
      } else {
        toast.error('Erreur de chargement du chantier')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoadingChantier(false)
    }
  }, [])

  useEffect(() => {
    if (selectedChantierId) {
      fetchChantier(selectedChantierId)
    } else {
      setChantier(null)
    }
  }, [selectedChantierId, fetchChantier])

  // ─── Timeline calculations ───

  const timelineRange = useMemo(() => {
    if (!chantier || !chantier.phases.length) return null

    const allDates: Date[] = []
    chantier.phases.forEach((phase) => {
      const dStart = safeParse(phase.dateDebut)
      const dEnd = safeParse(phase.dateFin)
      if (dStart) allDates.push(dStart)
      if (dEnd) allDates.push(dEnd)
      phase.taches.forEach((t) => {
        const tdS = safeParse(t.dateDebut)
        const tdE = safeParse(t.dateFin)
        if (tdS) allDates.push(tdS)
        if (tdE) allDates.push(tdE)
      })
    })

    if (allDates.length === 0) return null

    const earliest = min(allDates)
    const latest = max(allDates)

    // Add 1 month padding on each side
    const rangeStart = startOfMonth(addMonths(earliest, -1))
    const rangeEnd = endOfMonth(addMonths(latest, 1))

    const totalDays = differenceInDays(rangeEnd, rangeStart) + 1

    return { start: rangeStart, end: rangeEnd, totalDays }
  }, [chantier])

  // ─── Time slots (months or weeks) ───

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
        width: (differenceInDays(endOfMonth(m), startOfMonth(m)) + 1) / timelineRange.totalDays * 100,
      }))
    } else {
      const weeks = eachWeekOfInterval(
        { start: timelineRange.start, end: timelineRange.end },
        { weekStartsOn: 1, locale: fr }
      )
      return weeks.map((w) => ({
        label: `${fmtDateShort(w)}`,
        shortLabel: fmtDateShort(w),
        start: startOfWeek(w, { weekStartsOn: 1 }),
        end: endOfWeek(w, { weekStartsOn: 1 }),
        width: 7 / timelineRange.totalDays * 100,
      }))
    }
  }, [timelineRange, zoom])

  // ─── Build rows (phases + tasks) ───

  const rows = useMemo(() => {
    if (!chantier) return []
    const result: { type: 'phase'; phase: Phase; id: string } | { type: 'task'; task: Tache; phase: Phase; id: string }[] = []
    chantier.phases.forEach((phase) => {
      result.push({ type: 'phase', phase, id: `phase-${phase.id}` })
      if (!collapsedPhases.has(phase.id)) {
        phase.taches.forEach((task) => {
          result.push({ type: 'task', task, phase, id: `task-${task.id}` })
        })
      }
    })
    return result
  }, [chantier, collapsedPhases])

  // ─── Calculate bar position/width ───

  const getBarStyle = (dateDebut?: string | null, dateFin?: string | null) => {
    if (!timelineRange || !dateDebut || !dateFin) return { left: 0, width: 0, visible: false }

    const dStart = safeParse(dateDebut)
    const dEnd = safeParse(dateFin)
    if (!dStart || !dEnd) return { left: 0, width: 0, visible: false }

    const startOffset = differenceInDays(dStart, timelineRange.start)
    const duration = differenceInDays(dEnd, dStart) + 1

    const left = (startOffset / timelineRange.totalDays) * 100
    const width = Math.max((duration / timelineRange.totalDays) * 100, 0.5)

    return { left, width, visible: true }
  }

  // ─── Today line position ───

  const todayPosition = useMemo(() => {
    if (!timelineRange) return null
    const today = new Date()
    if (today < timelineRange.start || today > timelineRange.end) return null
    const offset = differenceInDays(today, timelineRange.start)
    return (offset / timelineRange.totalDays) * 100
  }, [timelineRange])

  // ─── Total rows height ───

  const totalHeight = useMemo(() => {
    return rows.reduce((acc, row) => {
      return acc + (row.type === 'phase' ? PHASE_ROW_HEIGHT : ROW_HEIGHT)
    }, 0)
  }, [rows])

  // ─── Toggle phase collapse ───

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  // ─── Sync scroll between left col and timeline ───

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
                Diagramme de Gantt des phases et tâches
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
                  value={selectedChantierId}
                  onValueChange={setSelectedChantierId}
                >
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Sélectionner un chantier" />
                  </SelectTrigger>
                  <SelectContent>
                    {chantiers.map((c) => (
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
            </div>
          </CardContent>
        </Card>

        {/* ─── Gantt Chart ─── */}
        {loadingChantier ? (
          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Chargement du planning...
                </span>
              </div>
            </CardContent>
          </Card>
        ) : !chantier || !timelineRange || rows.length === 0 ? (
          <EmptyState hasChantier={!!selectedChantierId && !!chantier} />
        ) : (
          <Card className="border shadow-sm overflow-hidden">
            {/* Gantt container with sync scrolling */}
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
                  Phase / Tâche
                </div>

                {/* Left body - synced scroll */}
                <div
                  ref={leftColBodyRef}
                  onScroll={handleLeftColScroll}
                  className="overflow-hidden"
                  style={{ maxHeight: `calc(100vh - 320px)`, overflowY: 'auto' }}
                >
                  {rows.map((row) => {
                    if (row.type === 'phase') {
                      const phase = row.phase
                      const isCollapsed = collapsedPhases.has(phase.id)
                      return (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 px-3 border-b bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          style={{ height: PHASE_ROW_HEIGHT }}
                          onClick={() => togglePhase(phase.id)}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-[15px] font-bold text-foreground truncate">
                            {phase.nom}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-50 text-amber-700 border-amber-200 shrink-0 ml-auto"
                          >
                            {Math.round(phase.avancement)}%
                          </Badge>
                        </div>
                      )
                    }

                    const task = row.task
                    const colors = STATUT_COLORS[task.statut] || STATUT_COLORS.PLANIFIEE
                    return (
                      <div
                        key={row.id}
                        className="flex items-center gap-2 pl-9 pr-3 border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        style={{ height: ROW_HEIGHT }}
                        onClick={() =>
                          setSelectedTask({ type: 'task', data: task, phase: row.phase })
                        }
                      >
                        <div className={`w-1 h-5 rounded-full shrink-0 ${colors.bar}`} />
                        <span className="text-sm text-foreground truncate">
                          {task.nom}
                        </span>
                      </div>
                    )
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

                {/* Timeline body - scrollable */}
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
                    {/* Grid lines (vertical lines for each time slot boundary) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {timeSlots.map((slot, i) => {
                        // accumulate positions
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
                    {rows.map((row) => {
                      if (row.type === 'phase') {
                        const phase = row.phase
                        const bar = getBarStyle(phase.dateDebut, phase.dateFin)
                        if (!bar.visible) return null

                        const rowTop = rows
                          .slice(0, rows.indexOf(row))
                          .reduce(
                            (acc, r) => acc + (r.type === 'phase' ? PHASE_ROW_HEIGHT : ROW_HEIGHT),
                            0
                          )
                        const top = rowTop + (PHASE_ROW_HEIGHT - 18) / 2
                        const isCollapsed = collapsedPhases.has(phase.id)
                        const displayHeight = isCollapsed ? 16 : 18

                        return (
                          <Tooltip key={row.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute rounded-md cursor-pointer group hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all"
                                style={{
                                  left: `${bar.left}%`,
                                  width: `${bar.width}%`,
                                  top: `${top}px`,
                                  height: `${displayHeight}px`,
                                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${phase.avancement}%, #fde68a ${phase.avancement}%, #fde68a 100%)`,
                                  minWidth: '4px',
                                }}
                                onClick={() =>
                                  setSelectedTask({ type: 'phase', data: phase })
                                }
                                onMouseEnter={() => setHoveredItem(row.id)}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/20 to-black/10" />
                                {bar.width > 6 && (
                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-900 truncate px-1">
                                    {phase.nom} — {Math.round(phase.avancement)}%
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

                      // Task bar
                      const task = row.task
                      const tBar = getBarStyle(task.dateDebut, task.dateFin)
                      const colors = STATUT_COLORS[task.statut] || STATUT_COLORS.PLANIFIEE

                      if (!tBar.visible) {
                        // Task without dates — show a marker on the left
                        const rowTop = rows
                          .slice(0, rows.indexOf(row))
                          .reduce(
                            (acc, r) => acc + (r.type === 'phase' ? PHASE_ROW_HEIGHT : ROW_HEIGHT),
                            0
                          )
                        return (
                          <Tooltip key={row.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute w-2 h-2 rounded-full left-1 cursor-pointer"
                                style={{
                                  top: `${rowTop + (ROW_HEIGHT - 8) / 2}px`,
                                  backgroundColor: colors.bar.includes('slate')
                                    ? '#94a3b8'
                                    : colors.bar.includes('amber')
                                    ? '#f59e0b'
                                    : colors.bar.includes('emerald')
                                    ? '#10b981'
                                    : '#ef4444',
                                }}
                                onClick={() =>
                                  setSelectedTask({ type: 'task', data: task, phase: row.phase })
                                }
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="space-y-1">
                                <p className="font-semibold text-xs">{task.nom}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Sans date planifiée
                                </p>
                                <Badge variant="outline" className={`text-[10px] ${STATUT_COLORS[task.statut]?.bg} ${STATUT_COLORS[task.statut]?.text} ${STATUT_COLORS[task.statut]?.border}`}>
                                  {STATUT_LABELS[task.statut] || task.statut}
                                </Badge>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      }

                      const rowTop = rows
                        .slice(0, rows.indexOf(row))
                        .reduce(
                          (acc, r) => acc + (r.type === 'phase' ? PHASE_ROW_HEIGHT : ROW_HEIGHT),
                          0
                        )
                      const top = rowTop + (ROW_HEIGHT - 14) / 2

                      return (
                        <Tooltip key={row.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute rounded cursor-pointer group hover:ring-2 hover:ring-offset-1 transition-all"
                              style={{
                                left: `${tBar.left}%`,
                                width: `${tBar.width}%`,
                                top: `${top}px`,
                                height: '14px',
                                minWidth: '3px',
                              }}
                              onClick={() =>
                                setSelectedTask({ type: 'task', data: task, phase: row.phase })
                              }
                              onMouseEnter={() => setHoveredItem(row.id)}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              {/* Background bar */}
                              <div
                                className={`absolute inset-0 rounded ${colors.barLight} opacity-60`}
                              />
                              {/* Progress bar */}
                              <div
                                className={`absolute inset-y-0 left-0 rounded ${colors.bar} opacity-90`}
                                style={{ width: `${task.avancement}%` }}
                              />
                              {/* Shine effect on hover */}
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
                              <Badge variant="outline" className={`text-[10px] ${STATUT_COLORS[task.statut]?.bg} ${STATUT_COLORS[task.statut]?.text} ${STATUT_COLORS[task.statut]?.border}`}>
                                {STATUT_LABELS[task.statut] || task.statut}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          </Card>
        )}

        {/* ─── Summary stats below Gantt ─── */}
        {chantier && chantier.phases.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">Phases</p>
                <p className="text-xl font-bold">{chantier.phases.length}</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">Tâches</p>
                <p className="text-xl font-bold">
                  {chantier.phases.reduce((a, p) => a + p.taches.length, 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-xl font-bold text-amber-600">
                  {
                    chantier.phases.reduce(
                      (a, p) =>
                        a + p.taches.filter((t) => t.statut === 'EN_COURS').length,
                      0
                    )
                  }
                </p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <p className="text-sm text-muted-foreground">En retard</p>
                <p className="text-xl font-bold text-red-600">
                  {
                    chantier.phases.reduce(
                      (a, p) =>
                        a + p.taches.filter((t) => t.statut === 'EN_RETARD').length,
                      0
                    )
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Detail Dialog ─── */}
        <Dialog
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTask?.type === 'phase' ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    {selectedTask.data.nom}
                  </>
                ) : (
                  selectedTask?.data.nom
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedTask?.type === 'phase'
                  ? 'Détails de la phase'
                  : `Phase : ${selectedTask?.phase?.nom}`}
              </DialogDescription>
            </DialogHeader>

            {selectedTask && (
              <div className="space-y-4">
                {/* Status badge */}
                {selectedTask.type === 'task' && (
                  <Badge
                    variant="outline"
                    className={`${
                      STATUT_COLORS[(selectedTask.data as Tache).statut]?.bg
                    } ${
                      STATUT_COLORS[(selectedTask.data as Tache).statut]?.text
                    } ${
                      STATUT_COLORS[(selectedTask.data as Tache).statut]?.border
                    }`}
                  >
                    {STATUT_LABELS[(selectedTask.data as Tache).statut] ||
                      (selectedTask.data as Tache).statut}
                  </Badge>
                )}

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Avancement
                    </span>
                    <span className="font-semibold">
                      {Math.round(selectedTask.data.avancement)}%
                    </span>
                  </div>
                  <Progress value={selectedTask.data.avancement} className="h-2" />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Date début
                    </p>
                    <p className="text-[15px] font-medium">
                      {fmtDate(selectedTask.data.dateDebut)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Date fin
                    </p>
                    <p className="text-[15px] font-medium">
                      {fmtDate(selectedTask.data.dateFin)}
                    </p>
                  </div>
                </div>

                {/* Duration */}
                {selectedTask.data.dateDebut && selectedTask.data.dateFin && (() => {
                  const s = safeParse(selectedTask.data.dateDebut)
                  const e = safeParse(selectedTask.data.dateFin)
                  if (!s || !e) return null
                  const days = differenceInDays(e, s) + 1
                  return (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Durée : <span className="font-medium text-foreground">{days} jour{days > 1 ? 's' : ''}</span>
                    </div>
                  )
                })()}

                {/* Responsable */}
                {selectedTask.type === 'task' && (selectedTask.data as Tache).responsable && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    Responsable :{' '}
                    <span className="font-medium text-foreground">
                      {(selectedTask.data as Tache).responsable!.name}
                    </span>
                  </div>
                )}

                {/* Description */}
                {selectedTask.data.description && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-[15px] text-foreground/80 whitespace-pre-line">
                        {selectedTask.data.description}
                      </p>
                    </div>
                  </>
                )}

                {/* Task list for phase */}
                {selectedTask.type === 'phase' && (selectedTask.data as Phase).taches.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">
                        Tâches ({(selectedTask.data as Phase).taches.length})
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {(selectedTask.data as Phase).taches.map((t) => {
                          const c = STATUT_COLORS[t.statut] || STATUT_COLORS.PLANIFIEE
                          return (
                            <div
                              key={t.id}
                              className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30"
                            >
                              <div className={`w-1.5 h-4 rounded-full shrink-0 ${c.bar}`} />
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
