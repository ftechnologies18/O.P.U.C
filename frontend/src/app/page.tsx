'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-session'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { LoginForm } from '@/components/auth/login-form'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { TwoFactorVerify } from '@/components/auth/two-factor-verify'
import { ForcePasswordChange } from '@/components/auth/force-password-change'
import { LandingPage } from '@/components/landing/landing-page'
import { Loader2 } from 'lucide-react'

// ─── Auth Flow States ──────────────────────────────────────────────
type AuthStep = 'landing' | 'login' | 'forgot-password' | 'two-factor' | 'force-password'

function AppContent() {
  const { data: session, status } = useSession()

  // Auth flow state (only used while unauthenticated)
  const [authStep, setAuthStep] = useState<AuthStep>('landing')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  // ─── Authenticated: redirect to the dashboard ───────────────────────
  // The App Router (`(app)/dashboard/page.tsx`) handles the actual app UI;
  // the landing page is now exclusively for unauthenticated visitors.
  useEffect(() => {
    if (!session) return
    const user = session.user as { premiereConnexion?: boolean; id?: string } | undefined
    // If the user must change their password on first login, we keep them on
    // the landing route to show the force-password-change dialog below.
    if (user?.premiereConnexion && user?.id) return
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }, [session])

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

  // ─── Authenticated: forced password change (premiereConnexion) ──────
  if (session) {
    const user = session.user as { premiereConnexion?: boolean; id?: string } | undefined
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
    // Session is valid but the redirect effect hasn't fired yet — show a
    // loader while the browser navigates to /dashboard.
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  // ─── Not authenticated: landing page or auth flow ───────────────────
  if (authStep === 'landing') {
    return <LandingPage onLoginClick={() => setAuthStep('login')} />
  }

  if (authStep === 'forgot-password') {
    return <ForgotPasswordForm onBack={() => setAuthStep('login')} />
  }

  if (authStep === 'two-factor' && pendingUserId) {
    return (
      <TwoFactorVerify
        userId={pendingUserId}
        onVerified={() => {
          setAuthStep('login')
          setPendingUserId(null)
          // Reload to pick up the session, then the effect above will
          // redirect to /dashboard.
          window.location.href = '/'
        }}
        onCancel={() => {
          setAuthStep('login')
          setPendingUserId(null)
        }}
      />
    )
  }

  if (authStep === 'force-password' && pendingUserId) {
    return (
      <ForcePasswordChange
        userId={pendingUserId}
        open={true}
        onComplete={() => {
          setAuthStep('login')
          setPendingUserId(null)
          window.location.href = '/'
        }}
      />
    )
  }

  // Default: login form
  return (
    <LoginForm
      onForgotPassword={() => setAuthStep('forgot-password')}
      onBack={() => setAuthStep('landing')}
    />
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
