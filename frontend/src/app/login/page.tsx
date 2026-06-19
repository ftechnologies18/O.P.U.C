'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-session'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  const { data: session, status } = useSession()

  // Si déjà authentifié, redirect vers /dashboard
  useEffect(() => {
    if (status === 'authenticated' && session) {
      window.location.href = '/dashboard'
    }
  }, [status, session])

  // Pendant le chargement, afficher un spinner
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Si déjà authentifié, ne pas afficher le form (le redirect est en cours)
  if (session) return null

  // Non authentifié → afficher le formulaire
  return <LoginForm onBack={() => (window.location.href = '/')} />
}
