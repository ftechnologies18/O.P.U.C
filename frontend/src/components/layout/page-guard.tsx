'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/lib/auth-session'
import { getRolePages } from '@/lib/rbac'

/**
 * PageGuard — empêche un user d'accéder directement (URL) à une page
 * qui n'est pas autorisée pour son rôle. Redirige vers la page par défaut.
 *
 * Rôles concernés :
 * - SUPER_ADMIN : redirigé vers /admin-plateforme s'il tente une page métier
 * - EMPLOYE / SOUS_TRAITANT : redirigé vers /dashboard s'il tente une page
 *   hors de sa fonction BTP
 * - GERANT / CHEF_PROJET : pas de restriction (null = RBAC normal)
 *
 * À placer dans le layout (app)/(app)/layout.tsx pour wrapper toutes les pages app.
 */
export function PageGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const role = (session?.user as any)?.role as string | undefined
  const fonction = (session?.user as any)?.fonction as string | undefined
  const allowedPages = getRolePages(role, fonction)

  useEffect(() => {
    if (!allowedPages || !pathname) return
    // Extract page id from pathname (e.g., /stocks/entrees → stocks)
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return // root
    const pageId = segments[0] // first segment = page id
    // Special case : mes-taches is a top-level route
    if (pageId === 'mes-taches') return
    if (!allowedPages.includes(pageId)) {
      // SUPER_ADMIN est redirigé vers /admin-plateforme (son dashboard)
      // Les autres rôles vers /dashboard
      const redirectUrl = role === 'SUPER_ADMIN' ? '/admin-plateforme' : '/dashboard'
      router.replace(redirectUrl)
    }
  }, [allowedPages, pathname, router, role])

  return <>{children}</>
}
