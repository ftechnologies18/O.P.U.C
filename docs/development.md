# Développement

## 🚀 Démarrage rapide

### Prérequis

- **Go** 1.23+ ([télécharger](https://go.dev/dl/))
- **Bun** 1.3+ ou **Node.js** 18+ ([télécharger Bun](https://bun.sh/))
- **Git**

### Installation

```bash
git clone https://github.com/ftechnologies18/O.P.U.C.git
cd O.P.U.C
```

### Backend

```bash
cd backend
cp .env.example .env
# Éditez .env avec vos credentials Neon + R2

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

## 🗄️ Base de données (Neon)

### Créer le schéma

Le schéma est géré par Prisma (côté frontend pour les migrations) :

```bash
cd frontend
# Configurer DATABASE_URL dans .env.local avec votre connexion Neon directe
bunx prisma db push
bunx prisma db seed  # 4 users + entreprise + chantier + 5 journaliers + 4 phases
```

### Activer RLS

```bash
cd backend
export MIGRATIONS_URL="postgresql://neondb_owner:...@...neon.tech/neondb"
go run ./cmd/apply_rls  # Crée policies tenant_isolation sur 15 tables
```

## 🔑 Identifiants de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| SUPER_ADMIN | `superadmin@opuc.demo` | `Admin@123456` |
| GERANT | `gerant@opuc.demo` | `demo123` |
| CHEF_PROJET | `chef-projet@opuc.demo` | `demo123` |
| SOUS_TRAITANT | `sous-traitant@opuc.demo` | `demo123` |

## 🛠️ Commandes utiles

### Backend

```bash
cd backend

go run .                    # Démarrer serveur
go build -o bin/opuc-api .  # Build binaire
go vet ./...                # Lint
go test ./...               # Tests

go run ./cmd/migrate        # Appliquer migrations SQL
go run ./cmd/apply_rls      # Activer RLS policies
go run ./cmd/fix_rls        # Désactiver RLS sur tables sans policy
go run ./cmd/test_rls       # Tester isolation RLS
```

### Frontend

```bash
cd frontend

bun run dev                 # Démarrer dev server
bun run lint                # Lint ESLint
bun run build               # Build production
```

## 🐛 Debug

### Backend logs

Le backend log en structured logging (slog) :
- `level=INFO` : requêtes HTTP, connexions DB
- `level=WARN` : SLOW SQL (>500ms)
- `level=ERROR` : erreurs

### Frontend logs

Next.js dev server log dans `dev.log` (gitignored).

### Problèmes courants

**"database connected (runtime/app_user)" mais login 401**
→ Vérifiez que le seed a été exécuté : `bunx prisma db seed`

**"RLS blocks all rows"**
→ Exécutez `go run ./cmd/fix_rls` pour désactiver RLS sur tables sans policy

**Latence élevée (~3s/query)**
→ Normal avec Neon eu-central-1 depuis certains environnements. Optimisable avec cache.

## 📁 Structure des dossiers

Voir [docs/architecture.md](./architecture.md) pour le détail.

## 🧪 Tests

```bash
# Backend
cd backend
go test -v -race -cover ./...

# Frontend (à venir)
cd frontend
bun run test
```

## 📦 Build production

### Backend (Docker)

```bash
cd backend
docker build -f deployments/docker/Dockerfile -t opuc-api .
docker run -p 8080:8080 --env-file .env opuc-api
```

### Frontend (Cloudflare)

```bash
cd frontend
bun run build:cf  # next build + opennextjs-cloudflare build
```

## 🚀 Déploiement

Voir [docs/deployment.md](./deployment.md).
