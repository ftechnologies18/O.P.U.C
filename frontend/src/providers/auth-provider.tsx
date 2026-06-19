'use client'

import { SessionProvider } from '@/lib/auth-session'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>
}
