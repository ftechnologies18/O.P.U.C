# Contributing to O.P.U.C

Merci de votre intérêt pour contribuer à O.P.U.C ! 🎉

## 🚀 Démarrage rapide

```bash
# Cloner le dépôt
git clone https://github.com/ftechnologies18/O.P.U.C.git
cd O.P.U.C

# Backend (Go 1.23+ requis)
cd backend
cp .env.example .env  # Configurez vos variables
go mod download
go run .

# Frontend (Bun ou Node.js 18+)
cd ../frontend
cp .env.example .env.local
bun install
bun run dev
```

## 📋 Standards de code

### Backend (Go)

- **Architecture** : Clean Architecture (domain → usecase → repository → delivery)
- **Naming** : PascalCase pour les tables (Prisma compat), camelCase pour les colonnes
- **RLS** : toutes les requêtes tenant-scoped via `database.WithTenant()`
- **Tests** : `go test ./...` avant chaque PR
- **Lint** : `go vet ./...` doit passer sans warning

```bash
cd backend
go vet ./...
go build ./...
go test ./...
```

### Frontend (TypeScript/React)

- **Framework** : Next.js 16 (App Router)
- **API** : tous les appels via `src/lib/go-api.ts` (plus de fetch direct)
- **Auth** : `useSession()` depuis `@/lib/auth-session` (shim API Go)
- **Lint** : `bun run lint` doit passer

```bash
cd frontend
bun run lint
```

## 🌿 Workflow Git

### Branches

- `main` : production-ready
- `feat/<feature>` : nouvelle fonctionnalité
- `fix/<bug>` : correction de bug
- `docs/<topic>` : documentation

### Commits (Conventional Commits)

```
feat: ajouter endpoint /api/v1/rapports
fix: corriger RLS sur table Facture
docs: mettre à jour README architecture
refactor: extraire helper GenerateKey
test: ajouter tests usecase pointage
chore: bump Go 1.23.4
```

### Pull Requests

1. Créer une branche depuis `main`
2. Développer + tester localement
3. `go vet`, `go build`, `bun run lint` doivent passer
4. Ouvrir une PR avec le template
5. Attendre la review

## 🏗️ Architecture

```
frontend/          # Next.js (UI uniquement, aucune logique backend)
backend/           # Go API (Clean Architecture)
├── cmd/           # Entry points (migrate, apply_rls, etc.)
├── internal/
│   ├── config/            # Configuration (env vars)
│   ├── domain/model/      # Entités GORM (39 modèles)
│   ├── usecase/           # Logique métier (17 domaines)
│   ├── repository/gorm/   # Implémentations persistance
│   ├── delivery/http/     # Transport HTTP (chi + handlers)
│   └── infrastructure/    # DB, JWT, crypto, storage R2
├── migrations/    # Scripts SQL (RLS, rôles)
└── deployments/   # Docker
```

## 🔐 Sécurité

- **JAMAIS** committer de secrets (.env, tokens, mots de passe)
- Les tokens doivent être en variables d'environnement
- Signaler les vulnérabilites en privé à freelancetechnologies.ci@gmail.com

## 📝 Reporting bugs

Utiliser le template d'issue avec :
- Description du problème
- Étapes pour reproduire
- Comportement attendu vs actuel
- Environnement (OS, Go, Node versions)

## 📄 Licence

En contribuant, vous acceptez que vos contributions soient sous licence MIT.
