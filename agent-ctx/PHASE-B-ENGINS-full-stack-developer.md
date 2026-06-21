# Task ID: PHASE-B-ENGINS — Agent: full-stack-developer

## Mission
Créer le module backend **Engins** (parc engins + locations) complet pour le projet O.P.U.C (Go 1.23, Clean Architecture, dans `/home/z/my-project/opuc/backend`).

## Contexte
- Backend Go 1.23 dans `/home/z/my-project/opuc/backend` (Clean Architecture : model → repository → usecase → handler → router).
- Le modèle GORM `Equipement` existait déjà dans `internal/domain/model/carburant.go` mais avec des incohérences vs Prisma (`etat` default `ACTIF` au lieu de `BON`, `typeEquipement` typé `string` au lieu de `*string`).
- Le modèle `LocationEngin` n'existait pas côté GORM.
- Le frontend `frontend/src/components/engins/engins-view.tsx` appelle déjà les URLs `/api/v1/engins*` et `/api/v1/locations*` (corrigées en Phase A).
- Référence : pattern de `chantier` (model + repo + usecase + handler + dto).

## Lecture du contrat frontend (engins-view.tsx)
- `GET /api/v1/engins?search=&typeLocation=&chantierId=&page=&pageSize=` → `{ engins: [...], kpi: {totalEngins, enginsPropres, enginsLoues} }` avec `_count.locations` par engin.
- `POST /api/v1/engins` body `{ designation, typeEquipement|null, marque|null, modele|null, immatriculation|null, etat, typeLocation }`.
- `PUT /api/v1/engins/{id}` body idem POST (tous les champs, null = clear).
- `DELETE /api/v1/engins/{id}`.
- `GET /api/v1/locations?search=&statut=&chantierId=` → `{ locations: [...], kpi: {locationsEnCours, coutTotalEnCours, coutJournalierMoyen, locationsCeMois} }` avec relations equipement/fournisseur/chantier.
- `POST /api/v1/locations` body `{ equipementId, fournisseurId|null, fournisseurNom|null, fournisseurTel|null, numeroContrat|null, chantierId|null, coutJournalier, coutTransport, coutOperateur, caution, dateDebut, dateFin|null, statut, conditions|null }`.
- `PUT /api/v1/locations/{id}` body partial (utilisé aussi pour clôture via `{statut:"TERMINE"}` ou `{statut:"ANNULE"}` — ligne 751).
- `DELETE /api/v1/locations/{id}`.

## Fichiers créés (5)

### 1. `internal/domain/model/engin.go` (nouveau)
Modèle GORM `LocationEngin` :
- Tous les champs Prisma (camelCase columns) : id, equipementId, fournisseurId?, fournisseurNom?, fournisseurTel?, numeroContrat?, chantierId?, coutJournalier, coutTransport (default 0), coutOperateur (default 0), caution (default 0), dateDebut, dateFin?, statut (default "EN_COURS"), conditions?, createdAt, updatedAt.
- Relations (lazy) : `Equipement *Equipement`, `Fournisseur *SousTraitant`, `Chantier *Chantier`.
- TableName "LocationEngin".

### 2. `internal/usecase/engin/engin.go` (nouveau, ~700 lignes)
- Interface `Repo` : 14 méthodes (CRUD Equipement + CRUD LocationEngin + counts batch + KPIs).
- Inputs/outputs typés : ListEquipementsInput, ListLocationsInput, CreateEquipementInput, UpdateEquipementInput, CreateLocationInput, UpdateLocationInput, EnginKPI, LocationKPI, ListEquipementsOutput, ListLocationsOutput.
- Usecase avec validation :
  - etat ∈ {BON, EN_REPARATION, HORS_SERVICE}
  - typeLocation ∈ {PROPRE, LOCATION}
  - statut location ∈ {EN_COURS, TERMINE, ANNULE}
  - dateFin >= dateDebut, coutJournalier >= 0
- RLS : non-SUPER_ADMIN force `EntrepriseID = auth.EntrepriseID`.
- UpdateEquipement : empty string pour champ nullable → SET NULL (frontend envoie null → handler convertit en `&""` → usecase convertit en `nil` dans le map updates).
- UpdateLocation : idem (vide → SET NULL pour les champs nullable).
- DeleteEquipement : bloque avec `ErrConflict` si locations liées (données comptables — pas de cascade).
- CreateLocation : vérifie l'existence de l'equipement (RLS-filtered) avant insertion.

### 3. `internal/repository/gorm/engin_repo.go` (nouveau, ~460 lignes)
`EnginRepository` implémente `engin.Repo` (compile-time check).
- Equipement : RLS direct (WithTenant suffit).
- LocationEngin : filtrage tenant via `JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`.
- `ListEquipements` : filtres search (ILIKE designation/marque/modele/immatriculation), typeLocation, chantierId (subquery `id IN (SELECT "equipementId" FROM "LocationEngin" WHERE "chantierId" = ?)`).
- `CountLocationsByEquipements` : batch GROUP BY equipementId (évite N+1 sur List).
- `CountEquipementsByTypeLocation` : `COALESCE("typeLocation", '')` + GROUP BY pour KPI.
- `ListLocations` : Preload Equipement + Fournisseur + Chantier (relations respectent RLS car queries dans même tx).
- `LocationKPIs` : agrégation SQL en 1 seule query (COALESCE + SUM/CASE WHEN) pour les 4 KPIs.
- `Create/Update/Delete` : ID généré via `newCuidLikeID()`. CreateLocation recharge avec Preload pour retourner la réponse complète.

### 4. `internal/delivery/http/dto/engin_dto.go` (nouveau)
- `EnginWithCount` : embeds `model.Equipement` + `_count: { locations: N }`.
- `EnginKPIResponse` : `{ totalEngins, enginsPropres, enginsLoues }`.
- `EnginListResponse` : `{ engins: [...], kpi: {...} }`.
- `LocationItem` : flat DTO avec equipement/fournisseur/chantier réduits (matching exact du contrat frontend Next.js).
- `LocationKPIResponse` : `{ locationsEnCours, coutTotalEnCours, coutJournalierMoyen, locationsCeMois }`.
- `LocationListResponse` : `{ locations: [...], kpi: {...} }`.
- Helper `ToLocationItem(*model.LocationEngin) LocationItem` pour la conversion model → DTO.

### 5. `internal/delivery/http/handler/engin_handler.go` (nouveau)
`EnginHandler` avec 8 méthodes HTTP :
- `ListEngins`, `CreateEngin`, `UpdateEngin`, `DeleteEngin`.
- `ListLocations`, `CreateLocation`, `UpdateLocation`, `DeleteLocation`.
- Extraction query params via `r.URL.Query().Get()` + `atoiDefault()` (helper existant).
- Parsing body JSON en `map[string]any` puis conversion via `parseEnginCreateInput`, `parseEnginUpdateInput`, `parseLocationCreateInput`, `parseLocationUpdateInput`.
- Helper `stringPtrFromRaw(raw, key)` : absent → nil (pas d'update), null → &"" (clear via SET NULL côté usecase), string → &string.
- Helper `writeEnginError` : mappe domain errors → HTTP (404 NotFound, 401 Unauthorized, 400 BadRequest, 409 Conflict, 500 Internal).

## Fichiers modifiés (3)

### 1. `internal/domain/model/carburant.go`
- `Equipement.Etat` default `ACTIF` → `BON` (alignement Prisma + frontend : BON, EN_REPARATION, HORS_SERVICE).
- `Equipement.TypeEquipement` typé `string` → `*string` (alignement Prisma `String?` + frontend `string | null`).
- Ajouté relation `Locations []LocationEngin` (lazy, `foreignKey:EquipementID`).
- Note : le repo carburant existant ne référence pas `TypeEquipement` directement → pas de breaking change.

### 2. `internal/delivery/http/router.go`
- Ajouté `Engin *handler.EnginHandler` au struct `Deps` (après Personnel).
- Ajouté bloc routes après /personnel (avant /dashboard) :
  - GET /engins (LECTURE), POST /engins (ECRITURE), PUT /engins/{id} (ECRITURE), DELETE /engins/{id} (ECRITURE).
  - GET /locations (LECTURE), POST /locations (ECRITURE), PUT /locations/{id} (ECRITURE), DELETE /locations/{id} (ECRITURE).
- RBAC : `RequireAccess(model.DomainLogistique, model.PermLecture|Ecriture, d.DelegationRepo)` (le domaine LOGISTIQUE couvre stocks + carburant + engins + sous-traitants selon `delegation.go`).

### 3. `main.go`
- Import `"opuc/internal/usecase/engin"`.
- Repository : `enginRepo := gorm.NewEnginRepository(dbm.Runtime)`.
- Usecase : `enginUC := engin.NewUsecase(enginRepo, log)`.
- Handler : `enginHandler := handler.NewEnginHandler(enginUC, log)`.
- Deps{} : `Engin: enginHandler`.

## Endpoints implémentés (8)

| # | Méthode | Route | RBAC | Description |
|---|---------|-------|------|-------------|
| 1 | GET | /api/v1/engins | LOGISTIQUE/LECTURE | Liste paginée + KPI + _count.locations par engin |
| 2 | POST | /api/v1/engins | LOGISTIQUE/ECRITURE | Création équipement |
| 3 | PUT | /api/v1/engins/{id} | LOGISTIQUE/ECRITURE | Update partial (null = clear) |
| 4 | DELETE | /api/v1/engins/{id} | LOGISTIQUE/ECRITURE | Hard delete (409 si locations liées) |
| 5 | GET | /api/v1/locations | LOGISTIQUE/LECTURE | Liste filtrée + KPI + Preload equipement/fournisseur/chantier |
| 6 | POST | /api/v1/locations | LOGISTIQUE/ECRITURE | Création location + vérif equipement |
| 7 | PUT | /api/v1/locations/{id} | LOGISTIQUE/ECRITURE | Update partial + clôture via {statut:"TERMINE"} |
| 8 | DELETE | /api/v1/locations/{id} | LOGISTIQUE/ECRITURE | Hard delete |

## KPIs calculés
- **Engins** : totalEngins, enginsPropres (typeLocation=PROPRE), enginsLoues (typeLocation=LOCATION).
- **Locations** : locationsEnCours (statut=EN_COURS), coutTotalEnCours (SUM(coutJournalier) WHERE statut=EN_COURS), coutJournalierMoyen (AVG(coutJournalier) WHERE statut=EN_COURS), locationsCeMois (COUNT WHERE createdAt >= début du mois UTC).

## Validation
- `export PATH=~/go-sdk/bin:$PATH` (Go 1.23.4 linux/amd64).
- `cd /home/z/my-project/opuc/backend && go build -o /tmp/opuc-test .` : ✅ exit 0 (binary `/tmp/opuc-test` généré).
- `go vet ./...` : ✅ exit 0 (aucun warning).

## Notes / Décisions
- **Clôture location** : la consigne mentionnait `POST /api/v1/locations/{id}` mais le frontend `engins-view.tsx` ligne 751 fait `PUT /api/v1/locations/${locationId}` avec body `{statut: newStatut}`. Implémenté via `UpdateLocation` (PUT) — pas de route POST /locations/{id} nécessaire. La clôture se fait via `PUT /api/v1/locations/{id}` avec body `{statut:"TERMINE"}` ou `{statut:"ANNULE"}`.
- **`typeEquipement` type** : changé de `string` à `*string` dans le modèle GORM pour aligner avec Prisma `String?` et le frontend `string | null`. Le repo carburant existant ne référence pas ce champ → pas de breaking change côté carburant.
- **`etat` default** : changé de `ACTIF` à `BON` pour aligner avec Prisma et le frontend (BON, EN_REPARATION, HORS_SERVICE). N'affecte que les nouvelles insertions (lignes existantes non modifiées en DB).
- **`DeleteEquipement`** : pas de cascade — bloque avec 409 si locations liées (données comptables : le frontend doit d'abord supprimer les locations).
- **Non commit/push** — le tuteur s'en chargera.
