import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword, isAccountLocked, getLockoutExpiryDate } from '@/lib/password'

const MAX_LOGIN_ATTEMPTS = 5

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
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.userId = user.id
        token.entrepriseId = (user as { entrepriseId?: string | null }).entrepriseId ?? null
        token.isSuperAdmin = token.role === 'SUPER_ADMIN'
        token.twoFactorEnabled = (user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false
        token.premiereConnexion = (user as { premiereConnexion?: boolean }).premiereConnexion ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string }).role = (token as { role: string }).role
        ;(session.user as { id: string }).id = (token as { userId: string }).userId
        ;(session.user as { entrepriseId: string | null }).entrepriseId =
          (token as { entrepriseId: string | null }).entrepriseId
        ;(session.user as { isSuperAdmin: boolean }).isSuperAdmin =
          (token as { isSuperAdmin: boolean }).isSuperAdmin
        ;(session.user as { twoFactorEnabled: boolean }).twoFactorEnabled =
          (token as { twoFactorEnabled: boolean }).twoFactorEnabled
        ;(session.user as { premiereConnexion: boolean }).premiereConnexion =
          (token as { premiereConnexion: boolean }).premiereConnexion
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
  secret: process.env.NEXTAUTH_SECRET || 'opuc-dev-secret-change-in-production',
}
