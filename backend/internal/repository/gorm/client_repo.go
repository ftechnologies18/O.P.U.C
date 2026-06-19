// Package gorm — client_repo.go
// Repository pour les clients (Phase 4, commercial).
//
// La table Client est RLS-protected (policy tenant_isolation sur entrepriseId).
// WithTenant s'applique directement, pas besoin de JOIN.
//
// Chantier, Devis, Facture référencent Client via clientId (ces tables sont
// également RLS-protected).
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/client"

	"gorm.io/gorm"
)

// ClientRepository — repository tenant-scoped pour les clients.
type ClientRepository struct {
	db *gorm.DB // runtime (app_user) connection — RLS enforced
}

// NewClientRepository constructeur.
func NewClientRepository(runtimeDB *gorm.DB) *ClientRepository {
	return &ClientRepository{db: runtimeDB}
}

// compile-time check : ClientRepository implémente client.Repo.
var _ client.Repo = (*ClientRepository)(nil)

// List — liste paginée des clients (RLS direct).
// Filtres optionnels : type, statut, search (raisonSociale/nomContact/email).
func (r *ClientRepository) List(ctx context.Context, auth *database.AuthUser, filter client.ListInput) ([]model.Client, int64, error) {
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
		items []model.Client
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Client{})
		if filter.Type != "" {
			q = q.Where("type = ?", filter.Type)
		}
		if filter.Statut != "" {
			q = q.Where("statut = ?", filter.Statut)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where(
				`"raisonSociale" ILIKE ? OR "nomContact" ILIKE ? OR email ILIKE ?`,
				like, like, like,
			)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count clients: %w", err)
		}
		if err := q.
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list clients: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch un client par ID (RLS direct).
// (nil, nil) si non trouvé ou non visible.
func (r *ClientRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Client, error) {
	var c model.Client
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.Where("id = ?", id).First(&c).Error
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

// Create — insère un nouveau client. L'ID est généré si vide (cuid-like).
func (r *ClientRepository) Create(ctx context.Context, auth *database.AuthUser, c model.Client) (*model.Client, error) {
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

// Update — met à jour un client par ID.
// Renvoie (nil, nil) si non trouvé.
func (r *ClientRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Client, error) {
	var updated model.Client
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Client{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.Client{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
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

// Delete — supprime un client par ID (hard delete). Idempotent.
func (r *ClientRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Client{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.Client{}).Error
	})
}

// ── Counters (for detail view) ─────────────────────────────────

// CountChantiersByClient — nombre de chantiers liés à un client (RLS via Chantier).
func (r *ClientRepository) CountChantiersByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Chantier{}).
			Where(`"clientId" = ?`, clientID).
			Count(&n).Error
	})
	return n, err
}

// CountDevisByClient — nombre de devis liés à un client (RLS via Devis).
func (r *ClientRepository) CountDevisByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Devis{}).
			Where(`"clientId" = ?`, clientID).
			Count(&n).Error
	})
	return n, err
}

// CountFacturesByClient — nombre de factures liées à un client (RLS via Facture).
func (r *ClientRepository) CountFacturesByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Facture{}).
			Where(`"clientId" = ?`, clientID).
			Count(&n).Error
	})
	return n, err
}

// ── Delete checks ──────────────────────────────────────────────

// HasLinkedDevis — true si au moins un devis référence ce client.
func (r *ClientRepository) HasLinkedDevis(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error) {
	n, err := r.CountDevisByClient(ctx, auth, clientID)
	return n > 0, err
}

// HasLinkedContrats — true si au moins un contrat référence ce client.
func (r *ClientRepository) HasLinkedContrats(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Contrat{}).
			Where(`"clientId" = ?`, clientID).
			Count(&n).Error
	})
	return n > 0, err
}

// HasLinkedFactures — true si au moins une facture référence ce client.
func (r *ClientRepository) HasLinkedFactures(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error) {
	n, err := r.CountFacturesByClient(ctx, auth, clientID)
	return n > 0, err
}

// ── Stats ──────────────────────────────────────────────────────

// CountByType — compte les clients groupés par type.
func (r *ClientRepository) CountByType(ctx context.Context, auth *database.AuthUser) (map[string]int64, error) {
	type row struct {
		Type  string
		Count int64
	}
	var rows []row
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Client{}).
			Select("type, COUNT(*) as count").
			Group("type").
			Scan(&rows).Error
	})
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, r := range rows {
		out[r.Type] = r.Count
	}
	return out, nil
}

// CountByStatut — compte les clients groupés par statut.
func (r *ClientRepository) CountByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error) {
	type row struct {
		Statut string
		Count  int64
	}
	var rows []row
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Client{}).
			Select("statut, COUNT(*) as count").
			Group("statut").
			Scan(&rows).Error
	})
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, r := range rows {
		out[r.Statut] = r.Count
	}
	return out, nil
}

// CountRecent — nombre de clients créés dans les `days` derniers jours.
func (r *ClientRepository) CountRecent(ctx context.Context, auth *database.AuthUser, days int) (int64, error) {
	if days < 1 {
		days = 30
	}
	since := time.Now().UTC().AddDate(0, 0, -days)
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Client{}).
			Where(`"createdAt" >= ?`, since).
			Count(&n).Error
	})
	return n, err
}

// CountTotal — nombre total de clients visibles.
func (r *ClientRepository) CountTotal(ctx context.Context, auth *database.AuthUser) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Client{}).Count(&n).Error
	})
	return n, err
}
