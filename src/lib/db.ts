import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * O.P.U.C — Prisma Client Singleton
 *
 * En production (Cloudflare Pages) : utilise DATABASE_URL depuis les env vars Cloudflare
 * En développement : utilise DATABASE_URL depuis .env.local / .env
 *
 * Variables requises dans Cloudflare Pages :
 *   - DATABASE_URL   = URL de connexion Supabase PostgreSQL
 *   - DIRECT_URL     = URL directe Supabase (pour migrations)
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      '[DB ERROR] DATABASE_URL is not set. ' +
      'Please set it in .env.local (dev) or Cloudflare Pages Environment Variables (prod).'
    )
  }

  return new PrismaClient({
    datasourceUrl: databaseUrl,
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
