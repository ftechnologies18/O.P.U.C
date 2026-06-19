// Package gorm — document_repo.go
// Repository pour les documents, photos et rapports journaliers
// (Phase 5, peripheral endpoints).
//
// Tables :
//   - DocumentChantier  (PAS de RLS direct, filtrage via JOIN sur "Chantier")
//   - Photo              (PAS de RLS direct, filtrage via JOIN sur "Chantier")
//   - RapportJournalier  (PAS de RLS direct, filtrage via JOIN sur "Chantier")
//
// Toutes ces tables ont une colonne chantierId qui référence la table Chantier
// (RLS-protected). Le filtrage tenant se fait via JOIN.
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/document"

	"gorm.io/gorm"
)

// DocumentRepository — repository tenant-scoped pour documents/photos/rapports.
type DocumentRepository struct {
	db *gorm.DB
}

// NewDocumentRepository constructeur.
func NewDocumentRepository(runtimeDB *gorm.DB) *DocumentRepository {
	return &DocumentRepository{db: runtimeDB}
}

// compile-time check : DocumentRepository implémente document.Repo.
var _ document.Repo = (*DocumentRepository)(nil)

// ── DocumentChantier ───────────────────────────────────────────

// List — liste paginée des documents (RLS via JOIN Chantier).
// Filtres : chantierId, type, statut, search sur titre.
func (r *DocumentRepository) List(ctx context.Context, auth *database.AuthUser, filter document.ListInput) ([]model.DocumentChantier, int64, error) {
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
		items []model.DocumentChantier
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.DocumentChantier{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "DocumentChantier"."chantierId"`)
		if filter.ChantierID != "" {
			q = q.Where(`"DocumentChantier"."chantierId" = ?`, filter.ChantierID)
		}
		if filter.Type != "" {
			q = q.Where(`"DocumentChantier".type = ?`, filter.Type)
		}
		if filter.Statut != "" {
			q = q.Where(`"DocumentChantier".statut = ?`, filter.Statut)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where(`"DocumentChantier".titre ILIKE ?`, like)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count documents: %w", err)
		}
		if err := q.
			Order(`"DocumentChantier"."createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list documents: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetDocumentByID — fetch un document par ID (RLS via JOIN Chantier).
// (nil, nil) si non trouvé.
func (r *DocumentRepository) GetDocumentByID(ctx context.Context, auth *database.AuthUser, id string) (*model.DocumentChantier, error) {
	var d model.DocumentChantier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Joins(`JOIN "Chantier" ON "Chantier".id = "DocumentChantier"."chantierId"`).
			Where(`"DocumentChantier".id = ?`, id).
			First(&d).Error
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
	if d.ID == "" {
		return nil, nil
	}
	return &d, nil
}

// CreateDocument — insère un nouveau DocumentChantier.
func (r *DocumentRepository) CreateDocument(ctx context.Context, auth *database.AuthUser, d model.DocumentChantier) (*model.DocumentChantier, error) {
	if d.ID == "" {
		d.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if d.CreatedAt.IsZero() {
		d.CreatedAt = now
	}
	if d.UpdatedAt.IsZero() {
		d.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&d).Error
	})
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// UpdateDocument — met à jour un document par ID (RLS via JOIN Chantier).
// (nil, nil) si non trouvé.
func (r *DocumentRepository) UpdateDocument(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.DocumentChantier, error) {
	var updated model.DocumentChantier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.DocumentChantier{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "DocumentChantier"."chantierId"`).
			Where(`"DocumentChantier".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.DocumentChantier{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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

// DeleteDocument — supprime un document par ID (RLS via JOIN Chantier). Idempotent.
func (r *DocumentRepository) DeleteDocument(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.DocumentChantier{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "DocumentChantier"."chantierId"`).
			Where(`"DocumentChantier".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.DocumentChantier{}).Error
	})
}

// ── Photo ──────────────────────────────────────────────────────

// ListPhotos — liste paginée des photos (RLS via JOIN Chantier).
// Filtres : chantierId, categorie.
func (r *DocumentRepository) ListPhotos(ctx context.Context, auth *database.AuthUser, filter document.PhotoListInput) ([]model.Photo, int64, error) {
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
		items []model.Photo
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Photo{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Photo"."chantierId"`)
		if filter.ChantierID != "" {
			q = q.Where(`"Photo"."chantierId" = ?`, filter.ChantierID)
		}
		if filter.Categorie != "" {
			q = q.Where(`"Photo".categorie = ?`, filter.Categorie)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count photos: %w", err)
		}
		if err := q.
			Order(`"Photo"."createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list photos: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// CreatePhoto — insère une nouvelle Photo.
func (r *DocumentRepository) CreatePhoto(ctx context.Context, auth *database.AuthUser, p model.Photo) (*model.Photo, error) {
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

// DeletePhoto — supprime une photo par ID (RLS via JOIN Chantier). Idempotent.
func (r *DocumentRepository) DeletePhoto(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Photo{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "Photo"."chantierId"`).
			Where(`"Photo".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.Photo{}).Error
	})
}

// ── RapportJournalier ──────────────────────────────────────────

// ListRapports — liste paginée des rapports journaliers (RLS via JOIN Chantier).
// Filtres : chantierId, date (dateRapport = date).
func (r *DocumentRepository) ListRapports(ctx context.Context, auth *database.AuthUser, filter document.RapportListInput) ([]model.RapportJournalier, int64, error) {
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
		items []model.RapportJournalier
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.RapportJournalier{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "RapportJournalier"."chantierId"`)
		if filter.ChantierID != "" {
			q = q.Where(`"RapportJournalier"."chantierId" = ?`, filter.ChantierID)
		}
		if !filter.Date.IsZero() {
			// Filtre par jour (dateRapport >= date 00:00:00 AND < date + 1 jour).
			dayStart := time.Date(filter.Date.Year(), filter.Date.Month(), filter.Date.Day(), 0, 0, 0, 0, time.UTC)
			dayEnd := dayStart.AddDate(0, 0, 1)
			q = q.Where(`"RapportJournalier"."dateRapport" >= ? AND "RapportJournalier"."dateRapport" < ?`, dayStart, dayEnd)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count rapports: %w", err)
		}
		if err := q.
			Order(`"RapportJournalier"."dateRapport" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list rapports: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetRapportByID — fetch un rapport par ID (Preload Photos, RLS via JOIN Chantier).
// (nil, nil) si non trouvé.
func (r *DocumentRepository) GetRapportByID(ctx context.Context, auth *database.AuthUser, id string) (*model.RapportJournalier, error) {
	var rp model.RapportJournalier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Photos").
			Joins(`JOIN "Chantier" ON "Chantier".id = "RapportJournalier"."chantierId"`).
			Where(`"RapportJournalier".id = ?`, id).
			First(&rp).Error
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
	if rp.ID == "" {
		return nil, nil
	}
	return &rp, nil
}

// CreateRapport — insère un nouveau RapportJournalier.
func (r *DocumentRepository) CreateRapport(ctx context.Context, auth *database.AuthUser, rp model.RapportJournalier) (*model.RapportJournalier, error) {
	if rp.ID == "" {
		rp.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if rp.CreatedAt.IsZero() {
		rp.CreatedAt = now
	}
	if rp.UpdatedAt.IsZero() {
		rp.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&rp).Error
	})
	if err != nil {
		return nil, err
	}
	return &rp, nil
}

// UpdateRapport — met à jour un rapport par ID (RLS via JOIN Chantier).
// (nil, nil) si non trouvé.
func (r *DocumentRepository) UpdateRapport(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.RapportJournalier, error) {
	var updated model.RapportJournalier
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.RapportJournalier{}).
			Joins(`JOIN "Chantier" ON "Chantier".id = "RapportJournalier"."chantierId"`).
			Where(`"RapportJournalier".id = ?`, id).
			Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.RapportJournalier{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.
			Preload("Photos").
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
