// Package gorm — soustraitant_repo.go
// Repository pour les sous-traitants et leurs contrats (Phase 5, peripheral).
//
// Tables :
//   - SousTraitant (RLS-protected, policy tenant_isolation sur entrepriseId)
//   - ContratST   (PAS de RLS direct, filtrage via JOIN sur "SousTraitant")
//
// ⚠️ RLS WITH CHECK : sur INSERT de SousTraitant, entrepriseId doit matcher
// app_current_tenant(). L'usecase force EntrepriseID = auth.EntrepriseID.
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/soustraitant"

	"gorm.io/gorm"
)

// SousTraitantRepository — repository tenant-scoped pour les sous-traitants.
type SousTraitantRepository struct {
	db *gorm.DB
}

// NewSousTraitantRepository constructeur.
func NewSousTraitantRepository(runtimeDB *gorm.DB) *SousTraitantRepository {
	return &SousTraitantRepository{db: runtimeDB}
}

// compile-time check : SousTraitantRepository implémente soustraitant.Repo.
var _ soustraitant.Repo = (*SousTraitantRepository)(nil)

// ── SousTraitant ───────────────────────────────────────────────

// List — liste paginée des sous-traitants (RLS direct).
// Filtres : type, search (raisonSociale/nom/contact).
func (r *SousTraitantRepository) List(ctx context.Context, auth *database.AuthUser, filter soustraitant.ListInput) ([]model.SousTraitant, int64, error) {
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
		items []model.SousTraitant
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.SousTraitant{})
		if filter.Type != "" {
			q = q.Where("type = ?", filter.Type)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where(
				`"raisonSociale" ILIKE ? OR nom ILIKE ? OR contact ILIKE ?`,
				like, like, like,
			)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count soustraitants: %w", err)
		}
		if err := q.
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list soustraitants: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch un sous-traitant par ID avec Preload Contrats (RLS direct).
// (nil, nil) si non trouvé.
func (r *SousTraitantRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.SousTraitant, error) {
	var st model.SousTraitant
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Contrats").
			Where("id = ?", id).
			First(&st).Error
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
	if st.ID == "" {
		return nil, nil
	}
	return &st, nil
}

// Create — insère un nouveau sous-traitant. L'ID est généré si vide.
func (r *SousTraitantRepository) Create(ctx context.Context, auth *database.AuthUser, st model.SousTraitant) (*model.SousTraitant, error) {
	if st.ID == "" {
		st.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if st.CreatedAt.IsZero() {
		st.CreatedAt = now
	}
	if st.UpdatedAt.IsZero() {
		st.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&st).Error
	})
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// Update — met à jour un sous-traitant par ID.
// (nil, nil) si non trouvé.
func (r *SousTraitantRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.SousTraitant, error) {
	var updated model.SousTraitant
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.SousTraitant{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.SousTraitant{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.
			Preload("Contrats").
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

// Delete — supprime un sous-traitant par ID (hard delete). Idempotent.
func (r *SousTraitantRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.SousTraitant{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.SousTraitant{}).Error
	})
}

// HasLinkedContrats — true si au moins un contrat référence ce sous-traitant.
func (r *SousTraitantRepository) HasLinkedContrats(ctx context.Context, auth *database.AuthUser, sousTraitantID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.ContratST{}).
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST"."sousTraitantId" = ?`, sousTraitantID).
			Count(&n).Error
	})
	return n > 0, err
}

// ── ContratST (PAS de RLS direct, filtrage via JOIN SousTraitant) ────

// ListContratsBySousTraitant — tous les contrats d'un sous-traitant (RLS via JOIN SousTraitant).
func (r *SousTraitantRepository) ListContratsBySousTraitant(ctx context.Context, auth *database.AuthUser, sousTraitantID string) ([]model.ContratST, error) {
	var items []model.ContratST
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST"."sousTraitantId" = ?`, sousTraitantID).
			Order(`"ContratST"."createdAt" DESC`).
			Find(&items).Error
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetContratByID — fetch un ContratST par ID (RLS via JOIN SousTraitant).
// (nil, nil) si non trouvé.
func (r *SousTraitantRepository) GetContratByID(ctx context.Context, auth *database.AuthUser, contratID string) (*model.ContratST, error) {
	var c model.ContratST
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST".id = ?`, contratID).
			First(&c).Error
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
	if c.ID == "" {
		return nil, nil
	}
	return &c, nil
}

// CreateContrat — insère un nouveau ContratST.
func (r *SousTraitantRepository) CreateContrat(ctx context.Context, auth *database.AuthUser, c model.ContratST) (*model.ContratST, error) {
	if c.ID == "" {
		c.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if c.CreatedAt.IsZero() {
		c.CreatedAt = now
	}
	if c.UpdatedAt.IsZero() {
		c.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&c).Error
	})
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// UpdateContrat — met à jour un ContratST par ID (RLS via JOIN SousTraitant).
// (nil, nil) si non trouvé.
func (r *SousTraitantRepository) UpdateContrat(ctx context.Context, auth *database.AuthUser, contratID string, updates map[string]any) (*model.ContratST, error) {
	var updated model.ContratST
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.ContratST{}).
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST".id = ?`, contratID).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.ContratST{}).Where("id = ?", contratID).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", contratID).First(&updated).Error; err != nil {
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

// DeleteContrat — supprime un ContratST par ID (RLS via JOIN SousTraitant). Idempotent.
func (r *SousTraitantRepository) DeleteContrat(ctx context.Context, auth *database.AuthUser, contratID string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.ContratST{}).
			Joins(`JOIN "SousTraitant" ON "SousTraitant".id = "ContratST"."sousTraitantId"`).
			Where(`"ContratST".id = ?`, contratID).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", contratID).Delete(&model.ContratST{}).Error
	})
}
