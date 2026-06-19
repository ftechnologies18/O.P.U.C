'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-session'
import { AppLayout } from '@/components/layout/app-layout'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { Loader2 } from 'lucide-react'

/**
 * Auth-gated layout for all authenticated app pages.
 *
 * Behavior:
 *  - `loading`     → full-screen spinner
 *  - `unauthenticated` → redirect to `/` (landing page)
 *  - `authenticated`   → render `<AppLayout>{children}</AppLayout>`
 *
 * Providers (ThemeProvider, QueryProvider, AuthProvider) are mounted here
 * because the root `src/app/layout.tsx` does not include them — each route
 * group is responsible for its own provider tree.
 */
function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  // Redirect unauthenticated users to /login (not the landing page).
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
    // useEffect above will trigger the redirect; render nothing in the meantime.
    return null
  }

  return <AppLayout>{children}</AppLayout>
}

export default function AppLayoutRoute({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
