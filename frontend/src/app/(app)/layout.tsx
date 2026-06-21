'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-session'
import { AppLayout } from '@/components/layout/app-layout'
import { PageGuard } from '@/components/layout/page-guard'
import { Loader2 } from 'lucide-react'

/**
 * Auth-gated layout for all authenticated app pages.
 *
 * Behavior:
 *  - `loading`         → full-screen spinner
 *  - `unauthenticated` → redirect to `/login`
 *  - `authenticated`   → render `<AppLayout>{children}</AppLayout>`
 *
 * Providers (ThemeProvider, QueryProvider, AuthProvider) are in the root layout.
 */
export default function AppLayoutRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()

  // Redirect unauthenticated users to /login.
  useEffect(() => {
    if (status === 'unauthenticated' && typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }, [status])

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
    return null
  }

  return (
    <AppLayout>
      <PageGuard>{children}</PageGuard>
    </AppLayout>
  )
}
