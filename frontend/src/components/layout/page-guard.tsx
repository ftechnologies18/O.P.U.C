'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/lib/auth-session'
import { getFonctionPages } from '@/lib/rbac'

/**
 * PageGuard — empêche un EMPLOYE d'accéder directement (URL) à une page
 * qui n'est pas dans sa fonction. Redirige vers /dashboard si tentative.
 *
 * À placer dans le layout (app)/(app)/layout.tsx pour wrapper toutes les pages app.
 */
export function PageGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const role = (session?.user as any)?.role as string | undefined
  const fonction = (session?.user as any)?.fonction as string | undefined
  const allowedPages = getFonctionPages(role, fonction)

  useEffect(() => {
    if (!allowedPages || !pathname) return
    // Extract page id from pathname (e.g., /stocks/entrees → stocks)
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return // root
    const pageId = segments[0] // first segment = page id
    // Special case : mes-taches is a top-level route
    if (pageId === 'mes-taches') return
    if (!allowedPages.includes(pageId)) {
      router.replace('/dashboard')
    }
  }, [allowedPages, pathname, router])

  return <>{children}</>
}
