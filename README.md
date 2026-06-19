<div align="center">

# 🏗️ O.P.U.C

### Outil de Pilotage Unifié de Chantier

Plateforme SaaS multi-tenant de gestion et pilotage de chantiers BTP en Côte d'Ivoire.

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Neon](https://img.shields.io/badge/Neon-Serverless-00E599?logo=neon&logoColor=white)](https://neon.tech/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/products/r2/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📋 Table des matières

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Identifiants de test](#identifiants-de-test)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [Licence](#licence)

## 🎯 Aperçu

O.P.U.C est une plateforme complète de gestion de chantiers BTP couvrant **17 domaines métier** : pointage, paie, stock, carburant, devis, facturation, sous-traitants, documents, support, et plus.

Le projet est organisé en **monorepo** avec un backend Go (Clean Architecture) et un frontend Next.js (UI uniquement), connectés à Neon Postgres (SQL + RLS) et Cloudflare R2 (fichiers).

## ✨ Fonctionnalités

### 🏗️ Gestion chantier
- Tableau de bord avec KPIs temps réel
- Chantiers (CRUD + phases + tâches + avancement)
- Planning et suivi des travaux
- Photos, rapports journaliers, documents

### 👥 Gestion personnel
- Pointage mobile (offline-first via PWA)
- Paie hebdomadaire (calcul auto depuis pointages validés)
- Salaires mensuels (CNPS, IR, heures supp, retenues)
- Journaliers + affectations par chantier

### 📦 Gestion matériel
- Stock multi-chantier (entrées/sorties + alertes seuil)
- Parc engins (propriétaire + location)
- Carburant (cuves + approvisionnements + bons d'achat + relevés compteurs)

### 💼 Commercial
- Clients (entreprises/particuliers/institutions)
- Devis (lignes + TVA + remises + statuts)
- Contrats (travaux/fourniture/service)
- Facturation (paiements multiples + auto-statut)

### 🔐 Sécurité & multi-tenant
- Authentification JWT + cookie httpOnly
- 2FA TOTP (Google Authenticator)
- Row-Level Security PostgreSQL (isolation tenant natif)
- 4 rôles RBAC : SUPER_ADMIN, GERANT, CHEF_PROJET, SOUS_TRAITANT
- Audit log complet

### 📱 PWA
- Mode offline (Service Worker + sync batch)
- Installable (manifest + icons)
- Responsive (mobile-first)

## 🏗️ Architecture

```
O.P.U.C/
├── frontend/          # Next.js 16 (UI uniquement, ~0 logique backend)
├── backend/           # Go 1.23 API (Clean Architecture, ~111 endpoints)
├── docs/              # Documentation (architecture, API, dev, deploy)
├── .github/           # CI/CD + templates (PR, issues)
├── docker-compose.yml # Dev local
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

### Flux d'une requête

```
Browser → Next.js (:3000) → /api/v1/* proxy → Backend Go (:8080)
  → middleware (Auth JWT → RBAC → RLS WithTenant)
  → usecase (logique métier)
  → repository (GORM + pgx)
  → Neon Postgres (RLS-filtered)
  → JSON response
```

📖 **Détail** : [docs/architecture.md](docs/architecture.md)

## 🛠️ Stack technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | Next.js 16 + TypeScript + shadcn/ui + Tailwind | UI, routing, proxy API |
| **Backend** | Go 1.23 + chi v5 + GORM + pgx | API REST, auth, logique métier |
| **Database** | Neon Serverless Postgres (PG 18.4) | Données SQL + RLS multi-tenant |
| **Storage** | Cloudflare R2 | Fichiers (photos, documents, PDF) |
| **Auth** | JWT (HS256) + cookie httpOnly + 2FA TOTP | Authentification stateless |
| **CI/CD** | GitHub Actions | Tests, build, deploy |
| **Deploy** | Cloudflare Pages (frontend) + Docker (backend) | Production |

## 🚀 Démarrage rapide

### Prérequis

- [Go](https://go.dev/dl/) 1.23+
- [Bun](https://bun.sh/) 1.3+ (ou Node.js 18+)
- [Git](https://git-scm.com/)

### Installation

```bash
git clone https://github.com/ftechnologies18/O.P.U.C.git
cd O.P.U.C
```

### Backend

```bash
cd backend
cp .env.example .env
# Configurez DATABASE_URL (Neon), JWT_SECRET, R2_API_TOKEN, etc.
go mod download
go run .
# → Backend sur http://localhost:8080
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
bun install
bun run dev
# → Frontend sur http://localhost:3000
```

### Base de données (Neon)

```bash
cd frontend
# Configurez DATABASE_URL avec votre connexion Neon directe
bunx prisma db push    # Crée les 45 tables
bunx prisma db seed    # Seed : 4 users + entreprise + chantier + 5 journaliers

cd ../backend
export MIGRATIONS_URL="postgresql://neondb_owner:...@...neon.tech/neondb"
go run ./cmd/apply_rls  # Active RLS sur 15 tables tenant-scoped
```

📖 **Détail** : [docs/development.md](docs/development.md)

## 🔑 Identifiants de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | `superadmin@opuc.demo` | `Admin@123456` |
| Gérant | `gerant@opuc.demo` | `demo123` |
| Chef de Projet | `chef-projet@opuc.demo` | `demo123` |
| Sous-traitant | `sous-traitant@opuc.demo` | `demo123` |

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | Architecture détaillée, flux, RLS, domaines |
| [docs/api.md](docs/api.md) | Référence API (~111 endpoints) |
| [docs/development.md](docs/development.md) | Guide de développement, commandes, debug |
| [docs/deployment.md](docs/deployment.md) | Déploiement production (Cloudflare + Docker) |
| [CHANGELOG.md](CHANGELOG.md) | Historique des versions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guide de contribution |

## 📊 Statistiques

- **~111 endpoints API** Go sous `/api/v1/*`
- **39 modèles GORM** (schéma Prisma préservé)
- **17 domaines métier** (auth, IAM, chantiers, pointage, paie, stock, carburant, commercial, support, etc.)
- **15 tables RLS-protected** (isolation multi-tenant native)
- **0 dépendance NextAuth/Prisma** côté frontend (migration complète)

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork le projet
2. Créer une branche (`git checkout -b feat/ma-feature`)
3. Commit (`git commit -m 'feat: ma feature'`)
4. Push (`git push origin feat/ma-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE).

## 📧 Contact

**F Technologies CI**
- Email : freelancetechnologies.ci@gmail.com
- GitHub : [@ftechnologies18](https://github.com/ftechnologies18)

---

<div align="center">

Built with ❤️ in Abidjan, Côte d'Ivoire 🇨🇮

</div>
