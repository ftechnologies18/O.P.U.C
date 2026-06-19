# Déploiement

## 🏗️ Architecture production

```
Internet → Cloudflare CDN → Frontend (Pages/Workers)
                          → Backend Go (Fly.io/Railway/VPS)
                          → Neon Postgres (eu-central-1)
                          → Cloudflare R2 (WEUR)
```

## 📦 Frontend — Cloudflare Pages

### Build

```bash
cd frontend
bun install
bun run build:cf  # next build + @opennextjs/cloudflare build
```

### Déploiement

```bash
# Via Wrangler
bunx wrangler pages deploy .open-next/assets --project-name opuc

# Ou via GitHub Actions ( voir .github/workflows/deploy.yml)
```

### Variables d'environnement (Cloudflare Dashboard)

| Variable | Valeur |
|----------|--------|
| `NEXTAUTH_URL` | `https://opuc.pages.dev` |
| `NEXTAUTH_SECRET` | (générer avec `openssl rand -base64 32`) |

> Note : Le frontend ne nécessite plus DATABASE_URL (API Go gère la DB)

## 🚀 Backend — Docker

### Image

```bash
cd backend
docker build -f deployments/docker/Dockerfile -t opuc-api:latest .
```

### Run

```bash
docker run -d \
  --name opuc-api \
  -p 8080:8080 \
  --env-file backend/.env \
  --restart unless-stopped \
  opuc-api:latest
```

### Variables d'environnement

Voir `backend/.env.example` :
- `DATABASE_URL` : Neon pooled connection
- `MIGRATIONS_URL` : Neon direct connection
- `JWT_SECRET` : secret JWT (32+ chars)
- `R2_API_TOKEN` : token Cloudflare R2
- `R2_ACCOUNT_ID` : account ID Cloudflare
- `R2_BUCKET` : `opuc-files`

## 🗄️ Base de données — Neon

### Setup

1. Créer un projet sur [Neon Console](https://console.neon.tech)
2. Récupérer les connection strings (pooled + direct)
3. Configurer `DATABASE_URL` (pooled) et `MIGRATIONS_URL` (direct) dans `backend/.env`

### Schéma

```bash
cd frontend
# Configurer DATABASE_URL avec la connexion directe Neon
bunx prisma db push
bunx prisma db seed
```

### RLS

```bash
cd backend
export MIGRATIONS_URL="postgresql://neondb_owner:...@...neon.tech/neondb"
go run ./cmd/apply_rls
go run ./cmd/fix_rls  # Optionnel : désactive RLS sur tables enfant
```

## 📁 Stockage — Cloudflare R2

### Setup

1. Créer un bucket R2 `opuc-files` sur [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Créer un token API (cfat_...) avec permissions R2 read/write
3. Configurer `R2_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_BUCKET` dans `backend/.env`

### Test

```bash
# Upload test
curl -X POST http://localhost:8080/api/v1/upload \
  -H "Cookie: opuc_session=..." \
  -F "file=@test.txt" -F "prefix=tests"
```

## 🔄 CI/CD — GitHub Actions

Le workflow `.github/workflows/deploy.yml` :
1. Déclenche sur push vers `main`
2. Build frontend (Next.js + Cloudflare)
3. Build backend (Go binary + Docker image)
4. Deploy frontend vers Cloudflare Pages
5. Deploy backend vers le registry (à configurer)

## 📊 Monitoring (à venir)

- **Logs** : structurés (slog JSON en prod)
- **Métriques** : Prometheus + Grafana (planned)
- **Uptime** : Healthcheck `/api/v1/health`

## 🔒 Sécurité production

- ✅ JWT secret 32+ chars
- ✅ Cookie httpOnly + Secure (HTTPS) + SameSite=Lax
- ✅ RLS PostgreSQL activé
- ✅ CORS configuré (frontend URL uniquement)
- ✅ Rate limiting (à implémenter)
- ✅ Types de fichiers whitelistés (upload R2)
- ✅ Secrets en variables d'environnement (jamais dans le code)

## 📋 Checklist déploiement

- [ ] Backend `.env` configuré (Neon + R2 + JWT)
- [ ] Frontend `.env.local` configuré (NEXTAUTH_URL)
- [ ] Schéma DB appliqué (`prisma db push`)
- [ ] Seed exécuté (`prisma db seed`)
- [ ] RLS activé (`go run ./cmd/apply_rls`)
- [ ] Test login end-to-end
- [ ] Test upload R2
- [ ] Cloudflare DNS configuré
- [ ] HTTPS forcé
