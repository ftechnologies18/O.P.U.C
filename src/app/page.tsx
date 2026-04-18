'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginForm } from '@/components/auth/login-form'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { TwoFactorVerify } from '@/components/auth/two-factor-verify'
import { ForcePasswordChange } from '@/components/auth/force-password-change'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { PlaceholderView } from '@/components/dashboard/placeholder-view'
import { ChantiersView } from '@/components/chantiers/chantiers-view'
import { ChantierDetailView } from '@/components/chantiers/chantier-detail-view'
import { PersonnelView } from '@/components/personnel/personnel-view'
import { PointageView } from '@/components/pointage/pointage-view'
import { PaieView } from '@/components/paie/paie-view'
import { StocksView } from '@/components/stocks/stocks-view'
import { BudgetView } from '@/components/budget/budget-view'
import { RapportsView } from '@/components/rapports/rapports-view'
import { PlanningView } from '@/components/planning/planning-view'
import { SousTraitantsView } from '@/components/sous-traitants/sous-traitants-view'
import { EnginsView } from '@/components/engins/engins-view'
import { CarburantView } from '@/components/carburant/carburant-view'
import { DocumentsView } from '@/components/documents/documents-view'
import { ParametresView } from '@/components/parametres/parametres-view'
import { PhotosView } from '@/components/photos/photos-view'
import { GestionAccesView } from '@/components/gestion-acces/gestion-acces-view'
import { useAppStore } from '@/store/app-store'
import { Loader2 } from 'lucide-react'

// ─── Auth Flow States ──────────────────────────────────────────────────────
type AuthStep = 'login' | 'forgot-password' | 'two-factor' | 'force-password'

function AppContent() {
  const { data: session, status } = useSession()
  const { currentView } = useAppStore()

  // Auth flow state
  const [authStep, setAuthStep] = useState<AuthStep>('login')
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

  // ─── Not authenticated: show auth flow ──────────────────────────────────
  if (!session) {
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

    // Step: Login form (default)
    return <LoginForm onForgotPassword={() => setAuthStep('forgot-password')} />
  }

  // ─── Authenticated: show forced password change if premiereConnexion ─────
  const user = session.user as any
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
      case 'parametres':
        return <ParametresView />
      case 'gestion-acces':
        return <GestionAccesView />
      default:
        return <PlaceholderView viewId={currentView} />
    }
  }

  return (
    <AppLayout>
      {renderView()}
    </AppLayout>
  )
}

export default function Home() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
