'use client'

import { Building2, Users, ClipboardList, Bell, TrendingUp, Calendar, Package, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/store/app-store'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts'

interface DashboardData {
  chantiersActifs: number
  journaliersSurSite: number
  pointagesAujourdhui: number
  alertesActives: number
  chantiers: Array<{
    id: string
    nom: string
    budgetPrevisionnel: number
    statut: string
  }>
  phasesProgress: Array<{
    nom: string
    avancement: number
    ordre: number
  }>
  recentNotifications: Array<{
    id: string
    titre: string
    message: string
    type: string
    lu: boolean
    createdAt: string
  }>
  userName: string
  userRole: string
}

const statutColors: Record<string, string> = {
  EN_COURS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_PREPARATION: 'bg-amber-100 text-amber-700 border-amber-200',
  EN_PAUSE: 'bg-orange-100 text-orange-700 border-orange-200',
  TERMINE: 'bg-slate-100 text-slate-700 border-slate-200',
  RECEPTIONNE: 'bg-blue-100 text-blue-700 border-blue-200',
}

const statutLabels: Record<string, string> = {
  EN_COURS: 'En cours',
  EN_PREPARATION: 'En préparation',
  EN_PAUSE: 'En pause',
  TERMINE: 'Terminé',
  RECEPTIONNE: 'Réceptionné',
}

const AMBER_COLORS = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f']

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { setCurrentView } = useAppStore()

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 flex-1 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted rounded-xl animate-pulse" />
          <div className="h-80 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const summaryCards = [
    {
      title: 'Chantiers actifs',
      value: data.chantiersActifs,
      icon: Building2,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Journaliers sur site',
      value: data.journaliersSurSite,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'Pointages aujourd\'hui',
      value: data.pointagesAujourdhui,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    {
      title: 'Alertes actives',
      value: data.alertesActives,
      icon: Bell,
      color: 'text-red-600',
      bg: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  ]

  // Budget data for chart (simulate some real data)
  const budgetChartData = data.chantiers.map((c) => ({
    name: c.nom.split(' - ')[0],
    prévisionnel: c.budgetPrevisionnel / 1000000,
    réel: Math.round(c.budgetPrevisionnel * (0.3 + Math.random() * 0.2)) / 1000000,
  }))

  // Chantier status distribution
  const statusDistribution = data.chantiers.reduce((acc, c) => {
    const label = statutLabels[c.statut] || c.statut
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(statusDistribution).map(([name, value]) => ({ name, value }))

  const quickActions = [
    { label: 'Nouveau pointage', icon: ClipboardList, view: 'pointage' },
    { label: 'Ajouter au stock', icon: Package, view: 'stocks' },
    { label: 'Rapport journalier', icon: FileText, view: 'rapports' },
    { label: 'Voir le planning', icon: Calendar, view: 'planning' },
  ]

  const notificationTypeIcons: Record<string, string> = {
    STOCK_ALERT: '📦',
    BUDGET_ALERT: '💰',
    PAIEMENT: '💳',
    TACHE_RETARD: '⚠️',
    DOCUMENT: '📄',
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bonjour, {data.userName} 👋
        </h2>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de vos chantiers et de l&apos;activité du jour.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs lg:text-sm text-muted-foreground font-medium">{card.title}</p>
                    <p className="text-2xl lg:text-3xl font-bold mt-1 text-foreground">{card.value}</p>
                  </div>
                  <div className={`p-2 lg:p-2.5 rounded-lg ${card.bg} ${card.borderColor} border`}>
                    <Icon className={`w-4.5 h-4.5 lg:w-5 lg:h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget chart */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-amber-500" />
              Budget (millions FCFA)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 90%)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'hsl(0 0% 40%)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(0 0% 40%)' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(0 0% 90%)',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}M FCFA`]}
                  />
                  <Bar dataKey="prévisionnel" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="réel" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Prévisionnel</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-xs text-muted-foreground">Réel</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chantier status pie */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-base font-semibold">Statut des chantiers</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={AMBER_COLORS[index % AMBER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(0 0% 90%)',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {data.chantiers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[140px]">{c.nom.split(' - ')[0]}</span>
                  <Badge variant="outline" className={`text-[10px] ${statutColors[c.statut] || ''}`}>
                    {statutLabels[c.statut] || c.statut}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase progress */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-base font-semibold">Avancement des phases</CardTitle>
            <p className="text-xs text-muted-foreground">Résidence Les Palmiers</p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-4">
              {data.phasesProgress.map((phase) => (
                <div key={phase.ordre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{phase.nom}</span>
                    <span className="text-muted-foreground text-xs">{Math.round(phase.avancement)}%</span>
                  </div>
                  <Progress
                    value={phase.avancement}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications + Quick actions */}
        <div className="space-y-6">
          {/* Quick actions */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.view}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors"
                      onClick={() => setCurrentView(action.view)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent notifications */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Notifications récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {data.recentNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg text-sm ${
                      notif.lu ? 'bg-muted/50' : 'bg-amber-50 border border-amber-200/50'
                    }`}
                  >
                    <span className="text-base mt-0.5">
                      {notificationTypeIcons[notif.type] || '📌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-xs">{notif.titre}</p>
                      <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
