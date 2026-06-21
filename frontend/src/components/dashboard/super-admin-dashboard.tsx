'use client'

/**
 * SuperAdminDashboard — composant dashboard pour SUPER_ADMIN.
 *
 * Le SUPER_ADMIN n'a pas de dashboard "métier" sur /dashboard : sa page d'accueil
 * par défaut est /admin-plateforme (le dashboard SaaS plateforme). Cette redirection
 * est gérée côté routing par :
 *   - `rbac.ts` : 'dashboard' n'est PAS dans SUPER_ADMIN_PAGES → PageGuard bloque.
 *   - `page-guard.tsx` : redirige SUPER_ADMIN vers /admin-plateforme s'il tente /dashboard.
 *
 * Ce composant est un filet de sécurité : si le SUPER_ADMIN arrive quand même sur
 * /dashboard (par ex. via un lien obsolète ou un bookmark), on le redirige
 * proprement vers /admin-plateforme côté client.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function SuperAdminDashboard() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin-plateforme')
  }, [router])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      <p className="text-sm text-muted-foreground">
        Redirection vers le tableau de bord plateforme…
      </p>
    </div>
  )
}
