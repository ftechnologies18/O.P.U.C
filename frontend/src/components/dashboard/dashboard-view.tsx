'use client'

import {
  Building2, Users, ClipboardList, Bell, TrendingUp, Calendar,
  Package, FileText, AlertTriangle, ArrowRight, CheckCircle2,
  Wallet, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface DashboardData {
  chantiersActifs: number
  journaliersSurSite: number
  pointagesAujourdhui: number
  alertesActives: number
  tachesEnRetard: number
  chantiers: Array<{
    id: string
    nom: string
    budgetPrevisionnel: number
    statut: string
  }>
  budgetData: Array<{
    chantierId: string
    nom: string
    budgetPrevisionnel: number
    budgetReel: number
    personnelCost: number
    materiauxCost: number
    stCost: number
  }>
  phasesProgress: Array<{
    nom: string
    avancement: number
    ordre: number
  }>
  activeChantierNom: string
  recentNotifications: Array<{
    id: string
    titre: string
    message: string
    type: string
    lu: boolean
    createdAt: string
  }>
  stockAlerts: Array<{
    id: string
    reference: string
    designation: string
    categorie: string | null
    unite: string
    seuilAlerte: number
    quantiteDisponible: number
    chantier: { nom: string }
  }>
  tachesEnRetardDetails: Array<{
    id: string
    nom: string
    dateFin: string | null
    avancement: number
    phase: { nom: string; chantier: { nom: string } }
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

const formatFCFA = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value))
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const setSelectedChantierId = useAppStore((s) => s.setSelectedChantierId)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        // Fetch dashboard data from Go API
        const [dashRes, chantiersRes, meRes] = await Promise.all([
          fetch('/api/v1/dashboard'),
          fetch('/api/v1/chantiers'),
          fetch('/api/v1/auth/me'),
        ])

        if (!dashRes.ok) {
          throw new Error('Failed to fetch dashboard')
        }

        const dash = await dashRes.json()
        const user = meRes.ok ? await meRes.json() : null

        // Récupère la liste des chantiers pour le statusDistribution
        let chantiersList: Array<{ id: string; nom: string; budgetPrevisionnel: number; statut: string }> = []
        if (chantiersRes.ok) {
          const chJson = await chantiersRes.json()
          chantiersList = (chJson.chantiers || []).map((c: any) => ({
            id: c.id,
            nom: c.nom,
            budgetPrevisionnel: c.budgetPrevisionnel || 0,
            statut: c.statut,
          }))
        }

        // Map API Go format → DashboardData expected by frontend
        const mapped: DashboardData = {
          chantiersActifs: dash.chantiersActifs || 0,
          journaliersSurSite: dash.journaliersSurSite || 0,
          pointagesAujourdhui: dash.pointagesAujourdhui || 0,
          alertesActives: dash.alertesActives || 0,
          tachesEnRetard: dash.tachesEnRetard || 0,
          // API Go retourne budgetData avec coutReel (pas budgetReel), on mappe
          budgetData: (dash.budgetData || []).map((b: any) => ({
            chantierId: b.id,
            nom: b.nom,
            budgetPrevisionnel: b.budgetPrevisionnel || 0,
            budgetReel: b.coutReel || 0,
            personnelCost: 0,
            materiauxCost: 0,
            stCost: 0,
          })),
          // Champs non retournés par l'API Go → valeurs par défaut
          chantiers: chantiersList,
          userName: user?.name || 'Utilisateur',
          userRole: user?.role || '',
          stockAlerts: [], // API Go retourne un number, pas un array — on vide
          recentNotifications: [],
          activeChantierNom: chantiersList[0]?.nom || '',
          phasesProgress: [],
          tachesEnRetardDetails: [],
        }
        setData(mapped)
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
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/20',
    },
    {
      title: 'Journaliers sur site',
      value: data.journaliersSurSite,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200 dark:border-emerald-500/20',
    },
    {
      title: "Pointages aujourd'hui",
      value: data.pointagesAujourdhui,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      borderColor: 'border-orange-200 dark:border-orange-500/20',
    },
    {
      title: 'Alertes actives',
      value: data.alertesActives,
      icon: Bell,
      color: 'text-red-600',
      bg: data.alertesActives > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-red-50 dark:bg-red-500/10',
      borderColor: 'border-red-200 dark:border-red-500/20',
      highlight: data.alertesActives > 0,
    },
  ]

  // Budget data for chart — REAL data from API
  const budgetChartData = data.budgetData.map((b) => ({
    name: b.nom.length > 18 ? b.nom.substring(0, 16) + '…' : b.nom.split(' - ')[0],
    prévisionnel: Math.round(b.budgetPrevisionnel / 1000000),
    réel: Math.round(b.budgetReel / 1000000),
  }))

  // Chantier status distribution
  const statusDistribution = data.chantiers.reduce((acc, c) => {
    const label = statutLabels[c.statut] || c.statut
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(statusDistribution).map(([name, value]) => ({ name, value }))

  const quickActions = [
    { label: 'Nouveau pointage', icon: ClipboardList, view: 'pointage', description: 'Enregistrer la présence' },
    { label: 'Gérer les stocks', icon: Package, view: 'stocks', description: 'Entrées & sorties' },
    { label: 'Rapport journalier', icon: FileText, view: 'rapports', description: 'Rédiger un rapport' },
    { label: 'Suivi budget', icon: BarChart3, view: 'budget', description: 'Consulter les dépenses' },
    { label: 'Planning', icon: Calendar, view: 'planning', description: 'Diagramme de Gantt' },
    { label: 'Paie hebdo', icon: Wallet, view: 'paie', description: 'Valider les paiements' },
  ]

  const notificationTypeIcons: Record<string, string> = {
    STOCK_ALERT: '📦',
    BUDGET_ALERT: '💰',
    PAIEMENT: '💳',
    TACHE_RETARD: '⚠️',
    DOCUMENT: '📄',
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrateur',
    GERANT: 'Gérant',
    CHEF_PROJET: 'Chef de Projet',
    SOUS_TRAITANT: 'Sous-traitant',
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Bonjour, {data.userName} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            {roleLabels[data.userRole] || data.userRole} — Voici un aperçu de vos chantiers et de l&apos;activité du jour.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={`border shadow-sm hover:shadow-md transition-shadow ${card.highlight ? 'ring-2 ring-red-300 dark:ring-red-500/40' : ''}`}>
              <CardContent className="p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm lg:text-[15px] text-muted-foreground font-medium">{card.title}</p>
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

      {/* Alert banners row */}
      {(data.stockAlerts.length > 0 || data.tachesEnRetard > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Stock alerts */}
          {data.stockAlerts.length > 0 && (
            <Card className="border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-[15px] font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Alertes de stock ({data.stockAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.stockAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between text-sm bg-white dark:bg-background rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{alert.designation}</p>
                        <p className="text-muted-foreground">{alert.chantier.nom} · {alert.reference}</p>
                      </div>
                      <Badge variant="destructive" className="ml-2 shrink-0 text-[10px]">
                        {Math.round(alert.quantiteDisponible)} {alert.unite}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full h-8 text-sm border-red-200 hover:bg-red-100 dark:border-red-500/30 dark:hover:bg-red-500/10"
                  onClick={() => router.push('/stocks')}
                >
                  Voir le stock <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tasks en retard */}
          {data.tachesEnRetard > 0 && (
            <Card className="border border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-[15px] font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="w-4 h-4" />
                  Tâches en retard ({data.tachesEnRetard})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.tachesEnRetardDetails.map((tache) => (
                    <div key={tache.id} className="flex items-center justify-between text-sm bg-white dark:bg-background rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{tache.nom}</p>
                        <p className="text-muted-foreground">{tache.phase.chantier.nom} · {tache.phase.nom}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-muted-foreground">{Math.round(tache.avancement)}%</span>
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 dark:text-orange-400">
                          {tache.dateFin ? format(new Date(tache.dateFin), 'dd MMM', { locale: fr }) : '—'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full h-8 text-sm border-orange-200 hover:bg-orange-100 dark:border-orange-500/30 dark:hover:bg-orange-500/10"
                  onClick={() => router.push('/planning')}
                >
                  Voir le planning <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget chart */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-amber-500" />
              Budget (millions FCFA)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {budgetChartData.length > 0 ? (
              <>
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
                    <span className="text-sm text-muted-foreground">Prévisionnel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-muted-foreground">Réel (dépenses)</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée budgétaire disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chantier status pie */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold">Statut des chantiers</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {pieData.length > 0 ? (
              <>
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
                    <button
                      key={c.id}
                      className="flex items-center justify-between text-[15px] w-full text-left hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors"
                      onClick={() => {
                        setSelectedChantierId(c.id)
                        router.push(`/chantiers/${c.id}`)
                      }}
                    >
                      <span className="text-muted-foreground truncate max-w-[140px]">{c.nom.split(' - ')[0]}</span>
                      <Badge variant="outline" className={`text-[10px] ${statutColors[c.statut] || ''}`}>
                        {statutLabels[c.statut] || c.statut}
                      </Badge>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Aucun chantier
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase progress */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold">Avancement des phases</CardTitle>
            {data.activeChantierNom && (
              <p className="text-sm text-muted-foreground">{data.activeChantierNom}</p>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {data.phasesProgress.length > 0 ? (
              <div className="space-y-4">
                {data.phasesProgress.map((phase) => (
                  <div key={phase.ordre} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[15px]">
                      <span className="font-medium text-foreground">{phase.nom}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${
                          phase.avancement >= 100 ? 'text-emerald-600' :
                          phase.avancement >= 50 ? 'text-amber-600' :
                          'text-muted-foreground'
                        }`}>
                          {Math.round(phase.avancement)}%
                        </span>
                        {phase.avancement >= 100 && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                    <Progress value={phase.avancement} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Building2 className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune phase à afficher</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 text-amber-600"
                  onClick={() => router.push('/chantiers')}
                >
                  Voir les chantiers
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications + Quick actions */}
        <div className="space-y-6">
          {/* Quick actions */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Button
                      key={action.view}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-2 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/30 transition-colors"
                      onClick={() => router.push(`/${action.view}`)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium text-center leading-tight">{action.label}</span>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent notifications */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Notifications récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {data.recentNotifications.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {data.recentNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg text-sm transition-colors ${
                        notif.lu
                          ? 'bg-muted/50'
                          : 'bg-amber-50 border border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20'
                      }`}
                    >
                      <span className="text-base mt-0.5">
                        {notificationTypeIcons[notif.type] || '📌'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{notif.titre}</p>
                        <p className="text-sm text-muted-foreground truncate">{notif.message}</p>
                      </div>
                      {!notif.lu && <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                  <Bell className="w-6 h-6 mb-1 opacity-50" />
                  <p className="text-xs">Aucune notification</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Budget summary row */}
      {data.budgetData.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-amber-500" />
              Résumé budgétaire
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-sm">Chantier</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm">Prévisionnel</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm">Réel</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm">Consommé</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground text-sm">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.budgetData.map((b) => {
                    const pct = b.budgetPrevisionnel > 0
                      ? Math.round((b.budgetReel / b.budgetPrevisionnel) * 100)
                      : 0
                    const statusColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'
                    const statusLabel = pct >= 100 ? 'Critique' : pct >= 80 ? 'Attention' : 'OK'
                    return (
                      <tr key={b.chantierId} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-foreground text-sm">{b.nom}</td>
                        <td className="text-right py-2.5 px-4 text-sm text-muted-foreground">
                          {formatFCFA(b.budgetPrevisionnel)} <span className="text-xs">FCFA</span>
                        </td>
                        <td className="text-right py-2.5 px-4 text-sm font-medium text-foreground">
                          {formatFCFA(b.budgetReel)} <span className="text-xs text-muted-foreground">FCFA</span>
                        </td>
                        <td className="text-right py-2.5 px-4 text-sm">
                          <span className={`font-medium ${statusColor}`}>{pct}%</span>
                        </td>
                        <td className="text-right py-2.5 pl-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              pct >= 100 ? 'border-red-200 text-red-700 dark:text-red-400' :
                              pct >= 80 ? 'border-amber-200 text-amber-700 dark:text-amber-400' :
                              'border-emerald-200 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
