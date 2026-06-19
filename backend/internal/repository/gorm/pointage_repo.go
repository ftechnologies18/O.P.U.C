// Package gorm — pointage_repo.go
// Repository pour les pointages (Phase 3, write métier).
//
// Toutes les méthodes utilisent WithTenant pour activer le RLS sur les tables
// qui ont une policy (Chantier, Journalier, etc.). La table Pointage elle-même
// n'a pas de RLS : on filtre via JOIN sur "Chantier" (RLS-protected).
// Si le chantierID n'appartient pas au tenant, le JOIN renvoie 0 lignes.
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/pointage"

	"gorm.io/gorm"
)

// PointageRepository — repository tenant-scoped pour les pointages.
type PointageRepository struct {
	db *gorm.DB // runtime (app_user) connection — RLS enforced
}

// NewPointageRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewPointageRepository(runtimeDB *gorm.DB) *PointageRepository {
	return &PointageRepository{db: runtimeDB}
}

// compile-time check : PointageRepository implémente pointage.Repo.
var _ pointage.Repo = (*PointageRepository)(nil)

// List — liste paginée des pointages (RLS via JOIN Chantier).
// Filtres optionnels : chantierId, journalierId, date.
// Ordonné par dateTravail DESC.
func (r *PointageRepository) List(ctx context.Context, auth *database.AuthUser, filter pointage.ListInput) ([]model.Pointage, int64, error) {
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
		pointages []model.Pointage
		total     int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Pointage{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`)
		if filter.ChantierID != "" {
			q = q.Where(`"Pointage"."chantierId" = ?`, filter.ChantierID)
		}
		if filter.JournalierID != "" {
			q = q.Where(`"Pointage"."journalierId" = ?`, filter.JournalierID)
		}
		if !filter.Date.IsZero() {
			q = q.Where(`"Pointage"."dateTravail" = ?`, filter.Date)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count pointages: %w", err)
		}
		if err := q.
			Order(`"Pointage"."dateTravail" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&pointages).Error; err != nil {
			return fmt.Errorf("list pointages: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return pointages, total, nil
}

// GetByID — fetch un pointage par ID (RLS via JOIN Chantier).
// (nil, nil) si non trouvé ou non visible.
func (r *PointageRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Pointage, error) {
	var p model.Pointage
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
			Where(`"Pointage".id = ?`, id).
			First(&p).Error
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
	if p.ID == "" {
		return nil, nil
	}
	return &p, nil
}

// ExistsDuplicate — vérifie la contrainte @@unique [journalierId, chantierId, dateTravail].
// excludeID permet d'exclure le pointage courant lors d'un Update (non utilisé ici).
func (r *PointageRepository) ExistsDuplicate(ctx context.Context, auth *database.AuthUser, journalierID, chantierID string, date time.Time, excludeID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Pointage{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
			Where(`"Pointage"."journalierId" = ? AND "Pointage"."chantierId" = ? AND "Pointage"."dateTravail" = ?`,
				journalierID, chantierID, date)
		if excludeID != "" {
			q = q.Where(`"Pointage".id <> ?`, excludeID)
		}
		return q.Count(&n).Error
	})
	return n > 0, err
}

// ChantierAccessible — vérifie qu'un chantier est visible par le tenant (RLS).
// Utilisé par Create pour valider que le chantierID appartient au tenant courant.
func (r *PointageRepository) ChantierAccessible(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Chantier{}).Where("id = ?", chantierID).Count(&n).Error
	})
	return n > 0, err
}

// Create — insère un nouveau pointage.
// L'ID est généré si vide (cuid-like, varchar(30) compatible).
func (r *PointageRepository) Create(ctx context.Context, auth *database.AuthUser, p model.Pointage) (*model.Pointage, error) {
	if p.ID == "" {
		p.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	if p.UpdatedAt.IsZero() {
		p.UpdatedAt = now
	}

	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&p).Error
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Update — met à jour un pointage par ID avec un map d'updates.
// Vérifie d'abord l'existence + accessibilité tenant (JOIN Chantier).
// Renvoie (nil, nil) si non trouvé / non visible.
func (r *PointageRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Pointage, error) {
	var updated model.Pointage
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// Vérifie existence + accessibilité tenant
		var exists int64
		if err := tx.Model(&model.Pointage{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
			Where(`"Pointage".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil // non trouvé / non visible → (nil, nil)
		}
		res := tx.Model(&model.Pointage{}).Where("id = ?", id).Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if err := tx.Where("id = ?", id).First(&updated).Error; err != nil {
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

// Delete — supprime un pointage par ID (hard delete).
// Vérifie d'abord l'accessibilité tenant. Idempotent.
func (r *PointageRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Pointage{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
			Where(`"Pointage".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil // idempotent
		}
		return tx.Where("id = ?", id).Delete(&model.Pointage{}).Error
	})
}

// Summary — agrégats par chantier + plage de dates.
//   - Total        : count tous pointages de la plage
//   - PresentCount : count pointages present=true
//   - AbsentCount  : Total - PresentCount
//   - TotalCost    : SUM(tauxJournalier) WHERE present=true AND valide=true
func (r *PointageRepository) Summary(ctx context.Context, auth *database.AuthUser, chantierID string, dateDebut, dateFin time.Time) (*pointage.Summary, error) {
	s := &pointage.Summary{
		ChantierID: chantierID,
		DateDebut:  dateDebut,
		DateFin:    dateFin,
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		baseJoin := `JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`
		baseWhere := `"Pointage"."chantierId" = ? AND "Pointage"."dateTravail" BETWEEN ? AND ?`

		// Total
		if err := tx.Model(&model.Pointage{}).
			Joins(baseJoin).
			Where(baseWhere, chantierID, dateDebut, dateFin).
			Count(&s.Total).Error; err != nil {
			return fmt.Errorf("summary total: %w", err)
		}

		// Present count
		if err := tx.Model(&model.Pointage{}).
			Joins(baseJoin).
			Where(baseWhere+` AND "Pointage".present = true`, chantierID, dateDebut, dateFin).
			Count(&s.PresentCount).Error; err != nil {
			return fmt.Errorf("summary present: %w", err)
		}
		s.AbsentCount = s.Total - s.PresentCount

		// Total cost (SUM tauxJournalier where present=true AND valide=true)
		var totalCost float64
		row := tx.Model(&model.Pointage{}).
			Joins(baseJoin).
			Where(baseWhere+` AND "Pointage".present = true AND "Pointage".valide = true`, chantierID, dateDebut, dateFin).
			Select(`COALESCE(SUM("Pointage"."tauxJournalier"), 0)`).
			Row()
		if err := row.Scan(&totalCost); err != nil {
			return fmt.Errorf("summary total cost: %w", err)
		}
		s.TotalCost = totalCost
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s, nil
}
