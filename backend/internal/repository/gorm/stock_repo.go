// Package gorm — stock_repo.go
// Repository pour le stock de matériel (Phase 3, write métier).
//
// Tables concernées : StockMateriel, EntreeStock, SortieStock.
// Aucune n'a de RLS direct : filtrage via JOIN sur "Chantier" (RLS-protected).
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/stock"

        "gorm.io/gorm"
)

// StockRepository — repository tenant-scoped pour le stock de matériel.
type StockRepository struct {
        db *gorm.DB
}

// NewStockRepository constructeur.
func NewStockRepository(runtimeDB *gorm.DB) *StockRepository {
        return &StockRepository{db: runtimeDB}
}

// compile-time check.
var _ stock.Repo = (*StockRepository)(nil)

// ── StockMateriel ──────────────────────────────────────────────

// List — liste paginée des stocks (RLS via JOIN Chantier).
// search : ILIKE sur reference, designation, categorie.
func (r *StockRepository) List(ctx context.Context, auth *database.AuthUser, filter stock.ListInput) ([]model.StockMateriel, int64, error) {
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
                items []model.StockMateriel
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.StockMateriel{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockMateriel"."chantierId"`)
                if filter.ChantierID != "" {
                        q = q.Where(`"StockMateriel"."chantierId" = ?`, filter.ChantierID)
                }
                if filter.Categorie != "" {
                        q = q.Where(`"StockMateriel".categorie = ?`, filter.Categorie)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where(`"StockMateriel".designation ILIKE ? OR "StockMateriel".reference ILIKE ? OR "StockMateriel".categorie ILIKE ?`, like, like, like)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count stocks: %w", err)
                }
                if err := q.
                        Order(`"StockMateriel"."createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list stocks: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetByID — fetch un stock par ID (RLS via JOIN Chantier).
func (r *StockRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.StockMateriel, error) {
        var s model.StockMateriel
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockMateriel"."chantierId"`).
                        Where(`"StockMateriel".id = ?`, id).
                        First(&s).Error
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
        if s.ID == "" {
                return nil, nil
        }
        return &s, nil
}

// Create — insère un nouveau StockMateriel.
func (r *StockRepository) Create(ctx context.Context, auth *database.AuthUser, s model.StockMateriel) (*model.StockMateriel, error) {
        if s.ID == "" {
                s.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if s.CreatedAt.IsZero() {
                s.CreatedAt = now
        }
        if s.UpdatedAt.IsZero() {
                s.UpdatedAt = now
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&s).Error
        })
        if err != nil {
                return nil, err
        }
        return &s, nil
}

// Update — met à jour un StockMateriel par ID.
func (r *StockRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.StockMateriel, error) {
        var updated model.StockMateriel
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.StockMateriel{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockMateriel"."chantierId"`).
                        Where(`"StockMateriel".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.StockMateriel{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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

// Delete — supprime un StockMateriel par ID (hard delete).
func (r *StockRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.StockMateriel{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockMateriel"."chantierId"`).
                        Where(`"StockMateriel".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.StockMateriel{}).Error
        })
}

// QuantitesDisponibles — batch compute quantiteDisponible pour plusieurs stocks.
// Returns map[stockID]quantiteDisponible = sum(EntreeStock.quantite) - sum(SortieStock.quantite).
// RLS via JOIN Chantier sur EntreeStock et SortieStock.
func (r *StockRepository) QuantitesDisponibles(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error) {
        if len(stockIDs) == 0 {
                return map[string]float64{}, nil
        }
        out := make(map[string]float64, len(stockIDs))
        for _, id := range stockIDs {
                out[id] = 0
        }

        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Entrees — Raw SQL pour éviter les problèmes de mapping camelCase
                type row struct {
                        StockID string  `gorm:"column:stockId"`
                        Total   float64 `gorm:"column:total"`
                }
                var entreeRows []row
                if err := tx.Raw(`SELECT "EntreeStock"."stockId" as "stockId", COALESCE(SUM("EntreeStock".quantite), 0) as "total"
                        FROM "EntreeStock"
                        JOIN "Chantier" ON "Chantier".id = "EntreeStock"."chantierId"
                        WHERE "EntreeStock"."stockId" IN ?
                        GROUP BY "EntreeStock"."stockId"`, stockIDs).Scan(&entreeRows).Error; err != nil {
                        return fmt.Errorf("sum entrees: %w", err)
                }
                for _, r := range entreeRows {
                        out[r.StockID] += r.Total
                }

                // Sorties (soustraites)
                var sortieRows []row
                if err := tx.Raw(`SELECT "SortieStock"."stockId" as "stockId", COALESCE(SUM("SortieStock".quantite), 0) as "total"
                        FROM "SortieStock"
                        JOIN "Chantier" ON "Chantier".id = "SortieStock"."chantierId"
                        WHERE "SortieStock"."stockId" IN ?
                        GROUP BY "SortieStock"."stockId"`, stockIDs).Scan(&sortieRows).Error; err != nil {
                        return fmt.Errorf("sum sorties: %w", err)
                }
                for _, r := range sortieRows {
                        out[r.StockID] -= r.Total
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        return out, nil
}

// QuantiteDisponible — compute pour un seul stock.
func (r *StockRepository) QuantiteDisponible(ctx context.Context, auth *database.AuthUser, stockID string) (float64, error) {
        m, err := r.QuantitesDisponibles(ctx, auth, []string{stockID})
        if err != nil {
                return 0, err
        }
        return m[stockID], nil
}

// ListEntreesByStock — toutes les entrées d'un stock (non paginées, pour le détail).
func (r *StockRepository) ListEntreesByStock(ctx context.Context, auth *database.AuthUser, stockID string) ([]model.EntreeStock, error) {
        var items []model.EntreeStock
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeStock"."chantierId"`).
                        Where(`"EntreeStock"."stockId" = ?`, stockID).
                        Order(`"EntreeStock"."dateEntree" DESC`).
                        Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// ListSortiesByStock — toutes les sorties d'un stock (non paginées, pour le détail).
func (r *StockRepository) ListSortiesByStock(ctx context.Context, auth *database.AuthUser, stockID string) ([]model.SortieStock, error) {
        var items []model.SortieStock
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "SortieStock"."chantierId"`).
                        Where(`"SortieStock"."stockId" = ?`, stockID).
                        Order(`"SortieStock"."dateSortie" DESC`).
                        Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// ── EntreeStock ────────────────────────────────────────────────

// ListEntrees — liste paginée des entrées de stock (RLS via JOIN Chantier).
func (r *StockRepository) ListEntrees(ctx context.Context, auth *database.AuthUser, filter stock.EntreeSortieListInput) ([]model.EntreeStock, int64, error) {
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
                items []model.EntreeStock
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.EntreeStock{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeStock"."chantierId"`)
                if filter.ChantierID != "" {
                        q = q.Where(`"EntreeStock"."chantierId" = ?`, filter.ChantierID)
                }
                if filter.StockID != "" {
                        q = q.Where(`"EntreeStock"."stockId" = ?`, filter.StockID)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count entrees: %w", err)
                }
                if err := q.
                        Order(`"EntreeStock"."dateEntree" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list entrees: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// CreateEntree — insère une nouvelle entrée de stock.
func (r *StockRepository) CreateEntree(ctx context.Context, auth *database.AuthUser, e model.EntreeStock) (*model.EntreeStock, error) {
        if e.ID == "" {
                e.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if e.CreatedAt.IsZero() {
                e.CreatedAt = now
        }
        if e.UpdatedAt.IsZero() {
                e.UpdatedAt = now
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&e).Error
        })
        if err != nil {
                return nil, err
        }
        return &e, nil
}

// ── SortieStock ────────────────────────────────────────────────

// ListSorties — liste paginée des sorties de stock (RLS via JOIN Chantier).
func (r *StockRepository) ListSorties(ctx context.Context, auth *database.AuthUser, filter stock.EntreeSortieListInput) ([]model.SortieStock, int64, error) {
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
                items []model.SortieStock
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.SortieStock{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "SortieStock"."chantierId"`)
                if filter.ChantierID != "" {
                        q = q.Where(`"SortieStock"."chantierId" = ?`, filter.ChantierID)
                }
                if filter.StockID != "" {
                        q = q.Where(`"SortieStock"."stockId" = ?`, filter.StockID)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count sorties: %w", err)
                }
                if err := q.
                        Order(`"SortieStock"."dateSortie" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list sorties: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// CreateSortie — insère une nouvelle sortie de stock.
func (r *StockRepository) CreateSortie(ctx context.Context, auth *database.AuthUser, s model.SortieStock) (*model.SortieStock, error) {
        if s.ID == "" {
                s.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if s.CreatedAt.IsZero() {
                s.CreatedAt = now
        }
        if s.UpdatedAt.IsZero() {
                s.UpdatedAt = now
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&s).Error
        })
        if err != nil {
                return nil, err
        }
        return &s, nil
}
