# Architecture O.P.U.C

## 📐 Vue d'ensemble

O.P.U.C est une plateforme SaaS multi-tenant de gestion de chantiers BTP, organisée en monorepo :

```
O.P.U.C/
├── frontend/          # Next.js 16 (UI uniquement)
├── backend/           # Go 1.23 API (Clean Architecture)
├── docs/              # Documentation
├── .github/           # CI/CD + templates
├── docker-compose.yml # Dev local
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

## 🏗️ Stack technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | Next.js 16 + TypeScript + shadcn/ui | UI, routing, proxy API |
| **Backend** | Go 1.23 + chi + GORM | API REST, auth, logique métier |
| **Database** | Neon Serverless Postgres (PG 18.4) | Données SQL + RLS |
| **Storage** | Cloudflare R2 | Fichiers (photos, documents) |
| **Auth** | JWT (HS256) + cookie httpOnly + 2FA TOTP | Authentification stateless |

## 🔄 Flux d'une requête

```
Browser
  ↓ fetch('/api/v1/chantiers', {credentials: 'same-origin'})
Next.js (:3000)
  ↓ rewrite /api/v1/* → http://localhost:8080
Backend Go (:8080)
  ↓ middleware: Auth (JWT validation) → RBAC (RequireRole) → RLS (WithTenant)
  ↓ usecase.Chantier.List(ctx, auth, filter)
  ↓ repository.gorm.ChantierRepository.ListWithMeta
  ↓ SET LOCAL ROLE app_user + set_config('app.current_tenant', ...)
Neon Postgres (eu-central-1)
  ↓ RLS policy: WHERE entrepriseId = current_setting('app.current_tenant')
  ↓ SELECT ... FROM "Chantier" ...
  ↑ rows (tenant-filtered)
  ↑ JSON response
Browser
  ↓ React render
```

## 🔐 Multi-tenant & RLS

### Pattern (Supabase/Neon-compatible)

```
Connexion neondb_owner (bypassRLS=true)
    ↓
SET LOCAL ROLE app_user  (active RLS pour la transaction)
    ↓
set_config('app.current_tenant', entrepriseID)  (filtre tenant)
set_config('app.user_role', role)  (bypass SUPER_ADMIN)
    ↓
Requêtes automatiquement filtrées par RLS
```

### Tables RLS-protected (15)

User, Entreprise, Chantier, Client, Journalier, SousTraitant, Equipement, Devis, Contrat, Facture, TicketSupport, AuditLog, PermissionConfig, SystemSetting, InvitationToken.

### Tables sans RLS (29)

Tables enfant (Phase, Tache, Pointage, StockMateriel, etc.) — filtrées applicativement via `JOIN "Chantier"` (qui est RLS-protected).

## 📁 Backend — Clean Architecture

```
backend/
├── cmd/                        # Entry points
│   ├── migrate/                # Runner migrations SQL
│   ├── apply_rls/              # Applique policies RLS
│   ├── fix_rls/                # Désactive RLS sur tables sans policy
│   └── test_rls/               # Test isolation RLS
├── internal/
│   ├── config/                 # Configuration (env vars typées)
│   ├── domain/
│   │   ├── model/              # 39 entités GORM (PascalCase tables, camelCase columns)
│   │   ├── enums.go            # Role, StatutChantier, ModeCarburant...
│   │   └── errors.go           # Erreurs domaine (ErrNotFound, ErrUnauthorized...)
│   ├── usecase/                # Logique métier (17 domaines)
│   │   ├── auth/               # Login, 2FA, GetCurrentUser
│   │   ├── iam/                # Users CRUD, permissions, audit
│   │   ├── chantier/           # List, Get (avec méta-données)
│   │   ├── dashboard/          # KPIs agrégés
│   │   ├── pointage/           # CRUD + validate + summary
│   │   ├── paie/               # PaiementHebdo + SalaireMensuel (generate)
│   │   ├── stock/              # Stock + Entrees + Sorties
│   │   ├── carburant/          # Stock + Entrees + Sorties + Achats + Releves + Stats
│   │   ├── client/             # CRUD + stats
│   │   ├── devis/              # CRUD + lignes + statut (compute totaux)
│   │   ├── contrat/            # CRUD + statut
│   │   ├── facturation/        # CRUD + paiements + stats (auto-statut)
│   │   ├── soustraitant/       # CRUD + contrats ST
│   │   ├── document/           # Documents + Photos + Rapports
│   │   ├── support/            # Tickets + Messages + Stats
│   │   ├── sync/               # Best-effort offline sync
│   │   └── notification/       # Notifications user
│   ├── repository/gorm/        # Implémentations persistance (WithTenant)
│   ├── delivery/http/
│   │   ├── handler/            # HTTP handlers (chi)
│   │   ├── dto/                # Request/Response structs
│   │   ├── middleware/         # Auth, RBAC, Logger, Recover, CORS
│   │   └── router.go           # ~111 routes /api/v1/*
│   └── infrastructure/
│       ├── database/           # GORM + pgx + tenant.go (WithTenant) + migrate
│       ├── jwt/                # Signer HS256
│       ├── crypto/             # bcrypt + TOTP (pquerna/otp)
│       └── storage/            # Client Cloudflare R2
├── migrations/                 # Scripts SQL (000001 app_user, 000002 RLS)
├── deployments/docker/         # Dockerfile multi-stage
├── Makefile
└── go.mod
```

### Règle de dépendance

```
delivery/http  ←  infrastructure
     ↓                (db, jwt, crypto, storage)
  usecase
     ↓
  domain (entités)
```

- `domain` n'importe jamais GORM, chi, pgx
- `usecase` définit les interfaces de repository (inversion de dépendance)
- `repository/gorm` implémente ces interfaces
- `main.go` wire tout

## 📁 Frontend — Next.js (UI uniquement)

```
frontend/
├── src/
│   ├── app/                    # App Router (page.tsx = SPA entry)
│   ├── components/             # Composants React (25+ modules)
│   │   ├── auth/               # LoginForm, 2FA, etc.
│   │   ├── layout/             # AppLayout, UserMenu, Sidebar
│   │   ├── dashboard/          # DashboardView
│   │   ├── chantiers/          # ChantiersView + detail
│   │   ├── pointage/           # PointageView
│   │   └── ...                 # 17 domaines métier
│   ├── lib/
│   │   ├── go-api.ts           # Client API Go (login, me, helpers)
│   │   ├── auth-session.tsx    # Shim useSession (compatible NextAuth)
│   │   ├── rbac.ts             # Matrice permissions 4 rôles × 21 modules
│   │   └── utils.ts            # Helpers
│   ├── hooks/                  # use-go-auth, use-user-role, use-api
│   ├── providers/              # AuthProvider, ThemeProvider, QueryProvider
│   ├── store/                  # Zustand (app-store)
│   └── types/                  # Types TypeScript
├── public/                     # Assets statiques (logo, PWA icons)
├── next.config.ts              # Rewrites /api/v1/* → :8080
├── package.json
└── tsconfig.json
```

## 🔑 Authentification

```
1. POST /api/v1/auth/login {email, password}
   → Backend Go vérifie bcrypt
   → Génère JWT (HS256, claims: uid, email, role, tid, 2fa)
   → Set cookie httpOnly `opuc_session` (SameSite=Lax, MaxAge=24h)
   → Retourne {user, twoFARequired, expiresIn}

2. GET /api/v1/auth/me (avec cookie)
   → Middleware Auth valide le JWT
   → Injecte AuthUser dans le context
   → Retourne le user

3. Toutes les requêtes /api/v1/* 
   → Cookie envoyé automatiquement (same-origin)
   → Middleware Auth + RBAC + RLS
```

## 📊 Domaines métier (17)

| Domaine | Endpoints | RBAC |
|---------|-----------|------|
| Auth | 4 (login, logout, me, health) | public |
| 2FA | 3 (setup, verify, disable) | auth |
| IAM Users | 7 (CRUD + toggle + reset-password) | GERANT+ |
| Permissions | 1 (list) | GERANT+ |
| Audit-logs | 1 (list) | GERANT+ |
| Chantiers | 2 (list, get) | auth |
| Dashboard | 1 (KPIs) | auth |
| Notifications | 1 (list) | auth |
| Pointage | 7 (CRUD + validate + summary) | CHEF_PROJET+ |
| Paie | 6 (hebdo + salaires generate/update) | GERANT+ |
| Stock | 9 (CRUD + entrees + sorties) | CHEF_PROJET+ |
| Carburant | 11 (stock + entrees + sorties + achats + releves + stats) | CHEF_PROJET+ |
| Clients | 6 (CRUD + stats) | CHEF_PROJET+ |
| Devis | 9 (CRUD + lignes + statut) | CHEF_PROJET+ |
| Contrats | 6 (CRUD + statut) | GERANT+ |
| Facturation | 9 (CRUD + paiements + stats + statut) | GERANT+ |
| Sous-traitants | 9 (CRUD + contrats) | CHEF_PROJET+ |
| Documents | 11 (docs + photos + rapports) | CHEF_PROJET+ |
| Support | 8 (tickets + messages + stats) | auth + GERANT+ |
| Sync | 1 (batch offline) | auth |
| Storage | 3 (upload + download + delete) | auth |
| **Total** | **~111** | |

## 🚀 Déploiement

### Production (Cloudflare + Neon + R2)

- **Frontend** : Cloudflare Pages (via @opennextjs/cloudflare)
- **Backend** : Docker (à déployer sur Fly.io / Railway / VPS)
- **Database** : Neon Serverless Postgres (eu-central-1)
- **Storage** : Cloudflare R2 (bucket `opuc-files`, WEUR)

### Variables d'environnement production

Voir `backend/.env.example` et `frontend/.env.example`.
