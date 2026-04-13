'use client'

import { useSession, SessionProvider } from 'next-auth/react'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginForm } from '@/components/auth/login-form'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { PlaceholderView } from '@/components/dashboard/placeholder-view'
import { useAppStore } from '@/store/app-store'
import { Loader2 } from 'lucide-react'

function AppContent() {
  const { data: session, status } = useSession()
  const { currentView } = useAppStore()

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

  if (!session) {
    return <LoginForm />
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
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
        <SessionProvider>
          <AppContent />
        </SessionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
