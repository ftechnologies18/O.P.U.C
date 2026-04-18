import 'next-auth'
import 'next-auth/jwt'

// ─────────────────────────────────────────────────────────────
// O.P.U.C — NextAuth Type Augmentation
// Extends default NextAuth types with multi-tenant SaaS fields
// Inspired by CATS repository pattern
// ─────────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      entrepriseId: string | null
      isSuperAdmin: boolean
      twoFactorEnabled: boolean
      premiereConnexion: boolean
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    entrepriseId?: string | null
    twoFactorEnabled?: boolean
    premiereConnexion?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role: string
    entrepriseId: string | null
    isSuperAdmin: boolean
    twoFactorEnabled: boolean
    premiereConnexion: boolean
  }
}
