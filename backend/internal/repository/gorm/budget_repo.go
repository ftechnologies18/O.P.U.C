// Package gorm — budget_repo.go
// Repository pour l'agrégation des coûts d'un chantier (PHASE-B-BUDGET).
//
// Implémente budget.Repo en agrégeant les données depuis 5 tables existantes :
//
//   - Chantier         (RLS direct)              → budgetPrevisionnel
//   - PaiementHebdo    (RLS via JOIN Chantier)   → coutPersonnel (montantVerse)
//   - SalaireMensuel   (RLS via JOIN Journalier) → coutPersonnel (netAPayer)
//   - EntreeStock      (RLS via JOIN Chantier)   → coutMateriaux (quantite * prixUnitaire)
//   - ContratST        (RLS via JOIN SousTraitant) → coutSousTraitants (montantHT)
//   - LocationEngin    (RLS via JOIN Equipement) → coutLocations (coutJournalier * duree
//   - coutTransport + coutOperateur)
//
// Toutes les méthodes utilisent database.WithTenant pour activer le RLS.
// Si le chantier n'appartient pas au tenant, les SUM renvoient 0 (les JOIN
// RLS-protected filtrent les lignes) et GetChantier renvoie (0, false, nil).
package gorm

import (
	"context"
	"fmt"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/budget"

	"gorm.io/gorm"
)

// BudgetRepository — repository tenant-scoped pour l'agrégation des coûts.
type BudgetRepository struct {
	db *gorm.DB
}

// NewBudgetRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewBudgetRepository(runtimeDB *gorm.DB) *BudgetRepository {
	return &BudgetRepository{db: runtimeDB}
}

// compile-time check : BudgetRepository implémente budget.Repo.
var _ budget.Repo = (*BudgetRepository)(nil)

// GetChantier — retourne le budgetPrevisionnel du chantier + un flag `visible`.
//
// RLS direct sur Chantier : si le chantier n'appartient pas au tenant (ou
// n'existe pas), la query renvoie 0 ligne → visible=false.
//
// (0, false, nil) si non trouvé ou non visible (RLS).
// (budgetPrevisionnel, true, nil) si trouvé.
func (r *BudgetRepository) GetChantier(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, bool, error) {
	var c struct {
		BudgetPrevisionnel float64 `gorm:"column:budgetPrevisionnel"`
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Chantier{}).
			Select(`"budgetPrevisionnel"`).
			Where("id = ?", chantierID).
			Take(&c).Error
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, false, nil
		}
		return 0, false, err
	}
	return c.BudgetPrevisionnel, true, nil
}

// SumCoutPersonnel — SUM(PaiementHebdo.montantVerse) + SUM(SalaireMensuel.netAPayer)
// pour les journaliers affectés au chantier.
//
// RLS :
//   - PaiementHebdo : JOIN Chantier (RLS direct). Filtre direct sur chantierId.
//   - SalaireMensuel : JOIN Journalier (RLS direct) + WHERE journalierId IN
//     (SELECT journalierId FROM JournalierAffectation JOIN Chantier WHERE
//     chantierId = ?). La sous-requête JOIN Chantier pour activer le RLS sur
//     la table d'affectation (qui n'a pas de RLS direct).
//
// montantVerse est nullable (*float64) → COALESCE(montantVerse, 0).
//
// Retourne 0 si aucune donnée.
func (r *BudgetRepository) SumCoutPersonnel(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error) {
	var paieHebdoTotal float64
	var salaireMensuelTotal float64

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// 1. SUM(PaiementHebdo.montantVerse) WHERE chantierId = ?
		// RLS via JOIN Chantier.
		if err := tx.Model(&model.PaiementHebdo{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "PaiementHebdo"."chantierId"`).
			Where(`"PaiementHebdo"."chantierId" = ?`, chantierID).
			Select(`COALESCE(SUM("PaiementHebdo"."montantVerse"), 0) AS total`).
			Row().Scan(&paieHebdoTotal); err != nil {
			return fmt.Errorf("sum paiementHebdo: %w", err)
		}

		// 2. SUM(SalaireMensuel.netAPayer) pour les journaliers affectés au chantier.
		// RLS via JOIN Journalier. Filtre chantier via IN subquery (qui JOIN Chantier
		// pour RLS).
		if err := tx.Model(&model.SalaireMensuel{}).
			Joins(`JOIN "Journalier" ON "Journalier".id = "SalaireMensuel"."journalierId"`).
			Where(`"SalaireMensuel"."journalierId" IN (
                                SELECT "JournalierAffectation"."journalierId"
                                FROM "JournalierAffectation"
                                JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"
                                WHERE "JournalierAffectation"."chantierId" = ?
                        )`, chantierID).
			Select(`COALESCE(SUM("SalaireMensuel"."netAPayer"), 0) AS total`).
			Row().Scan(&salaireMensuelTotal); err != nil {
			return fmt.Errorf("sum salaireMensuel: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return paieHebdoTotal + salaireMensuelTotal, nil
}

// SumCoutMateriaux — SUM(EntreeStock.quantite * EntreeStock.prixUnitaire).
//
// RLS via JOIN Chantier. Filtre direct sur chantierId.
// Retourne 0 si aucune donnée.
func (r *BudgetRepository) SumCoutMateriaux(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error) {
	var total float64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		if err := tx.Model(&model.EntreeStock{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeStock"."chantierId"`).
			Where(`"EntreeStock"."chantierId" = ?`, chantierID).
			Select(`COALESCE(SUM("EntreeStock".quantite * "EntreeStock"."prixUnitaire"), 0) AS total`).
			Row().Scan(&total); err != nil {
			return fmt.Errorf("sum entreeStock: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// SumCoutSousTraitants — SUM(ContratST.montantHT).
//
// RLS via JOIN SousTraitant (ContratST n'a pas de RLS direct).
// Filtre direct sur chantierId (ContratST.chantierId).
// Retourne 0 si aucune donnée.
func (r *BudgetRepository) SumCoutSousTraitants(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error) {
	var total float64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		if err := tx.Model(&model.ContratST{}).
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST"."chantierId" = ?`, chantierID).
			Select(`COALESCE(SUM("ContratST"."montantHT"), 0) AS total`).
			Row().Scan(&total); err != nil {
			return fmt.Errorf("sum contratST: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// SumCoutLocations — SUM(coutJournalier * dureeJours + coutTransport + coutOperateur)
// pour chaque LocationEngin du chantier.
//
// dureeJours = EXTRACT(EPOCH FROM (COALESCE(dateFin, NOW()) - dateDebut)) / 86400
// avec un minimum de 1 jour (location sur 1 journée comptée comme 1 jour).
//
// RLS via JOIN Equipement (LocationEngin n'a pas de RLS direct).
// Filtre sur chantierId (LocationEngin.chantierId, qui est nullable — on
// exclut les NULL via la condition WHERE = ?).
// Retourne 0 si aucune donnée.
func (r *BudgetRepository) SumCoutLocations(ctx context.Context, auth *database.AuthUser, chantierID string) (float64, error) {
	var total float64
	// GREATEST(duree, 1) : une location sur 0 ou 1 jour compte comme 1 jour.
	// COALESCE(dateFin, NOW()) : si la location n'est pas clôturée, on compte
	// jusqu'à maintenant.
	dureeExpr := `GREATEST(EXTRACT(EPOCH FROM (COALESCE("LocationEngin"."dateFin", NOW()) - "LocationEngin"."dateDebut")) / 86400, 1)`
	cexpr := `("LocationEngin"."coutJournalier" * ` + dureeExpr + `) + "LocationEngin"."coutTransport" + "LocationEngin"."coutOperateur"`

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		if err := tx.Model(&model.LocationEngin{}).
			Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
			Where(`"LocationEngin"."chantierId" = ?`, chantierID).
			Select(`COALESCE(SUM(` + cexpr + `), 0) AS total`).
			Row().Scan(&total); err != nil {
			return fmt.Errorf("sum locationEngin: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return total, nil
}

// Historique — agrégat mensuel (YYYY-MM) des coûts toutes catégories confondues
// pour l'année `annee`.
//
// Utilise une UNION ALL de 4 sous-requêtes (PaiementHebdo, SalaireMensuel,
// EntreeStock, ContratST, LocationEngin), chacune avec son RLS JOIN approprié,
// puis GROUP BY mois + SUM(montant).
//
// Dates utilisées pour le regroupement par mois :
//   - PaiementHebdo   : COALESCE(datePaiement, createdAt)
//   - SalaireMensuel  : createdAt
//   - EntreeStock     : dateEntree
//   - ContratST       : createdAt
//   - LocationEngin   : dateDebut
//
// Le résultat est trié par mois croissant. Retourne []vide si aucune donnée
// (jamais nil — le usecase garantit un slice non-nil pour la sérialisation JSON).
func (r *BudgetRepository) Historique(ctx context.Context, auth *database.AuthUser, chantierID string, annee int) ([]budget.HistoriqueItem, error) {
	// Expression pour la durée d'une location (cf. SumCoutLocations).
	dureeExpr := `GREATEST(EXTRACT(EPOCH FROM (COALESCE("LocationEngin"."dateFin", NOW()) - "LocationEngin"."dateDebut")) / 86400, 1)`
	locMontantExpr := `("LocationEngin"."coutJournalier" * ` + dureeExpr + `) + "LocationEngin"."coutTransport" + "LocationEngin"."coutOperateur"`

	// Note : on utilise SELECT ... FROM (...) AS combined pour pouvoir faire le
	// GROUP BY sur l'union. Les colonnes internes (date, montant) sont exposées
	// au SELECT externe.
	//
	// On filtre EXTRACT(YEAR FROM date) = ? à l'extérieur pour n'avoir à écrire
	// le filtre qu'une seule fois (au lieu de le répéter dans chaque sous-requête).
	sql := `
                SELECT TO_CHAR(d.date, 'YYYY-MM') AS mois, COALESCE(SUM(d.montant), 0) AS cout
                FROM (
                        SELECT COALESCE("PaiementHebdo"."datePaiement", "PaiementHebdo"."createdAt") AS date,
                               COALESCE("PaiementHebdo"."montantVerse", 0) AS montant
                        FROM "PaiementHebdo"
                        JOIN "Chantier" ON "Chantier".id = "PaiementHebdo"."chantierId"
                        WHERE "PaiementHebdo"."chantierId" = ?

                        UNION ALL

                        SELECT "SalaireMensuel"."createdAt" AS date,
                               "SalaireMensuel"."netAPayer" AS montant
                        FROM "SalaireMensuel"
                        JOIN "Journalier" ON "Journalier".id = "SalaireMensuel"."journalierId"
                        WHERE "SalaireMensuel"."journalierId" IN (
                                SELECT "JournalierAffectation"."journalierId"
                                FROM "JournalierAffectation"
                                JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"
                                WHERE "JournalierAffectation"."chantierId" = ?
                        )

                        UNION ALL

                        SELECT "EntreeStock"."dateEntree" AS date,
                               ("EntreeStock".quantite * "EntreeStock"."prixUnitaire") AS montant
                        FROM "EntreeStock"
                        JOIN "Chantier" ON "Chantier".id = "EntreeStock"."chantierId"
                        WHERE "EntreeStock"."chantierId" = ?

                        UNION ALL

                        SELECT "ContratST"."createdAt" AS date,
                               "ContratST"."montantHT" AS montant
                        FROM "ContratST"
                        JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"
                        WHERE "ContratST"."chantierId" = ?

                        UNION ALL

                        SELECT "LocationEngin"."dateDebut" AS date,
                               ` + locMontantExpr + ` AS montant
                        FROM "LocationEngin"
                        JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"
                        WHERE "LocationEngin"."chantierId" = ?
                ) AS d
                WHERE EXTRACT(YEAR FROM d.date) = ?
                GROUP BY mois
                ORDER BY mois ASC
        `

	type row struct {
		Mois string  `gorm:"column:mois"`
		Cout float64 `gorm:"column:cout"`
	}
	var rows []row

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Raw(sql, chantierID, chantierID, chantierID, chantierID, chantierID, annee).
			Scan(&rows).Error
	})
	if err != nil {
		return nil, fmt.Errorf("historique budget: %w", err)
	}

	out := make([]budget.HistoriqueItem, 0, len(rows))
	for i := range rows {
		out = append(out, budget.HistoriqueItem{
			Mois: rows[i].Mois,
			Cout: rows[i].Cout,
		})
	}
	return out, nil
}
