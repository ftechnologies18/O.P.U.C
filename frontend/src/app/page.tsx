'use client'

import { useState, lazy, Suspense } from 'react'
import { useSession } from '@/lib/auth-session'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginForm } from '@/components/auth/login-form'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { TwoFactorVerify } from '@/components/auth/two-factor-verify'
import { ForcePasswordChange } from '@/components/auth/force-password-change'
import { LandingPage } from '@/components/landing/landing-page'
import { useAppStore } from '@/store/app-store'
import { Loader2 } from 'lucide-react'

// ─── Lazy-loaded view components (code-split) ────────────────────────
const DashboardView = lazy(() => import('@/components/dashboard/dashboard-view').then(m => ({ default: m.DashboardView })))
const PlaceholderView = lazy(() => import('@/components/dashboard/placeholder-view').then(m => ({ default: m.PlaceholderView })))
const ChantiersView = lazy(() => import('@/components/chantiers/chantiers-view').then(m => ({ default: m.ChantiersView })))
const ChantierDetailView = lazy(() => import('@/components/chantiers/chantier-detail-view').then(m => ({ default: m.ChantierDetailView })))
const PersonnelView = lazy(() => import('@/components/personnel/personnel-view').then(m => ({ default: m.PersonnelView })))
const PointageView = lazy(() => import('@/components/pointage/pointage-view').then(m => ({ default: m.PointageView })))
const PaieView = lazy(() => import('@/components/paie/paie-view').then(m => ({ default: m.PaieView })))
const StocksView = lazy(() => import('@/components/stocks/stocks-view').then(m => ({ default: m.StocksView })))
const BudgetView = lazy(() => import('@/components/budget/budget-view').then(m => ({ default: m.BudgetView })))
const RapportsView = lazy(() => import('@/components/rapports/rapports-view').then(m => ({ default: m.RapportsView })))
const PlanningView = lazy(() => import('@/components/planning/planning-view').then(m => ({ default: m.PlanningView })))
const SousTraitantsView = lazy(() => import('@/components/sous-traitants/sous-traitants-view').then(m => ({ default: m.SousTraitantsView })))
const EnginsView = lazy(() => import('@/components/engins/engins-view').then(m => ({ default: m.EnginsView })))
const CarburantView = lazy(() => import('@/components/carburant/carburant-view').then(m => ({ default: m.CarburantView })))
const DocumentsView = lazy(() => import('@/components/documents/documents-view').then(m => ({ default: m.DocumentsView })))
const ParametresView = lazy(() => import('@/components/parametres/parametres-view').then(m => ({ default: m.ParametresView })))
const PhotosView = lazy(() => import('@/components/photos/photos-view').then(m => ({ default: m.PhotosView })))
const GestionAccesView = lazy(() => import('@/components/gestion-acces/gestion-acces-view').then(m => ({ default: m.GestionAccesView })))
const AdminPlateformeView = lazy(() => import('@/components/admin-plateforme/admin-plateforme-view').then(m => ({ default: m.AdminPlateformeView })))
const ClientsView = lazy(() => import('@/components/clients/clients-view').then(m => ({ default: m.ClientsView })))
const DevisView = lazy(() => import('@/components/devis/devis-view').then(m => ({ default: m.DevisView })))
const ContratsView = lazy(() => import('@/components/contrats/contrats-view').then(m => ({ default: m.ContratsView })))
const FacturationView = lazy(() => import('@/components/facturation/facturation-view').then(m => ({ default: m.FacturationView })))
const SupportView = lazy(() => import('@/components/support/support-view').then(m => ({ default: m.SupportView })))

// ─── Suspense Fallback ──────────────────────────────────────────────
function ViewLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  )
}

// ─── Auth Flow States ──────────────────────────────────────────────
type AuthStep = 'landing' | 'login' | 'forgot-password' | 'two-factor' | 'force-password'

function AppContent() {
  const { data: session, status } = useSession()
  const { currentView } = useAppStore()

  // Auth flow state
  const [authStep, setAuthStep] = useState<AuthStep>('landing')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  // Auth step resets when session appears (derived, no effect needed)
  const effectiveAuthStep = session ? 'login' : authStep
  const effectivePendingUserId = session ? null : pendingUserId

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  // ─── Not authenticated: show landing page or auth flow ───────────────────
  if (!session) {
    // Step: Landing page (default)
    if (effectiveAuthStep === 'landing') {
      return (
        <LandingPage
          onLoginClick={() => setAuthStep('login')}
        />
      )
    }

    // Step: Forgot password
    if (effectiveAuthStep === 'forgot-password') {
      return <ForgotPasswordForm onBack={() => setAuthStep('login')} />
    }

    // Step: 2FA verification (after login, before session)
    if (effectiveAuthStep === 'two-factor' && effectivePendingUserId) {
      return (
        <TwoFactorVerify
          userId={effectivePendingUserId}
          onVerified={() => {
            setAuthStep('login')
            setPendingUserId(null)
            // Reload to pick up the session
            window.location.href = '/'
          }}
          onCancel={() => {
            setAuthStep('login')
            setPendingUserId(null)
          }}
        />
      )
    }

    // Step: Force password change (premiereConnexion)
    if (effectiveAuthStep === 'force-password' && effectivePendingUserId) {
      return (
        <ForcePasswordChange
          userId={effectivePendingUserId}
          open={true}
          onComplete={() => {
            setAuthStep('login')
            setPendingUserId(null)
            window.location.href = '/'
          }}
        />
      )
    }

    // Step: Login form
    return <LoginForm onForgotPassword={() => setAuthStep('forgot-password')} onBack={() => setAuthStep('landing')} />
  }

  // ─── Authenticated: show forced password change if premiereConnexion ─────
  const user = session.user
  if (user?.premiereConnexion && user?.id) {
    return (
      <ForcePasswordChange
        userId={user.id}
        open={true}
        onComplete={() => {
          window.location.reload()
        }}
      />
    )
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'chantiers':
        return <ChantiersView />
      case 'chantier-detail':
        return <ChantierDetailView />
      case 'personnel':
        return <PersonnelView />
      case 'pointage':
        return <PointageView />
      case 'paie':
        return <PaieView />
      case 'stocks':
        return <StocksView />
      case 'budget':
        return <BudgetView />
      case 'rapports':
        return <RapportsView />
      case 'planning':
        return <PlanningView />
      case 'sous-traitants':
        return <SousTraitantsView />
      case 'engins':
        return <EnginsView />
      case 'carburant':
        return <CarburantView />
      case 'photos':
        return <PhotosView />
      case 'documents':
        return <DocumentsView />
      case 'clients':
        return <ClientsView />
      case 'devis':
        return <DevisView />
      case 'contrats':
        return <ContratsView />
      case 'facturation':
        return <FacturationView />
      case 'support':
        return <SupportView />
      case 'parametres':
        return <ParametresView />
      case 'gestion-acces':
        return <GestionAccesView />
      case 'admin-plateforme':
        return <AdminPlateformeView />
      default:
        return <PlaceholderView viewId={currentView} />
    }
  }

  return (
    <AppLayout>
      <Suspense fallback={<ViewLoader />}>
        {renderView()}
      </Suspense>
    </AppLayout>
  )
}

export default function Home() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
