// Package gorm — personnel_repo.go
// Repository pour les journaliers + affectations (module PHASE-B-PERSONNEL).
//
// Tables :
//   - Journalier             (RLS-protected, policy tenant_isolation sur entrepriseId)
//   - JournalierAffectation  (PAS de RLS direct, filtrage via JOIN sur Chantier)
//
// ⚠️ RLS WITH CHECK : sur INSERT de Journalier, entrepriseId doit matcher
// app_current_tenant(). L'usecase force EntrepriseID = auth.EntrepriseID.
//
// Pour les affectations (pas de RLS), on JOIN sur "Chantier" qui est
// RLS-protected → si le chantierId n'appartient pas au tenant, le JOIN
// renvoie 0 lignes (filtre tenant effectif).
package gorm

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/personnel"

	"gorm.io/gorm"
)

// PersonnelRepository — repository tenant-scoped pour le personnel.
type PersonnelRepository struct {
	db *gorm.DB
}

// NewPersonnelRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewPersonnelRepository(runtimeDB *gorm.DB) *PersonnelRepository {
	return &PersonnelRepository{db: runtimeDB}
}

// compile-time check : PersonnelRepository implémente personnel.Repo.
var _ personnel.Repo = (*PersonnelRepository)(nil)

// ══════════════════════════════════════════════════════════════════
// Journalier — List, GetByID, Create, Update, Delete
// ══════════════════════════════════════════════════════════════════

// List — liste paginée des journaliers (RLS direct sur Journalier).
// Preload Affectations.Chantier pour la réponse (frontend utilise
// journalier.affectations[].chantier.nom).
//
// Filtres :
//   - search        : ILIKE sur nom, prenom, telephone
//   - statutContrat : filtre exact sur statutContrat
//   - typeContrat   : filtre exact sur typeContrat
//   - specialites[] : filtre OR sur specialite (IN ?)
//   - chantierId    : journaliers ayant une affectation active sur ce chantier
//     (subquery sur JournalierAffectation)
func (r *PersonnelRepository) List(ctx context.Context, auth *database.AuthUser, filter personnel.ListInput) ([]model.Journalier, int64, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	var (
		items []model.Journalier
		total int64
	)

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Journalier{})

		// Filtre search
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where(
				`nom ILIKE ? OR prenom ILIKE ? OR telephone ILIKE ?`,
				like, like, like,
			)
		}

		// Filtre statutContrat (supporte alias "statut" pour compat)
		if filter.StatutContrat != "" {
			q = q.Where(`"statutContrat" = ?`, filter.StatutContrat)
		}

		// Filtre typeContrat
		if filter.TypeContrat != "" {
			q = q.Where(`"typeContrat" = ?`, filter.TypeContrat)
		}

		// Filtre specialites (OR sur plusieurs valeurs)
		if len(filter.Specialites) > 0 {
			q = q.Where(`specialite IN ?`, filter.Specialites)
		}

		// Filtre chantierId : journaliers ayant une affectation active sur ce chantier
		if filter.ChantierID != "" {
			q = q.Where(
				`id IN (SELECT "journalierId" FROM "JournalierAffectation" WHERE "chantierId" = ? AND actif = true)`,
				filter.ChantierID,
			)
		}

		// Count total
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count journaliers: %w", err)
		}

		// List avec Preload Affectations.Chantier (une seule query supplémentaire)
		if err := q.
			Preload("Affectations.Chantier").
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list journaliers: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch un journalier par ID avec Affectations.Chantier préloadées.
// (nil, nil) si non trouvé ou non visible par RLS.
func (r *PersonnelRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Journalier, error) {
	var j model.Journalier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Affectations.Chantier").
			Where("id = ?", id).
			First(&j).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if j.ID == "" {
		return nil, nil
	}
	return &j, nil
}

// Create — insère un nouveau journalier. L'ID est généré si vide (cuid-like).
// L'entrepriseId est résolu par le usecase (auth.EntrepriseID pour non-SUPER_ADMIN).
func (r *PersonnelRepository) Create(ctx context.Context, auth *database.AuthUser, j model.Journalier) (*model.Journalier, error) {
	if j.ID == "" {
		j.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if j.CreatedAt.IsZero() {
		j.CreatedAt = now
	}
	if j.UpdatedAt.IsZero() {
		j.UpdatedAt = now
	}
	// Defaults défensifs (le usecase valide déjà, mais on garde la cohérence DB)
	if j.TypeContrat == "" {
		j.TypeContrat = "JOURNALIER"
	}
	if j.StatutContrat == "" {
		j.StatutContrat = "ACTIF"
	}

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&j).Error
	})
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// Update — met à jour un journalier par ID (partial updates via map).
// Renvoie (nil, nil) si non trouvé ou non visible par RLS.
func (r *PersonnelRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Journalier, error) {
	// Force updatedAt
	updates["updatedAt"] = time.Now().UTC()

	var updated model.Journalier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// Vérifie l'existence (pour 404)
		var exists int64
		if err := tx.Model(&model.Journalier{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		// Applique les updates (GORM Updates avec map = partial update)
		if err := tx.Model(&model.Journalier{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		// Recharge avec Affectations.Chantier préloadées
		if err := tx.
			Preload("Affectations.Chantier").
			Where("id = ?", id).
			First(&updated).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if updated.ID == "" {
		return nil, nil
	}
	return &updated, nil
}

// Delete — supprime un journalier par ID (hard delete).
// Cascade : supprime d'abord les JournalierAffectation liées (la table n'a pas
// de ON DELETE CASCADE garanti par Prisma).
// Idempotent : ne renvoie pas d'erreur si l'ID n'existe pas.
func (r *PersonnelRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// Vérifie l'existence
		var exists int64
		if err := tx.Model(&model.Journalier{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil // idempotent
		}

		// 1. Cascade delete JournalierAffectation
		if err := tx.Where(`"journalierId" = ?`, id).Delete(&model.JournalierAffectation{}).Error; err != nil {
			return fmt.Errorf("cascade delete JournalierAffectation: %w", err)
		}

		// 2. Hard delete Journalier
		return tx.Where("id = ?", id).Delete(&model.Journalier{}).Error
	})
}

// ══════════════════════════════════════════════════════════════════
// KPI agrégés
// ══════════════════════════════════════════════════════════════════

// CountKPI — agrège les journaliers par typeContrat + phase (groupe de spécialité).
// Utilise une seule query SQL avec COUNT(*) FILTER (WHERE ...) pour éviter N+1.
//
// Les phases BTP (GROS_OEUVRE, ENVELOPPE, SECOND_OEUVRE) sont déterminées par
// la spécialité du journalier (cf. specialitesByPhase dans le usecase).
func (r *PersonnelRepository) CountKPI(ctx context.Context, auth *database.AuthUser) (personnel.KPICounts, error) {
	grosSpecs := personnel.SpecialitesForPhase("GROS_OEUVRE")
	envSpecs := personnel.SpecialitesForPhase("ENVELOPPE")
	secSpecs := personnel.SpecialitesForPhase("SECOND_OEUVRE")

	sql := buildKPISQL(grosSpecs, envSpecs, secSpecs)
	args := buildKPIArgs(grosSpecs, envSpecs, secSpecs)

	var counts personnel.KPICounts
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Raw(sql, args...).Scan(&counts).Error
	})
	if err != nil {
		return personnel.KPICounts{}, fmt.Errorf("count KPI: %w", err)
	}
	return counts, nil
}

// buildKPISQL construit la requête SQL avec COUNT(*) FILTER (WHERE ...).
// Les spécialités sont passées en paramètres (?, ?, ...) pour éviter l'injection SQL.
func buildKPISQL(grosSpecs, envSpecs, secSpecs []string) string {
	var b strings.Builder
	b.WriteString(`SELECT 
		COUNT(*) AS total,
		COUNT(*) FILTER (WHERE "typeContrat" = 'JOURNALIER') AS journaliers,
		COUNT(*) FILTER (WHERE "typeContrat" = 'CDD') AS cdd,
		COUNT(*) FILTER (WHERE "typeContrat" = 'CDI') AS cdi,
		COUNT(*) FILTER (WHERE "typeContrat" = 'STAGIAIRE') AS stagiaires,
		COUNT(*) FILTER (WHERE specialite IN (`)
	b.WriteString(placeholders(len(grosSpecs)))
	b.WriteString(`)) AS "grosOeuvre",
		COUNT(*) FILTER (WHERE specialite IN (`)
	b.WriteString(placeholders(len(envSpecs)))
	b.WriteString(`)) AS enveloppe,
		COUNT(*) FILTER (WHERE specialite IN (`)
	b.WriteString(placeholders(len(secSpecs)))
	b.WriteString(`)) AS "secondOeuvre"
	FROM "Journalier"`)
	return b.String()
}

// buildKPIArgs retourne l'ordre des arguments pour la requête KPI.
// Doit matcher l'ordre des placeholders dans buildKPISQL.
func buildKPIArgs(grosSpecs, envSpecs, secSpecs []string) []any {
	args := make([]any, 0, len(grosSpecs)+len(envSpecs)+len(secSpecs))
	for _, s := range grosSpecs {
		args = append(args, s)
	}
	for _, s := range envSpecs {
		args = append(args, s)
	}
	for _, s := range secSpecs {
		args = append(args, s)
	}
	return args
}

// placeholders retourne "?, ?, ?" avec n placeholders.
// Retourne "NULL" si n = 0 (pour que `IN (NULL)` soit valide et renvoie 0 lignes).
func placeholders(n int) string {
	if n == 0 {
		return "NULL"
	}
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "?"
	}
	return strings.Join(parts, ", ")
}

// CountNonAffecte — compte les journaliers sans affectation active.
// Utilise NOT EXISTS sur JournalierAffectation (implicitement tenant-scoped
// car l'outer Journalier est RLS-filtered).
func (r *PersonnelRepository) CountNonAffecte(ctx context.Context, auth *database.AuthUser) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Journalier{}).
			Where(`NOT EXISTS (
				SELECT 1 FROM "JournalierAffectation" a
				WHERE a."journalierId" = "Journalier".id AND a.actif = true
			)`).
			Count(&n).Error
	})
	return n, err
}

// ══════════════════════════════════════════════════════════════════
// JournalierAffectation — List, Create, Delete
// (PAS de RLS direct, filtrage via JOIN sur Chantier)
// ══════════════════════════════════════════════════════════════════

// ListAffectationsByJournalier — liste les affectations d'un journalier
// (RLS via JOIN Chantier + Preload Chantier pour la réponse).
func (r *PersonnelRepository) ListAffectationsByJournalier(ctx context.Context, auth *database.AuthUser, journalierID string) ([]model.JournalierAffectation, error) {
	var items []model.JournalierAffectation
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.
			Preload("Chantier").
			Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
			Where(`"JournalierAffectation"."journalierId" = ?`, journalierID).
			Order(`"JournalierAffectation"."dateDebut" DESC NULLS LAST`).
			Find(&items).Error
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

// CreateAffectation — insère une nouvelle affectation.
// L'ID est généré si vide. Le usecase vérifie déjà que le journalier ET le
// chantier existent (visibles par RLS).
func (r *PersonnelRepository) CreateAffectation(ctx context.Context, auth *database.AuthUser, a model.JournalierAffectation) (*model.JournalierAffectation, error) {
	if a.ID == "" {
		a.ID = newCuidLikeID()
	}
	// Actif=true par défaut
	if !a.Actif {
		a.Actif = true
	}

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&a).Error
	})
	if err != nil {
		return nil, err
	}

	// Recharge avec Chantier préloadé pour la réponse
	var reloaded model.JournalierAffectation
	err = database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.
			Preload("Chantier").
			Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
			Where(`"JournalierAffectation".id = ?`, a.ID).
			First(&reloaded).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// L'INSERT a réussi mais le rechargement via JOIN Chantier renvoie 0 :
			// cela peut arriver si le chantier n'est pas visible par RLS. On retourne
			// quand même l'affectation créée (sans chantier préloadé).
			return &a, nil
		}
		return nil, err
	}
	return &reloaded, nil
}

// DeleteAffectation — supprime une affectation par ID (RLS via JOIN Chantier).
// Idempotent.
func (r *PersonnelRepository) DeleteAffectation(ctx context.Context, auth *database.AuthUser, affectationID string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// Vérifie l'existence (via JOIN Chantier pour RLS)
		var exists int64
		if err := tx.Model(&model.JournalierAffectation{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
			Where(`"JournalierAffectation".id = ?`, affectationID).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil // idempotent
		}
		return tx.Where("id = ?", affectationID).Delete(&model.JournalierAffectation{}).Error
	})
}

// DeleteAffectationByChantier — supprime l'affectation identifiée par la paire
// (journalierId, chantierId). Utilisé par le frontend qui passe ?chantierId= en
// query param. Idempotent.
func (r *PersonnelRepository) DeleteAffectationByChantier(ctx context.Context, auth *database.AuthUser, journalierID, chantierID string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// Vérifie l'existence (via JOIN Chantier pour RLS)
		var exists int64
		if err := tx.Model(&model.JournalierAffectation{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
			Where(`"JournalierAffectation"."journalierId" = ? AND "JournalierAffectation"."chantierId" = ?`, journalierID, chantierID).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil // idempotent
		}
		return tx.
			Where(`"journalierId" = ? AND "chantierId" = ?`, journalierID, chantierID).
			Delete(&model.JournalierAffectation{}).Error
	})
}

// ══════════════════════════════════════════════════════════════════
// ChantierExists — vérifie qu'un chantier est visible par le tenant (RLS direct)
// ══════════════════════════════════════════════════════════════════

// ChantierExists — utilisé par CreateAffectation pour vérifier que le chantier
// est accessible avant d'insérer l'affectation.
func (r *PersonnelRepository) ChantierExists(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Chantier{}).Where("id = ?", chantierID).Count(&n).Error
	})
	return n > 0, err
}
