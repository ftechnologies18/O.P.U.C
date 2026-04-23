import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Hardcoded Supabase PostgreSQL URL — ensures we NEVER fall back to SQLite
const SUPABASE_URL = "postgresql://postgres.oiruwlbvfmlvhbarjnlr:Victoire%401993%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: SUPABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
