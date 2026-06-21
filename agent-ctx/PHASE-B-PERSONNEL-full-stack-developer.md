# PHASE-B-PERSONNEL — full-stack-developer

## Task
Créer le module backend Personnel (journaliers + affectations) complet.
- 7 endpoints à implémenter (4 CRUD journalier + 3 affectations).
- RBAC : RequireAccess(DomainRH, PermLecture) pour GET, PermEcriture pour POST/PUT/DELETE.
- Modèles GORM existants dans notification.go (Journalier + JournalierAffectation) — à étendre pour matcher le schéma Prisma.

## Work Done

### Fichiers créés
1. **`internal/domain/model/personnel.go`** (70 lignes) — Modèles Journalier + JournalierAffectation déplacés depuis notification.go et étendus pour matcher le schéma Prisma :
   - Ajouté : `Prenom` (de `*string` → `string` NOT NULL), `Specialite`, `Photo`, `TypeContrat`, `TauxJournalier`, `SalaireMensuel`, `DateDebutContrat`, `DateFinContrat`, `StatutContrat` (renommé depuis `Statut`), `NumeroCNPS`, `NbCongesRestants`, `Poste`, `Departement`.
   - Ajouté relation `Affectations []JournalierAffectation` sur Journalier (Preload).
   - Gardé la structure de JournalierAffectation (ID, JournalierID, ChantierID, DateDebut, DateFin, Actif, Journalier*, Chantier*).

2. **`internal/usecase/personnel/personnel.go`** (~570 lignes) — Usecase complet :
   - Interface `Repo` avec 12 méthodes (List, GetByID, Create, Update, Delete, CountKPI, CountNonAffecte, ListAffectationsByJournalier, CreateAffectation, DeleteAffectation, DeleteAffectationByChantier, ChantierExists).
   - Structs `ListInput`, `CreateInput`, `UpdateInput`, `CreateAffectationInput`, `KPICounts`, `KPI`, `ListOutput`.
   - Constantes de validation : `validTypeContrats` (JOURNALIER, CDD, CDI, STAGIAIRE), `validStatutsContrat` (ACTIF, ESSAI, TERMINE, SUSPENDU).
   - Mapping `specialitesByPhase` (GROS_OEUVRE, ENVELOPPE, SECOND_OEUVRE) — 21 spécialités BTP alignées sur PHASE_GROUPS du frontend.
   - 7 méthodes Usecase : List, Get, Create, Update, Delete, ListAffectations, CreateAffectation, DeleteAffectation, DeleteAffectationByChantier.
   - Validation : nom + prenom requis, typeContrat + statutContrat doivent être dans les enums valides, dateFinContrat >= dateDebutContrat.
   - Résolution entrepriseId : forcé à auth.EntrepriseID pour non-SUPER_ADMIN (RLS WITH CHECK).
   - CreateAffectation : vérifie l'existence du journalier (RLS direct) ET du chantier (RLS direct) avant l'INSERT.
   - Helper `SpecialitesForPhase` exporté pour le repo.

3. **`internal/repository/gorm/personnel_repo.go`** (~340 lignes) — Repository GORM :
   - `var _ personnel.Repo = (*PersonnelRepository)(nil)` (compile-time check).
   - **List** : pagination + filtres (search ILIKE nom/prenom/telephone, statutContrat, typeContrat, specialite single, specialites[] multiple IN ?, chantierId via subquery sur JournalierAffectation). Preload `Affectations.Chantier` (une seule query supplémentaire).
   - **GetByID** : Preload `Affectations.Chantier`. Retourne (nil, nil) si non trouvé.
   - **Create** : génère ID via `newCuidLikeID()`, force createdAt/updatedAt, defaults TypeContrat=JOURNALIER et StatutContrat=ACTIF.
   - **Update** : partial updates via `map[string]any` (Updates), force updatedAt, recharge avec Preload.
   - **Delete** : cascade delete JournalierAffectation (WHERE journalierId = ?) puis Journalier — idempotent.
   - **CountKPI** : une seule query SQL avec `COUNT(*) FILTER (WHERE ...)` pour total/journaliers/cdd/cdi/stagiaires/grosOeuvre/enveloppe/secondOeuvre. Placeholders dynamiques pour les listes de spécialités (`buildKPISQL` + `buildKPIArgs`).
   - **CountNonAffecte** : `NOT EXISTS (SELECT 1 FROM JournalierAffectation a WHERE a.journalierId = Journalier.id AND a.actif = true)` — implicitement tenant-scoped car outer Journalier est RLS-filtered.
   - **ListAffectationsByJournalier** : JOIN Chantier (RLS) + Preload Chantier, tri par dateDebut DESC NULLS LAST.
   - **CreateAffectation** : génère ID, force Actif=true, recharge avec Preload Chantier pour la réponse.
   - **DeleteAffectation** (by id) : JOIN Chantier pour RLS check, idempotent.
   - **DeleteAffectationByChantier** (by journalierId + chantierId) : JOIN Chantier pour RLS check, idempotent.
   - **ChantierExists** : count simple sur Chantier (RLS direct).
   - Toutes les méthodes utilisent `database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {...})`.

4. **`internal/delivery/http/handler/personnel_handler.go`** (~430 lignes) — Handlers HTTP :
   - 8 handlers : List, Create, Update, Delete, ListAffectations, CreateAffectation, DeleteAffectation (gère à la fois `/affectations/{affectationId}` et `/affectations?chantierId=X`).
   - Parsing JSON via `map[string]any` (gère dates string → *time.Time via `parseDate`).
   - Helper `parsePersonnelCreateInput` + `parsePersonnelUpdateInput` (extract toFloat64, toInt64, parseDate).
   - `writePersonnelError` : mapping ErrNotFound→404, ErrBadRequest→400, ErrUnauthorized→401, ErrConflict→409, default→500.
   - **DeleteAffectation** : un seul handler qui décide selon la présence de `chi.URLParam("affectationId")` vs `r.URL.Query().Get("chantierId")` — gère les deux formes d'URL supportées par le router.
   - Réponses : Create → 201, Update → 200, Delete → 200 {success: true, id}, ListAffectations → 200 {data: [...], total: N}, CreateAffectation → 201.

### Fichiers modifiés
5. **`internal/domain/model/notification.go`** — Supprimé les types Journalier + JournalierAffectation (déplacés vers personnel.go). Laisssé un commentaire de renvoi.

6. **`internal/delivery/http/router.go`** — Ajouté :
   - Champ `Personnel *handler.PersonnelHandler` à la struct Deps.
   - Bloc de 8 routes `/personnel*` avec RequireAccess(RH, LECTURE/ECRITURE). Declarées après le bloc Phase (ligne 327-355).

7. **`main.go`** — Ajouté :
   - Import `"opuc/internal/usecase/personnel"`.
   - `personnelRepo := gorm.NewPersonnelRepository(dbm.Runtime)`.
   - `personnelUC := personnel.NewUsecase(personnelRepo, log)`.
   - `personnelHandler := handler.NewPersonnelHandler(personnelUC, log)`.
   - `Personnel: personnelHandler` dans la struct `http.Deps{...}`.

## Endpoints implémentés (8 routes, dont 1 double forme pour DELETE affectation)
| # | Méthode | Path | RBAC | Description |
|---|---------|------|------|-------------|
| 1 | GET    | /api/v1/personnel | RH/LECTURE | Liste paginée + KPI agrégés |
| 2 | POST   | /api/v1/personnel | RH/ECRITURE | Crée un journalier |
| 3 | PUT    | /api/v1/personnel/{id} | RH/ECRITURE | Update partiel |
| 4 | DELETE | /api/v1/personnel/{id} | RH/ECRITURE | Hard delete + cascade affectations |
| 5 | GET    | /api/v1/personnel/{id}/affectations | RH/LECTURE | Liste affectations |
| 6 | POST   | /api/v1/personnel/{id}/affectations | RH/ECRITURE | Crée affectation (vérif FK journalier + chantier) |
| 7 | DELETE | /api/v1/personnel/{id}/affectations/{affectationId} | RH/ECRITURE | Suppr affectation by ID (path param) |
| 8 | DELETE | /api/v1/personnel/{id}/affectations?chantierId=X | RH/ECRITURE | Suppr affectation by (journalier,chantier) — forme utilisée par le frontend |

## Validation
- `go build -o /tmp/opuc-test .` → ✅ OK (binary 20.2MB)
- `go vet ./...` → ✅ OK (0 warnings)
- `gofmt -l` sur les 7 fichiers créés/modifiés → ✅ OK (vide = tous formatés)
- Smoke test : `JWT_SECRET=test DATABASE_URL=postgresql://fake MIGRATIONS_URL=postgresql://fake PORT=18080 /tmp/opuc-test` → démarre, log "starting O.P.U.C API", échoue sur connexion DB (attendu). Tous les wiring repo/usecase/handler/routes exécutés sans panic.

## Notes
- Le modèle GORM `Journalier` a été étendu pour matcher le schéma Prisma : 13 champs ajoutés (specialite, photo, typeContrat, tauxJournalier, salaireMensuel, dateDebutContrat, dateFinContrat, statutContrat, numeroCNPS, nbCongesRestants, poste, departement) + Prenom passé de `*string` à `string` (NOT NULL comme Prisma).
- Le champ `Statut` (ancien nom, valeurs ACTIF/INACTIF) a été renommé en `StatutContrat` (valeurs ACTIF/ESSAI/TERMINE/SUSPENDU) pour matcher Prisma. Aucun autre code ne référençait `Journalier.Statut` (vérifié via grep).
- Aucune modification au comportement existant de chantier_repo.go / dashboard_repo.go / paie_repo.go qui utilisent `model.JournalierAffectation` — la structure de JournalierAffectation est restée identique (ID, JournalierID, ChantierID, DateDebut, DateFin, Actif, relations).
- Le endpoint DELETE affectation supporte DEUX formes d'URL : path param `/affectations/{affectationId}` (API publique documentée) ET query param `?chantierId=X` (forme utilisée par le frontend `personnel-view.tsx:720`). Le handler `DeleteAffectation` décide selon la présence de l'URL param vs le query param.
- KPI agrégés en une seule query SQL `COUNT(*) FILTER (WHERE ...)` pour éviter N+1. La phase BTP (grosOeuvre/enveloppe/secondOeuvre) est déterminée par la spécialité du journalier via un mapping hardcodé `specialitesByPhase` (21 spécialités BTP alignées sur PHASE_GROUPS du frontend).
- Pré-existant (non mon œuvre) : module `engin` (PHASE-B-ENGINS) ajouté par un autre agent — wiring dans main.go/router.go + fichiers untracked dans usecase/engin, repository/gorm/engin_repo.go, handler/engin_handler.go, dto/engin_dto.go, model/engin.go. Le modèle `Equipement.TypeEquipement` a été changé de `string` à `*string` dans carburant.go (par l'agent engin) pour matcher Prisma `String?` — le build passe grâce à ce fix.
- Non commit/push — en attente de validation frontend.
