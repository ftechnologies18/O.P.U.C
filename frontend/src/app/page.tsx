'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-session'
import { LandingPage } from '@/components/landing/landing-page'
import { ForcePasswordChange } from '@/components/auth/force-password-change'
import { Loader2 } from 'lucide-react'

function AppContent() {
  const { data: session, status } = useSession()

  // Authenticated → redirect to /dashboard
  useEffect(() => {
    if (!session) return
    const user = session.user as { premiereConnexion?: boolean; id?: string } | undefined
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

  // Authenticated with premiereConnexion → force password change
  if (session) {
    const user = session.user as { premiereConnexion?: boolean; id?: string } | undefined
    if (user?.premiereConnexion && user?.id) {
      return (
        <ForcePasswordChange
          userId={user.id}
          open={true}
          onComplete={() => window.location.reload()}
        />
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  // Not authenticated → landing page (login is at /login)
  return <LandingPage onLoginClick={() => (window.location.href = '/login')} />
}

export default function Home() {
  return <AppContent />
}
