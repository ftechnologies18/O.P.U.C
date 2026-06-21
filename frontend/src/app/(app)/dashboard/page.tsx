'use client'

/**
 * DashboardPage — routeur par rôle.
 *
 * Affiche le dashboard spécialisé selon le rôle de l'utilisateur connecté :
 *   - SUPER_ADMIN    → SuperAdminDashboard (redirige vers /admin-plateforme)
 *   - GERANT         → GerantDashboard (KPIs BTP + budget + quick actions)
 *   - CHEF_PROJET    → ChefProjetDashboard (mes-taches + pointages + chantiers)
 *   - EMPLOYE / SOUS_TRAITANT → EmployeDashboard (mes-taches + notifications)
 *
 * Tant que la session charge ou que le rôle est inconnu, on affiche un spinner
 * plein écran (évite le flash de contenu générique).
 */

import { useSession } from '@/lib/auth-session'
import { GerantDashboard } from '@/components/dashboard/gerant-dashboard'
import { ChefProjetDashboard } from '@/components/dashboard/chef-projet-dashboard'
import { EmployeDashboard } from '@/components/dashboard/employe-dashboard'
import { SuperAdminDashboard } from '@/components/dashboard/super-admin-dashboard'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  if (status === 'loading' || !role) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return <SuperAdminDashboard />
    case 'GERANT':
      return <GerantDashboard />
    case 'CHEF_PROJET':
      return <ChefProjetDashboard />
    case 'EMPLOYE':
    case 'SOUS_TRAITANT':
      return <EmployeDashboard />
    default:
      // Fallback : dashboard Gérant (le plus générique pour un tenant)
      return <GerantDashboard />
  }
}
