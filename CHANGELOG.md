# Changelog

Tous les changements notables de O.P.U.C sont documentés ici.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Planned
- Tests unitaires backend (Go)
- Tests E2E frontend (Playwright)
- Déploiement Docker Compose production
- Monitoring (Prometheus + Grafana)

## [1.0.0] — 2026-06-19

### Added — Migration backend Go complète

#### Backend Go (`backend/`)
- **Architecture** : Clean Architecture (domain → usecase → repository → delivery)
- **~111 endpoints API** sous `/api/v1/*` (router chi)
- **39 modèles GORM** avec tags JSON (schéma Prisma préservé)
- **17 domaines métier** :
  - Auth (login, logout, me, 2FA TOTP)
  - IAM (users CRUD, permissions, audit-logs)
  - Lecture métier (chantiers, dashboard, notifications)
  - Write métier (pointage, paie, stock, carburant)
  - Commercial (clients, devis, contrats, facturation)
  - Périphériques (sous-traitants, documents, photos, rapports, support, sync)
- **Authentification** : JWT (HS256) + cookie httpOnly + 2FA TOTP
- **Row-Level Security** PostgreSQL (15 tables tenant-isolated)
- **Stockage fichiers** : Cloudflare R2 (upload/download/delete via API REST)
- **Migrations SQL** : rôle `app_user` + policies `tenant_isolation`
- **Commands** : `cmd/migrate`, `cmd/apply_rls`, `cmd/fix_rls`, `cmd/test_rls`

#### Frontend Next.js (`frontend/`)
- **Client API Go** : `src/lib/go-api.ts` (login, logout, me, helpers get/post/put/delete, upload)
- **Shim auth** : `src/lib/auth-session.tsx` (useSession/signIn/signOut compatibles NextAuth)
- **NextAuth + Prisma retirés** (-69% node_modules, 1108 → 346 packages)
- **89 routes API legacy supprimées** (src/app/api/ n'existe plus)
- **68 appels fetch migrés** de `/api/` vers `/api/v1/`
- **LoginForm refactorisé** : `goApi.login()` au lieu de `signIn()` NextAuth

#### Infrastructure
- **Base de données** : Neon Serverless Postgres (eu-central-1, PG 18.4)
- **Stockage fichiers** : Cloudflare R2 (bucket `opuc-files`, WEUR)
- **RLS pattern** : `SET LOCAL ROLE app_user` (Supabase/Neon-compatible)
- **Proxy frontend** : `/api/v1/*` → backend Go via `next.config.ts` rewrites

### Security
- Tokens/secrets retirés du tracking git
- `.gitignore` mis à jour (.env, .pid, tool-results/, etc.)
- Types de fichiers whitelistés pour upload R2 (max 50MB)
- Path traversal bloqué sur les downloads

### Removed
- `next-auth` (package npm)
- `@auth/prisma-adapter` (package npm)
- `prisma` + `@prisma/client` (packages npm)
- `src/app/api/` (89 routes API Next.js legacy)
- `src/lib/auth.ts`, `db.ts`, `two-factor.ts`, `password.ts`, `rate-limiter.ts`, `tenant.ts`
- `src/types/next-auth.d.ts`

## [0.2.0] — 2026-04-23

### Added
- RBAC simplifié de 6 → 4 rôles (SUPER_ADMIN, GERANT, CHEF_PROJET, SOUS_TRAITANT)
- Migration @opennextjs/cloudflare pour Next.js 16.2.4
- Déploiement Cloudflare Workers

## [0.1.0] — 2026-04-15

### Added
- Projet initial Next.js 16 + Prisma + Supabase + NextAuth
- 45 modèles Prisma, 98 routes API
- Landing page + dashboard 22 modules
- PWA offline (Service Worker + IndexedDB)
