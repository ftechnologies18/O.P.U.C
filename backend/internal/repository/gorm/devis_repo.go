// Package gorm — devis_repo.go
// Repository pour les devis et lignes de devis (Phase 4, commercial).
//
// Tables :
//   - Devis (RLS-protected, filtrage direct via WithTenant)
//   - LigneDevis (PAS de RLS direct, filtrage via JOIN sur "Devis")
//
// Calculs :
//   - ligne.totalHT = ligne.quantite × ligne.prixUnitaire
//   - totalHT (devis) = sum(lignes.totalHT)
//   - totalHTRemise = totalHT × (1 - remiseGlobale/100)
//   - montantTVA = totalHTRemise × tauxTVA/100
//   - totalTTC = totalHTRemise + montantTVA
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/devis"

        "gorm.io/gorm"
)

// DevisRepository — repository tenant-scoped pour les devis.
type DevisRepository struct {
        db *gorm.DB
}

// NewDevisRepository constructeur.
func NewDevisRepository(runtimeDB *gorm.DB) *DevisRepository {
        return &DevisRepository{db: runtimeDB}
}

// compile-time check : DevisRepository implémente devis.Repo.
var _ devis.Repo = (*DevisRepository)(nil)

// ── Devis ──────────────────────────────────────────────────────

// List — liste paginée des devis (RLS direct, Preload Client).
// Filtres : clientId, statut, search sur numero.
func (r *DevisRepository) List(ctx context.Context, auth *database.AuthUser, filter devis.ListInput) ([]model.Devis, int64, error) {
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
                items []model.Devis
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Devis{})
                if filter.ClientID != "" {
                        q = q.Where(`"clientId" = ?`, filter.ClientID)
                }
                if filter.Statut != "" {
                        q = q.Where("statut = ?", filter.Statut)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where("numero ILIKE ?", like)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count devis: %w", err)
                }
                if err := q.
                        Preload("Client").
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list devis: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetByID — fetch un devis par ID (Preload Client + Lignes).
// (nil, nil) si non trouvé.
func (r *DevisRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Devis, error) {
        var d model.Devis
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Preload("Client").
                        Preload("Lignes").
                        Where("id = ?", id).
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

// CountByYear — nombre de devis créés pour une année donnée (pour numero auto).
func (r *DevisRepository) CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error) {
        yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
        yearEnd := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Devis{}).
                        Where(`"dateEmission" >= ? AND "dateEmission" < ?`, yearStart, yearEnd).
                        Count(&n).Error
        })
        return n, err
}

// Create — insère un nouveau devis (avec ses lignes en cascade).
func (r *DevisRepository) Create(ctx context.Context, auth *database.AuthUser, d model.Devis) (*model.Devis, error) {
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
        // Assigne IDs aux lignes + DevisID si vide (LigneDevis n'a pas de CreatedAt).
        for i := range d.Lignes {
                if d.Lignes[i].ID == "" {
                        d.Lignes[i].ID = newCuidLikeID()
                }
                if d.Lignes[i].DevisID == "" {
                        d.Lignes[i].DevisID = d.ID
                }
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&d).Error
        })
        if err != nil {
                return nil, err
        }
        return &d, nil
}

// Update — met à jour un devis par ID (champs simples, pas les lignes).
func (r *DevisRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Devis, error) {
        var updated model.Devis
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.Devis{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.Devis{}).Where("id = ?", id).Updates(updates).Error; err != nil {
                        return err
                }
                if err := tx.
                        Preload("Client").
                        Preload("Lignes").
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

// Delete — supprime un devis + ses lignes en cascade (hard delete).
func (r *DevisRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.Devis{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                // Cascade delete : supprime d'abord les lignes, puis le devis.
                if err := tx.Where(`"devisId" = ?`, id).Delete(&model.LigneDevis{}).Error; err != nil {
                        return fmt.Errorf("delete lignes: %w", err)
                }
                return tx.Where("id = ?", id).Delete(&model.Devis{}).Error
        })
}

// ── LigneDevis (PAS de RLS direct, filtrage via JOIN Devis) ─────

// GetLigneByID — fetch une ligne par ID (RLS via JOIN Devis).
// (nil, nil) si non trouvée ou non visible.
func (r *DevisRepository) GetLigneByID(ctx context.Context, auth *database.AuthUser, ligneID string) (*model.LigneDevis, error) {
        var l model.LigneDevis
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Devis" ON "Devis".id = "LigneDevis"."devisId"`).
                        Where(`"LigneDevis".id = ?`, ligneID).
                        First(&l).Error
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
        if l.ID == "" {
                return nil, nil
        }
        return &l, nil
}

// CreateLigne — insère une nouvelle ligne de devis.
func (r *DevisRepository) CreateLigne(ctx context.Context, auth *database.AuthUser, l model.LigneDevis) (*model.LigneDevis, error) {
        if l.ID == "" {
                l.ID = newCuidLikeID()
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&l).Error
        })
        if err != nil {
                return nil, err
        }
        return &l, nil
}

// UpdateLigne — met à jour une ligne par ID (RLS via JOIN Devis).
func (r *DevisRepository) UpdateLigne(ctx context.Context, auth *database.AuthUser, ligneID string, updates map[string]any) (*model.LigneDevis, error) {
        var updated model.LigneDevis
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.LigneDevis{}).
                        Joins(`JOIN "Devis" ON "Devis".id = "LigneDevis"."devisId"`).
                        Where(`"LigneDevis".id = ?`, ligneID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.LigneDevis{}).Where("id = ?", ligneID).Updates(updates).Error; err != nil {
                        return err
                }
                if err := tx.Where("id = ?", ligneID).First(&updated).Error; err != nil {
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

// DeleteLigne — supprime une ligne par ID (RLS via JOIN Devis). Idempotent.
func (r *DevisRepository) DeleteLigne(ctx context.Context, auth *database.AuthUser, ligneID string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.LigneDevis{}).
                        Joins(`JOIN "Devis" ON "Devis".id = "LigneDevis"."devisId"`).
                        Where(`"LigneDevis".id = ?`, ligneID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", ligneID).Delete(&model.LigneDevis{}).Error
        })
}

// ListLignesByDevis — toutes les lignes d'un devis (RLS via JOIN Devis).
func (r *DevisRepository) ListLignesByDevis(ctx context.Context, auth *database.AuthUser, devisID string) ([]model.LigneDevis, error) {
        var items []model.LigneDevis
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.
                        Joins(`JOIN "Devis" ON "Devis".id = "LigneDevis"."devisId"`).
                        Where(`"LigneDevis"."devisId" = ?`, devisID).
                        Order(`"LigneDevis".ordre ASC`).
                        Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}
