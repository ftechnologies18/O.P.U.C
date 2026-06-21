// Package budget — usecase pour l'agrégation des coûts d'un chantier (PHASE-B-BUDGET).
//
// Calcule la structure BudgetData attendue par le frontend
// (frontend/src/components/budget/budget-view.tsx) :
//
//   - budgetPrevisionnel : depuis Chantier.budgetPrevisionnel
//   - coutPersonnel      : SUM(PaiementHebdo.montantVerse)
//   - SUM(SalaireMensuel.netAPayer)
//     pour les journaliers affectés au chantier
//   - coutMateriaux      : SUM(EntreeStock.quantite * EntreeStock.prixUnitaire)
//   - coutSousTraitants  : SUM(ContratST.montantHT)
//   - coutLocations      : SUM(LocationEngin.coutJournalier * dureeJours
//   - coutTransport + coutOperateur)
//   - coutTotal          : somme des 4 catégories
//   - ecart              : budgetPrevisionnel - coutTotal
//   - ecartPourcentage   : (ecart / budgetPrevisionnel) * 100
//     (0 si budgetPrevisionnel = 0).
//     Interprétation : % du budget RESTANT
//     (positif = marge, négatif = dépassement).
//   - niveauAlerte       : "OK" si ecartPourcentage > 20,
//     "ATTENTION" si 0 <= ecartPourcentage <= 20,
//     "CRITIQUE" si ecartPourcentage < 0
//   - historique         : agrégat des coûts par mois (YYYY-MM) sur l'année courante
//   - repartition        : 4 catégories avec leur montant + pourcentage du coutTotal
//
// Toutes les requêtes sont tenant-scoped via RLS (database.WithTenant).
// Si le chantier n'existe pas ou n'est pas visible (RLS), retourne ErrNotFound.
// Si le chantier existe mais n'a aucune donnée, retourne des zéros (pas d'erreur).
//
// RBAC : le handler applique RequireAccess(model.DomainFinance, model.PermLecture)
// (le budget est un domaine financier).
package budget

import (
	"context"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/infrastructure/database"
)

// BudgetData — structure agrégée des coûts d'un chantier.
// Alignée sur le contrat wire du frontend (cf. budget-view.tsx).
type BudgetData struct {
	BudgetPrevisionnel float64           `json:"budgetPrevisionnel"`
	CoutPersonnel      float64           `json:"coutPersonnel"`
	CoutMateriaux      float64           `json:"coutMateriaux"`
	CoutSousTraitants  float64           `json:"coutSousTraitants"`
	CoutLocations      float64           `json:"coutLocations"`
	CoutTotal          float64           `json:"coutTotal"`
	Ecart              float64           `json:"ecart"`
	EcartPourcentage   float64           `json:"ecartPourcentage"`
	NiveauAlerte       string            `json:"niveauAlerte"`
	Historique         []HistoriqueItem  `json:"historique"`
	Repartition        []RepartitionItem `json:"repartition"`
}

// HistoriqueItem — coût agrégé pour un mois (format "YYYY-MM").
type HistoriqueItem struct {
	Mois string  `json:"mois"`
	Cout float64 `json:"cout"`
}

// RepartitionItem — montant + pourcentage d'une catégorie par rapport au coutTotal.
type RepartitionItem struct {
	Categorie   string  `json:"categorie"`
	Reel        float64 `json:"reel"`
	Pourcentage float64 `json:"pourcentage"`
}

// Repo — interface définie côté usecase. Implémentée par gorm.BudgetRepository.
//
// Toutes les méthodes acceptent un *database.AuthUser pour activer le RLS :
//   - SUPER_ADMIN → voit toutes les entreprises (RLS bypass)
//   - autres rôles → ne voit que son entrepriseId
//
// Le chantierID est passé en paramètre : toutes les requêtes sont filtrées par
// ce chantier. Si le chantier n'est pas visible (RLS), les méthodes renvoient
// des zéros — sauf GetChantier qui renvoie (nil, nil) pour signaler le 404.
type Repo interface {
	// GetChantier — fetch le chantier par ID (RLS direct sur Chantier).
	// Retourne (nil, nil) si non trouvé ou non visible (RLS).
	GetChantier(ctx context.Context, auth *database.AuthUser, chantierID string) (budgetPrevisionnel float64, visible bool, err error)

	// SumCoutPersonnel — SUM(PaiementHebdo.montantVerse) + SUM(SalaireMensuel.netAPayer)
	// pour ce chantier. RLS via JOIN Chantier (PaiementHebdo) et JOIN Journalier +
	// JournalierAffectation (SalaireMensuel).
	SumCoutPersonnel(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error)

	// SumCoutMateriaux — SUM(EntreeStock.quantite * EntreeStock.prixUnitaire).
	// RLS via JOIN Chantier.
	SumCoutMateriaux(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error)

	// SumCoutSousTraitants — SUM(ContratST.montantHT).
	// RLS via JOIN SousTraitant (ContratST n'a pas de RLS direct).
	SumCoutSousTraitants(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error)

	// SumCoutLocations — SUM(coutJournalier * dureeJours + coutTransport + coutOperateur)
	// pour chaque LocationEngin du chantier. RLS via JOIN Equipement.
	SumCoutLocations(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error)

	// Historique — agrégat mensuel (YYYY-MM) des coûts toutes catégories confondues
	// pour l'année courante. Trié par mois croissant.
	Historique(ctx context.Context, auth *database.AuthUser, chantierID string, annee int) ([]HistoriqueItem, error)
}

// Usecase — cas d'usage pour le budget d'un chantier.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// Get — calcule la structure BudgetData pour un chantier.
//
// Étapes :
//  1. Vérifier l'existence + visibilité du chantier (RLS direct).
//     Si non visible → ErrNotFound (404 côté handler).
//  2. Sommer les coûts par catégorie (personnel, matériaux, sous-traitants, locations).
//  3. Calculer le total + écart + pourcentage + niveau d'alerte.
//  4. Récupérer l'historique mensuel (année courante).
//  5. Construire la répartition par catégorie.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, chantierID string) (*BudgetData, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if chantierID == "" {
		return nil, domain.ErrBadRequest
	}

	// 1. Vérifier l'existence + visibilité du chantier.
	budgetPrev, visible, err := uc.repo.GetChantier(ctx, auth, chantierID)
	if err != nil {
		uc.log.Error("budget.Get: GetChantier", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}
	if !visible {
		return nil, domain.ErrNotFound
	}

	// 2. Sommer les coûts par catégorie.
	// Toutes les méthodes renvoient 0 si aucune donnée (pas d'erreur).
	coutPersonnel, err := uc.repo.SumCoutPersonnel(ctx, auth, chantierID)
	if err != nil {
		uc.log.Error("budget.Get: SumCoutPersonnel", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}

	coutMateriaux, err := uc.repo.SumCoutMateriaux(ctx, auth, chantierID)
	if err != nil {
		uc.log.Error("budget.Get: SumCoutMateriaux", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}

	coutSousTraitants, err := uc.repo.SumCoutSousTraitants(ctx, auth, chantierID)
	if err != nil {
		uc.log.Error("budget.Get: SumCoutSousTraitants", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}

	coutLocations, err := uc.repo.SumCoutLocations(ctx, auth, chantierID)
	if err != nil {
		uc.log.Error("budget.Get: SumCoutLocations", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}

	// 3. Calculs dérivés.
	coutTotal := coutPersonnel + coutMateriaux + coutSousTraitants + coutLocations
	ecart := budgetPrev - coutTotal

	ecartPourcentage := 0.0
	if budgetPrev > 0 {
		// ecartPourcentage = (ecart / budgetPrevisionnel) * 100
		// = % du budget RESTANT (positif = encore de la marge,
		// négatif = dépassement).
		ecartPourcentage = (ecart / budgetPrev) * 100
	}

	niveauAlerte := niveauAlerteFromPourcentage(ecartPourcentage)

	// 4. Historique mensuel (année courante).
	anneeCourante := currentYear()
	historique, err := uc.repo.Historique(ctx, auth, chantierID, anneeCourante)
	if err != nil {
		uc.log.Error("budget.Get: Historique", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}
	if historique == nil {
		historique = []HistoriqueItem{}
	}

	// 5. Répartition par catégorie.
	repartition := buildRepartition(coutPersonnel, coutMateriaux, coutSousTraitants, coutLocations, coutTotal)

	return &BudgetData{
		BudgetPrevisionnel: budgetPrev,
		CoutPersonnel:      coutPersonnel,
		CoutMateriaux:      coutMateriaux,
		CoutSousTraitants:  coutSousTraitants,
		CoutLocations:      coutLocations,
		CoutTotal:          coutTotal,
		Ecart:              ecart,
		EcartPourcentage:   ecartPourcentage,
		NiveauAlerte:       niveauAlerte,
		Historique:         historique,
		Repartition:        repartition,
	}, nil
}

// niveauAlerteFromPourcentage — détermine le niveau d'alerte en fonction du
// % du budget RESTANT (ecartPourcentage = (ecart / budgetPrev) * 100).
//
// Conventions (alignées sur le spec PHASE-B-BUDGET) :
//   - "OK"         : ecartPourcentage > 20 (plus de 20% du budget restant)
//   - "ATTENTION"  : 0 <= ecartPourcentage <= 20 (proche du budget)
//   - "CRITIQUE"   : ecartPourcentage < 0 (dépassement de budget)
//
// Note : si budgetPrevisionnel = 0, ecartPourcentage = 0 → "ATTENTION"
// (par convention — pas de budget défini = situation à vérifier).
func niveauAlerteFromPourcentage(pct float64) string {
	switch {
	case pct < 0:
		return "CRITIQUE"
	case pct <= 20:
		return "ATTENTION"
	default:
		return "OK"
	}
}

// buildRepartition — construit la liste des 4 catégories avec leur montant et
// pourcentage du coutTotal. Si coutTotal = 0, tous les pourcentages sont à 0.
func buildRepartition(coutPersonnel, coutMateriaux, coutSousTraitants, coutLocations, coutTotal float64) []RepartitionItem {
	pct := func(val float64) float64 {
		if coutTotal <= 0 {
			return 0
		}
		return (val / coutTotal) * 100
	}
	return []RepartitionItem{
		{Categorie: "Personnel", Reel: coutPersonnel, Pourcentage: pct(coutPersonnel)},
		{Categorie: "Matériaux", Reel: coutMateriaux, Pourcentage: pct(coutMateriaux)},
		{Categorie: "Sous-traitants", Reel: coutSousTraitants, Pourcentage: pct(coutSousTraitants)},
		{Categorie: "Locations", Reel: coutLocations, Pourcentage: pct(coutLocations)},
	}
}

// currentYear retourne l'année courante (UTC).
// Helper isolé pour faciliter les tests futurs.
func currentYear() int {
	return time.Now().UTC().Year()
}
