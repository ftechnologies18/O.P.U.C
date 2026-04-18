// ─────────────────────────────────────────────────────────────
// O.P.U.C — NextAuth Configuration
// JWT-based session with type-safe extensions.
// ─────────────────────────────────────────────────────────────

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword, isAccountLocked, getLockoutExpiryDate } from '@/lib/password'

// ═══════════════════════════════════════════════════════════
// Note: NextAuth types are extended in src/types/next-auth.d.ts
// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const MAX_LOGIN_ATTEMPTS = 5
const SESSION_MAX_AGE = 8 * 60 * 60 // 8 hours

// ═══════════════════════════════════════════════════════════
// AUTH OPTIONS
// ═══════════════════════════════════════════════════════════

const nextAuthSecret = process.env.NEXTAUTH_SECRET
if (!nextAuthSecret) {
  console.warn(
    '[AUTH WARNING] NEXTAUTH_SECRET is not set. Using a fallback secret. ' +
    'This is UNSAFE for production. Generate one with: openssl rand -base64 32'
  )
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Identifiants',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'votre@email.com' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password || !user.active) {
          return null
        }

        // Check if account is locked
        if (isAccountLocked(user.lockedUntil)) {
          return null
        }

        const isPasswordValid = await verifyPassword(credentials.password, user.password)

        if (!isPasswordValid) {
          // Increment login attempts
          const newAttempts = user.loginAttempts + 1
          const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS

          await db.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: newAttempts,
              ...(shouldLock
                ? { lockedUntil: getLockoutExpiryDate(newAttempts) }
                : {}),
            },
          })

          return null
        }

        // Successful login — reset attempts and update lastLoginAt
        await db.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: null,
          entrepriseId: user.entrepriseId,
          premiereConnexion: user.premiereConnexion,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? 'CHEF_CHANTIER'
        token.userId = user.id
        token.entrepriseId = user.entrepriseId ?? null
        token.isSuperAdmin = token.role === 'SUPER_ADMIN'
        token.twoFactorEnabled = user.twoFactorEnabled ?? false
        token.premiereConnexion = user.premiereConnexion ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.userId
        session.user.entrepriseId = token.entrepriseId
        session.user.isSuperAdmin = token.isSuperAdmin
        session.user.twoFactorEnabled = token.twoFactorEnabled
        session.user.premiereConnexion = token.premiereConnexion
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
        } catch {
          // Silently fail — don't break the auth flow
        }
      }
    },
  },
  pages: {
    signIn: '/',
  },
  secret: nextAuthSecret || 'opuc-dev-secret-change-in-production',
}
