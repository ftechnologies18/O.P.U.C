# O.P.U.C — Outil de Pilotage Unifié de Chantier

Plateforme SaaS de gestion et pilotage de chantiers BTP en Côte d'Ivoire.

## 📁 Structure du monorepo

```
O.P.U.C/
├── frontend/          # Application Next.js 16 + shadcn/ui (frontend + API legacy)
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── next.config.ts
│
├── backend/           # API Go (Clean Architecture) — en cours de migration
│   ├── main.go
│   ├── internal/
│   │   ├── config/            # Configuration (env vars)
│   │   ├── domain/            # Entités GORM + enums + erreurs
│   │   │   └── model/
│   │   ├── usecase/           # Logique métier (cas d'usage)
│   │   │   └── auth/
│   │   ├── repository/gorm/   # Implémentations persistance (GORM)
│   │   ├── delivery/http/     # Transport HTTP (chi router + handlers)
│   │   │   ├── handler/
│   │   │   ├── dto/
│   │   │   └── middleware/
│   │   └── infrastructure/    # Détails techniques
│   │       ├── database/      # PostgreSQL + RLS tenant
│   │       ├── jwt/
│   │       └── crypto/
│   ├── migrations/            # Scripts SQL (rôles, RLS)
│   ├── deployments/docker/
│   ├── Makefile
│   └── go.mod
│
├── .zscripts/         # Scripts sandbox (démarrage frontend + backend)
├── Caddyfile          # Gateway (route /api/v1/* → backend Go)
└── README.md
```

## 🏗️ Architecture (Clean Architecture)

```
┌─────────────────────────────────────────────────────┐
│  delivery/http  ←  infrastructure                   │
│ (handlers, chi)     (db, jwt, crypto)               │
├─────────────────────────────────────────────────────┤
│              usecase (logique métier)                │
├─────────────────────────────────────────────────────┤
│            domain (entités GORM)                     │
└─────────────────────────────────────────────────────┘
```

**Règle de dépendance** : tout pointe vers l'intérieur. `domain` ne dépend de rien.
Les interfaces sont définies côté `usecase`, implémentées par `repository/gorm`.

## 🔐 Multi-tenant & Row-Level Security

- **Clé de tenancy** : `entreprise_id` (comme côté Prisma/Next.js)
- **RLS PostgreSQL natif** : chaque requête est automatiquement filtrée par tenant
- **2 rôles DB** :
  - `postgres` (superuser) — migrations, seeds, bypass RLS
  - `app_user` (non-superuser) — runtime, RLS appliquée
- **Mécanisme** : `SET LOCAL app.current_tenant = ?` dans chaque transaction

## 🚀 Démarrage (développement)

### Prérequis
- Go 1.23+
- Bun 1.3+
- Node.js 24+ (pour Next.js)

### Lancer le frontend + backend (sandbox)

```bash
# Le script .zscripts/dev.sh démarre les deux :
bash .zscripts/dev.sh
```

Ou manuellement :

```bash
# Frontend (port 3000)
cd frontend && bun install && bun run dev

# Backend (port 8080)
cd backend && cp .env.example .env && go run .
```

### Routes API Go (Phase 0)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET  | `/api/v1/health` | Healthcheck |
| POST | `/api/v1/auth/login` | Login (email + password) |
| POST | `/api/v1/auth/logout` | Logout |
| GET  | `/api/v1/auth/me` | User courant |

## 🔑 Authentification

- **JWT** émis et validé par le backend Go (httpOnly cookie `opuc_session`)
- **2FA TOTP** supporté (pquerna/otp)
- **4 rôles** : SUPER_ADMIN, GERANT, CHEF_PROJET, SOUS_TRAITANT

### Identifiants de test (seed)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| SUPER_ADMIN | `superadmin@opuc.demo` | `Admin@123456` |
| GERANT | `gerant@opuc.demo` | `demo123` |
| CHEF_PROJET | `chef-projet@opuc.demo` | `demo123` |
| SOUS_TRAITANT | `sous-traitant@opuc.demo` | `demo123` |

## 📦 Stack technique

### Backend (Go)
- **Router** : chi v5
- **ORM** : GORM + pgx (driver PostgreSQL)
- **Auth** : golang-jwt/v5 + bcrypt + pquerna/otp (2FA)
- **Config** : godotenv + caarlos0/env
- **Logging** : log/slog (stdlib)

### Frontend (Next.js 16)
- Next.js 16.2.4 + Turbopack
- shadcn/ui + Tailwind CSS 4
- Prisma ORM + Supabase
- NextAuth (en cours de retrait → API Go)

### Infrastructure
- **DB** : Supabase PostgreSQL (Eu-West-1)
- **Déploiement** : Cloudflare Workers (frontend) + Docker (backend, à venir)

## 📝 Plan de migration

| Phase | Objectif | Statut |
|-------|----------|--------|
| **0** | Squelette Go + auth + RLS | ✅ En cours |
| **1** | IAM (users, permissions, audit) + 2FA | ⏳ |
| **2** | Lecture : chantiers, dashboard, notifications | ⏳ |
| **3** | Cœur métier : pointage, paie, stock, carburant | ⏳ |
| **4** | Commercial : clients, devis, contrats, facturation | ⏳ |
| **5** | Périphériques : sous-traitants, documents, support, sync | ⏳ |
| **6** | Bascule : `/api/*` → Go, décommissionner routes Next.js | ⏳ |

## 📜 Licence

Propriétaire — F Technologies
