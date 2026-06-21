# PHASE-B-BUDGET — full-stack-developer

## Task
Endpoint backend `GET /api/v1/budget/{chantierId}` — agrégation des coûts d'un
chantier (Personnel + Matériaux + Sous-traitants + Locations) depuis les tables
existantes (PaiementHebdo, SalaireMensuel, EntreeStock, ContratST, LocationEngin).

## Contexte consulté
- `/home/z/my-project/opuc/worklog.md` — historique du projet (Phases 1-7 + PHASE-B-*)
- `internal/usecase/dashboard/dashboard.go` — pattern de référence (endpoint d'agrégation)
- `internal/repository/gorm/dashboard_repo.go` — pattern WithTenant + JOINs RLS
- `internal/repository/gorm/{pointage,paie,stock,soustraitant,engin}_repo.go` — patterns RLS par table
- `internal/domain/model/{chantier,paie,stock,soustraitant,engin,personnel,notification,carburant}.go` — modèles GORM
- `internal/infrastructure/database/tenant.go` — WithTenant (SET LOCAL ROLE app_user + set_config)
- `internal/domain/model/delegation.go` — DomainFinance + PermLecture + DomainModules["budget"]
- `internal/delivery/http/router.go` — pattern RequireAccess + structure Deps
- `frontend/src/components/budget/budget-view.tsx` — contrat wire attendu

## Architecture livrée

```
internal/usecase/budget/budget.go             (254 lignes) [nouveau]
  - BudgetData / HistoriqueItem / RepartitionItem (types alignés frontend)
  - Repo interface (6 méthodes : GetChantier + 4 SUM + Historique)
  - Usecase.Get(ctx, auth, chantierID) → *BudgetData
  - niveauAlerteFromPourcentage / buildRepartition / currentYear helpers

internal/repository/gorm/budget_repo.go       (300 lignes) [nouveau]
  - BudgetRepository implémentant budget.Repo (compile-time check)
  - Toutes les méthodes WithTenant + JOINs RLS appropriés
  - COALESCE(SUM(...), 0) pour garantir 0 si pas de données
  - Historique : 1 seule query SQL UNION ALL de 5 sources, GROUP BY mois

internal/delivery/http/handler/budget_handler.go  (94 lignes) [nouveau]
  - BudgetHandler.Get — GET /api/v1/budget/{chantierId}
  - Extraction AuthUser + chi.URLParam("chantierId")
  - writeBudgetError : 404/401/400/500 mapping

internal/delivery/http/router.go              [modifié]
  - Ajout `Budget *handler.BudgetHandler` au struct Deps
  - Route : r.With(RequireAccess(DomainFinance, PermLecture, ...)).
      Get("/budget/{chantierId}", d.Budget.Get)
  - Doc comment en tête de fichier

main.go                                        [modifié]
  - Import usecase/budget
  - budgetRepo := gorm.NewBudgetRepository(dbm.Runtime)
  - budgetUC := budget.NewUsecase(budgetRepo, log)
  - budgetHandler := handler.NewBudgetHandler(budgetUC, log)
  - Budget: budgetHandler dans Deps du NewRouter
```

## Formules

| Champ                | Formule |
|----------------------|---------|
| budgetPrevisionnel   | Chantier.budgetPrevisionnel WHERE id = ? (RLS direct) |
| coutPersonnel        | SUM(PaiementHebdo.montantVerse) WHERE chantierId = ?<br>+ SUM(SalaireMensuel.netAPayer) WHERE journalierId IN (SELECT journalierId FROM JournalierAffectation JOIN Chantier WHERE chantierId = ?) |
| coutMateriaux        | SUM(EntreeStock.quantite * EntreeStock.prixUnitaire) WHERE chantierId = ? |
| coutSousTraitants    | SUM(ContratST.montantHT) WHERE chantierId = ? |
| coutLocations        | SUM(coutJournalier * GREATEST(dureeJours, 1) + coutTransport + coutOperateur) WHERE chantierId = ?<br>avec dureeJours = EXTRACT(EPOCH FROM (COALESCE(dateFin, NOW()) - dateDebut)) / 86400 |
| coutTotal            | coutPersonnel + coutMateriaux + coutSousTraitants + coutLocations |
| ecart                | budgetPrevisionnel - coutTotal |
| ecartPourcentage     | (ecart / budgetPrevisionnel) * 100 (0 si budget = 0)<br>= % du budget RESTANT |
| niveauAlerte         | "OK" si > 20%, "ATTENTION" si 0-20%, "CRITIQUE" si < 0% |
| historique           | UNION ALL 5 sources, GROUP BY mois (YYYY-MM), filtre année courante |
| repartition          | 4 catégories avec montant + % du coutTotal |

## RLS JOINs par table

| Table            | RLS direct? | JOIN pour filtrage tenant |
|------------------|-------------|---------------------------|
| Chantier         | OUI         | (direct)                  |
| PaiementHebdo    | NON         | JOIN Chantier             |
| SalaireMensuel   | NON         | JOIN Journalier (RLS direct) |
| EntreeStock      | NON         | JOIN Chantier             |
| ContratST        | NON         | JOIN SousTraitant (RLS direct) |
| LocationEngin    | NON         | JOIN Equipement (RLS direct) |

## RBAC
- `RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)`
- Le budget est dans `DomainModules[DomainFinance] = {"facturation","contrats","paie","budget"}`
- Les délégations FINANCE/LECTURE actives permettent à un EMPLOYE d'accéder à l'endpoint.

## Codes HTTP
- 200 OK (BudgetData, même si tout à 0 — chantier sans donnée)
- 400 Bad Request (chantierId manquant)
- 401 Unauthorized (non authentifié)
- 404 Not Found (chantier introuvable ou non visible par RLS)
- 500 Internal Server Error (erreur DB)

## Validation
- `go build -o /tmp/opuc-test .` → exit 0 ✅
- `go vet ./...` → exit 0 ✅
- `gofmt -l` sur tous les fichiers modifiés → 0 fichiers mal formatés ✅

## Notes
- **Spec vs frontend** : le spec snippet JSON a une typo `"eccartPourcentage"` (double 'c').
  Le frontend utilise `ecartPourcentage` (single 'c'). J'ai utilisé `ecartPourcentage`
  pour matcher le frontend.
- **Spec vs frontend (interprétation)** : le spec dit `ecartPourcentage = (ecart / budgetPrevisionnel) * 100`
  ce qui donne le % RESTANT. Le frontend affiche cette valeur à côté du texte
  "X% du budget consommé" — c'est un bug frontend (le texte devrait dire "restant").
  Le backend suit strictement le spec.
- **SalaireMensuel filtre chantier** : SalaireMensuel n'a pas de chantierId direct.
  On filtre via `journalierId IN (SELECT journalierId FROM JournalierAffectation
  JOIN Chantier WHERE chantierId = ?)`. La sous-requête JOIN Chantier pour activer
  le RLS sur JournalierAffectation (qui n'a pas de RLS direct). Le JOIN Journalier
  sur SalaireMensuel garantit le filtrage tenant final (un journalierId d'un autre
  tenant serait filtré par RLS sur Journalier).
- **Historique SQL** : une seule query `SELECT ... FROM (UNION ALL ...) GROUP BY mois`
  évite 5 round-trips. La clause WHERE EXTRACT(YEAR FROM date) = ? est appliquée à
  l'extérieur de l'UNION pour ne l'écrire qu'une fois.
- **Zéros garantis** : toutes les SUM utilisent `COALESCE(SUM(...), 0)` → si le
  chantier existe mais n'a aucune donnée, on renvoie des 0 (pas d'erreur, pas de nil).
- Non commit/push — le tuteur s'en chargera.
