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
 * - GERANT : pas de whitelist (null), mais certaines pages sont interdites
 *   (ex: mes-taches — le GERANT délègue, il n'exécute pas de tâches)
 * - CHEF_PROJET : whitelist opérationnelle
 *
 * À placer dans le layout (app)/(app)/layout.tsx pour wrapper toutes les pages app.
 */

// Pages interdites par rôle (même si allowedPages est null = pas de whitelist)
const FORBIDDEN_PAGES_BY_ROLE: Record<string, string[]> = {
  GERANT: ['mes-taches'], // Le GERANT délègue, il n'exécute pas de tâches
}

export function PageGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const role = (session?.user as any)?.role as string | undefined
  const fonction = (session?.user as any)?.fonction as string | undefined
  const allowedPages = getRolePages(role, fonction)

  useEffect(() => {
    if (!pathname) return
    // Extract page id from pathname (e.g., /stocks/entrees → stocks)
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return // root

    // Pour les routes /admin/*, construire le pageId depuis les 2 premiers segments
    // ex: /admin/entreprises → "admin-entreprises" (matche la whitelist)
    // ex: /admin-plateforme → "admin-plateforme" (segments[0] directement)
    let pageId = segments[0]
    if (segments[0] === 'admin' && segments.length > 1) {
      pageId = 'admin-' + segments[1]
    }

    // 1. Vérifie les pages interdites par rôle (même sans whitelist)
    const forbidden = role ? (FORBIDDEN_PAGES_BY_ROLE[role] || []) : []
    if (forbidden.includes(pageId)) {
      router.replace('/dashboard')
      return
    }

    // 2. Vérifie la whitelist (SUPER_ADMIN, EMPLOYE, CHEF_PROJET)
    if (!allowedPages) return // GERANT sans restriction (hors pages interdites)
    if (!allowedPages.includes(pageId)) {
      const redirectUrl = role === 'SUPER_ADMIN' ? '/admin-plateforme' : '/dashboard'
      router.replace(redirectUrl)
    }
  }, [allowedPages, pathname, router, role])

  return <>{children}</>
}
