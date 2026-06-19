// Package gorm — support_repo.go
// Repository pour les tickets de support et leurs messages
// (Phase 5, peripheral endpoints).
//
// Tables :
//   - TicketSupport  (RLS-protected, policy tenant_isolation sur entrepriseId)
//   - TicketMessage  (PAS de RLS direct, filtrage via JOIN sur "TicketSupport")
//
// ⚠️ RLS WITH CHECK : sur INSERT de TicketSupport, entrepriseId doit matcher
// app_current_tenant(). L'usecase force EntrepriseID = auth.EntrepriseID.
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/support"

	"gorm.io/gorm"
)

// SupportRepository — repository tenant-scoped pour les tickets de support.
type SupportRepository struct {
	db *gorm.DB
}

// NewSupportRepository constructeur.
func NewSupportRepository(runtimeDB *gorm.DB) *SupportRepository {
	return &SupportRepository{db: runtimeDB}
}

// compile-time check : SupportRepository implémente support.Repo.
var _ support.Repo = (*SupportRepository)(nil)

// ── TicketSupport ──────────────────────────────────────────────

// List — liste paginée des tickets (RLS direct).
// Filtres : statut, priorite, categorie, clientId, assigneAId, search sur titre.
func (r *SupportRepository) List(ctx context.Context, auth *database.AuthUser, filter support.ListInput) ([]model.TicketSupport, int64, error) {
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
		items []model.TicketSupport
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.TicketSupport{})
		if filter.Statut != "" {
			q = q.Where("statut = ?", filter.Statut)
		}
		if filter.Priorite != "" {
			q = q.Where("priorite = ?", filter.Priorite)
		}
		if filter.Categorie != "" {
			q = q.Where("categorie = ?", filter.Categorie)
		}
		if filter.ClientID != "" {
			q = q.Where(`"clientId" = ?`, filter.ClientID)
		}
		if filter.AssigneAID != "" {
			q = q.Where(`"assigneAId" = ?`, filter.AssigneAID)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where("titre ILIKE ?", like)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count tickets: %w", err)
		}
		if err := q.
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list tickets: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch un ticket par ID avec Preload Messages (RLS direct).
// (nil, nil) si non trouvé.
func (r *SupportRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.TicketSupport, error) {
	var t model.TicketSupport
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Messages").
			Where("id = ?", id).
			First(&t).Error
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
	if t.ID == "" {
		return nil, nil
	}
	return &t, nil
}

// Create — insère un nouveau ticket. L'ID est généré si vide.
func (r *SupportRepository) Create(ctx context.Context, auth *database.AuthUser, t model.TicketSupport) (*model.TicketSupport, error) {
	if t.ID == "" {
		t.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if t.CreatedAt.IsZero() {
		t.CreatedAt = now
	}
	if t.UpdatedAt.IsZero() {
		t.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&t).Error
	})
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Update — met à jour un ticket par ID.
// (nil, nil) si non trouvé.
func (r *SupportRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.TicketSupport, error) {
	var updated model.TicketSupport
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.TicketSupport{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.TicketSupport{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.
			Preload("Messages").
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

// ── TicketMessage (PAS de RLS direct, filtrage via JOIN TicketSupport) ──

// ListMessagesByTicket — tous les messages d'un ticket (RLS via JOIN TicketSupport).
func (r *SupportRepository) ListMessagesByTicket(ctx context.Context, auth *database.AuthUser, ticketID string) ([]model.TicketMessage, error) {
	var items []model.TicketMessage
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.
			Joins(`JOIN "TicketSupport" ON "TicketSupport".id = "TicketMessage"."ticketId"`).
			Where(`"TicketMessage"."ticketId" = ?`, ticketID).
			Order(`"TicketMessage"."createdAt" ASC`).
			Find(&items).Error
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

// CreateMessage — insère un nouveau TicketMessage.
func (r *SupportRepository) CreateMessage(ctx context.Context, auth *database.AuthUser, m model.TicketMessage) (*model.TicketMessage, error) {
	if m.ID == "" {
		m.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&m).Error
	})
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ── Stats ──────────────────────────────────────────────────────

// CountByColumn — compte les tickets groupés par une colonne donnée.
// Utilise Raw SQL pour préserver le mapping camelCase (cf. bug GORM GROUP BY).
func (r *SupportRepository) CountByColumn(ctx context.Context, auth *database.AuthUser, column string) (map[string]int64, error) {
	type row struct {
		Key   string `gorm:"column:key"`
		Count int64  `gorm:"column:count"`
	}
	var rows []row
	// column est validé côté usecase (liste blanche), pas d'injection SQL possible.
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := fmt.Sprintf(
			`SELECT "%s" as "key", COUNT(*) as "count" FROM "TicketSupport" GROUP BY "%s"`,
			column, column,
		)
		return tx.Raw(q).Scan(&rows).Error
	})
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, r := range rows {
		out[r.Key] = r.Count
	}
	return out, nil
}

// CountTotal — nombre total de tickets visibles.
func (r *SupportRepository) CountTotal(ctx context.Context, auth *database.AuthUser) (int64, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.TicketSupport{}).Count(&n).Error
	})
	return n, err
}

// CountByStatutIn — compte les tickets dont le statut est dans la liste donnée.
func (r *SupportRepository) CountByStatutIn(ctx context.Context, auth *database.AuthUser, statuts []string) (int64, error) {
	if len(statuts) == 0 {
		return 0, nil
	}
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.TicketSupport{}).Where("statut IN ?", statuts).Count(&n).Error
	})
	return n, err
}
