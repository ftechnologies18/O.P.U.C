# API O.P.U.C — Référence

## 🔐 Authentification

Tous les endpoints (sauf `/auth/login` et `/health`) nécessitent le cookie httpOnly `opuc_session` (JWT).

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "gerant@opuc.demo",
  "password": "demo123"
}
```

**Response 200** :
```json
{
  "user": {
    "id": "cm...",
    "email": "gerant@opuc.demo",
    "name": "Moussa Diallo",
    "role": "GERANT",
    "telephone": "+225 07 10 00 00",
    "active": true,
    "entrepriseId": "cm...",
    "twoFactorEnabled": false
  },
  "twoFARequired": false,
  "twoFAVerified": true,
  "expiresIn": 86400
}
```

Set cookie : `opuc_session` (httpOnly, SameSite=Lax, MaxAge=86400)

### Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/health` | Healthcheck |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | User courant |
| POST | `/api/v1/auth/2fa/setup` | Génère secret TOTP + QR |
| POST | `/api/v1/auth/2fa/verify` | Valide code TOTP |
| POST | `/api/v1/auth/2fa/disable` | Désactive 2FA (password requis) |

## 👥 IAM

| Méthode | Route | RBAC | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/users` | GERANT+ | Liste users (RLS) |
| POST | `/api/v1/users` | GERANT+ | Crée user |
| GET | `/api/v1/users/{id}` | auth | Détail user |
| PUT | `/api/v1/users/{id}` | auth | Modifie user |
| DELETE | `/api/v1/users/{id}` | SUPER_ADMIN | Soft delete |
| POST | `/api/v1/users/{id}/toggle-active` | GERANT+ | Active/désactive |
| POST | `/api/v1/users/{id}/reset-password` | GERANT+ | Reset password |
| GET | `/api/v1/permissions` | GERANT+ | Config permissions |
| GET | `/api/v1/audit-logs` | GERANT+ | Journal audit |

## 🏗️ Chantiers

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/chantiers` | Liste + KPI + avancement |
| GET | `/api/v1/chantiers/{id}` | Détail avec phases |
| GET | `/api/v1/dashboard` | KPIs agrégés |
| GET | `/api/v1/notifications` | Notifications user |

## ⏱️ Pointage

| Méthode | Route | RBAC | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/pointage` | auth | Liste (filtres chantierId, date) |
| POST | `/api/v1/pointage` | CHEF_PROJET+ | Crée (chefChantierId auto) |
| GET | `/api/v1/pointage/{id}` | auth | Détail |
| PUT | `/api/v1/pointage/{id}` | CHEF_PROJET+ | Modifie |
| DELETE | `/api/v1/pointage/{id}` | CHEF_PROJET+ | Supprime |
| POST | `/api/v1/pointage/{id}/validate` | CHEF_PROJET+ | Valide |
| GET | `/api/v1/pointage/summary` | auth | Synthèse (total, present, cost) |

## 💰 Paie

| Méthode | Route | RBAC | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/paie/paiements-hebdo` | GERANT+ | Liste paiements hebdo |
| POST | `/api/v1/paie/paiements-hebdo/generate` | GERANT+ | Génère (SUM pointages validés) |
| PUT | `/api/v1/paie/paiements-hebdo/{id}` | GERANT+ | Modifie |
| GET | `/api/v1/paie/salaires` | GERANT+ | Liste salaires mensuels |
| POST | `/api/v1/paie/salaires/generate` | GERANT+ | Génère (netAPayer computed) |
| PUT | `/api/v1/paie/salaires/{id}` | GERANT+ | Modifie |

## 📦 Stock

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/stocks` | Liste + quantiteDisponible |
| POST | `/api/v1/stocks` | Crée stock |
| GET | `/api/v1/stocks/{id}` | Détail + entrees + sorties |
| PUT/DELETE | `/api/v1/stocks/{id}` | Modifie/Supprime |
| GET/POST | `/api/v1/stocks/entrees` | Entrées stock |
| GET/POST | `/api/v1/stocks/sorties` | Sorties stock |

## ⛽ Carburant

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/api/v1/carburant/stock` | Cuves stock |
| GET/PUT/DELETE | `/api/v1/carburant/stock/{id}` | Détail cuve |
| GET/POST | `/api/v1/carburant/entrees` | Approvisionnements |
| GET/POST | `/api/v1/carburant/sorties` | Sorties (vers équipement) |
| GET/POST | `/api/v1/carburant/achats` | Bons d'achat (achat direct) |
| GET/POST | `/api/v1/carburant/releves` | Relevés compteur engin |
| GET | `/api/v1/carburant/stats` | Stats (stock, mensuel, alertes) |

## 💼 Commercial

### Clients (6)
CRUD + stats (byType, byStatut, recent)

### Devis (9)
CRUD + lignes (add/update/delete + recompute totals) + statut
- `totalHT = Σ(ligne.quantite × prixUnitaire)`
- `montantTVA = (totalHT after remise) × tauxTVA/100`
- `totalTTC = totalHT after remise + montantTVA`

### Contrats (6)
CRUD + statut
- `montantTTC = montantHT × (1 + tauxTVA/100)`

### Facturation (9)
CRUD + statut + paiements + stats
- `montantTVA = montantHT × tauxTVA/100`
- `totalTTC = montantHT + montantTVA`
- Paiement auto-statut : `PAYEE` si `montantPaye ≥ totalTTC`, `PARTIELLEMENT_PAYEE` si `> 0`

## 🏢 Périphériques

### Sous-traitants (9)
CRUD + contrats ST (objetTravaux, montantHT, statut)

### Documents (11)
- Documents : CRUD (titre, type, fichierUrl, auteurId auto)
- Photos : CRUD (categorie, urlOriginale, priseParId auto)
- Rapports : CRUD (dateRapport, meteo, effectifPresent, auteurId auto)

### Support (8)
- Tickets : CRUD + statut (resoluLe/resoluParId auto)
- Messages : list/add (auteurId auto)
- Stats : byStatut, byPriorite, byCategorie

### Sync (1)
`POST /api/v1/sync` — best-effort batch replay (pointage, stock, carburant)

## 📁 Storage (Cloudflare R2)

| Méthode | Route | RBAC | Description |
|---------|-------|------|-------------|
| POST | `/api/v1/upload` | auth | Multipart upload (max 50MB) |
| GET | `/api/v1/files/*` | auth | Download/stream |
| DELETE | `/api/v1/files/*` | auth | Supprime |

### Types autorisés
`image/*`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-*`, `text/plain`, `application/zip`

## 📊 RBAC

| Rôle | Niveau | Permissions |
|------|--------|-------------|
| SUPER_ADMIN | 4 | Tout (bypass RLS, voit toutes les entreprises) |
| GERANT | 3 | CRUD métier + commercial + paie |
| CHEF_PROJET | 2 | CRUD métier (pointage, stock, carburant, devis) |
| SOUS_TRAITANT | 1 | Lecture limitée |

## 🔒 RLS

Toutes les tables tenant-scoped filtrent automatiquement par `entrepriseId` via la policy `tenant_isolation` :

```sql
CREATE POLICY "User_tenant_isolation" ON "User"
    FOR ALL
    USING (app_is_super_admin() OR "entrepriseId" = app_current_tenant())
    WITH CHECK (app_is_super_admin() OR "entrepriseId" = app_current_tenant());
```
