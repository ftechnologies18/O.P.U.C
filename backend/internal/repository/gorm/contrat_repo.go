// Package gorm — contrat_repo.go
// Repository pour les contrats (Phase 4, commercial).
//
// La table Contrat est RLS-protected (policy tenant_isolation sur entrepriseId).
// WithTenant s'applique directement.
//
// Calcul : montantTTC = montantHT × (1 + tauxTVA/100)
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/contrat"

	"gorm.io/gorm"
)

// ContratRepository — repository tenant-scoped pour les contrats.
type ContratRepository struct {
	db *gorm.DB
}

// NewContratRepository constructeur.
func NewContratRepository(runtimeDB *gorm.DB) *ContratRepository {
	return &ContratRepository{db: runtimeDB}
}

// compile-time check : ContratRepository implémente contrat.Repo.
var _ contrat.Repo = (*ContratRepository)(nil)

// List — liste paginée des contrats (Preload Client).
// Filtres : clientId, statut, typeContrat, search sur numero/objet.
func (r *ContratRepository) List(ctx context.Context, auth *database.AuthUser, filter contrat.ListInput) ([]model.Contrat, int64, error) {
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
		items []model.Contrat
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Contrat{})
		if filter.ClientID != "" {
			q = q.Where(`"clientId" = ?`, filter.ClientID)
		}
		if filter.Statut != "" {
			q = q.Where("statut = ?", filter.Statut)
		}
		if filter.TypeContrat != "" {
			q = q.Where(`"typeContrat" = ?`, filter.TypeContrat)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where("numero ILIKE ? OR objet ILIKE ?", like, like)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count contrats: %w", err)
		}
		if err := q.
			Preload("Client").
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list contrats: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch un contrat par ID (Preload Client + Factures).
// (nil, nil) si non trouvé.
func (r *ContratRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Contrat, error) {
	var c model.Contrat
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Client").
			Preload("Factures").
			Where("id = ?", id).
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

// CountByYear — nombre de contrats créés pour une année (pour numero auto).
func (r *ContratRepository) CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error) {
	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	yearEnd := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Contrat{}).
			Where(`"createdAt" >= ? AND "createdAt" < ?`, yearStart, yearEnd).
			Count(&n).Error
	})
	return n, err
}

// Create — insère un nouveau contrat.
func (r *ContratRepository) Create(ctx context.Context, auth *database.AuthUser, c model.Contrat) (*model.Contrat, error) {
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

// Update — met à jour un contrat par ID.
func (r *ContratRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Contrat, error) {
	var updated model.Contrat
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Contrat{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.Contrat{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.
			Preload("Client").
			Preload("Factures").
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

// Delete — supprime un contrat par ID (hard delete).
// Idempotent. Ne supprime pas si des factures sont liées (à vérifier côté usecase).
func (r *ContratRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Contrat{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.Contrat{}).Error
	})
}

// HasLinkedFactures — true si au moins une facture référence ce contrat.
func (r *ContratRepository) HasLinkedFactures(ctx context.Context, auth *database.AuthUser, contratID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Facture{}).
			Where(`"contratId" = ?`, contratID).
			Count(&n).Error
	})
	return n > 0, err
}
