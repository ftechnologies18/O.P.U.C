// Package gorm — carburant_repo.go
// Repository pour la gestion du carburant (Phase 3, write métier).
//
// Tables : StockCarburant, EntreeCarburant, SortieCarburant, BonAchatCarburant,
// ReleveCompteurEngin. Aucune n'a de RLS direct : filtrage via JOIN sur
// "Chantier" (RLS-protected) pour les tables avec chantierId.
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/carburant"

        "gorm.io/gorm"
)

// CarburantRepository — repository tenant-scoped pour le carburant.
type CarburantRepository struct {
        db *gorm.DB
}

// NewCarburantRepository constructeur.
func NewCarburantRepository(runtimeDB *gorm.DB) *CarburantRepository {
        return &CarburantRepository{db: runtimeDB}
}

// compile-time check.
var _ carburant.Repo = (*CarburantRepository)(nil)

// ── StockCarburant ─────────────────────────────────────────────

// ListStock — liste des stocks carburant (RLS via JOIN Chantier).
func (r *CarburantRepository) ListStock(ctx context.Context, auth *database.AuthUser, chantierID, typeCarburant string) ([]model.StockCarburant, error) {
        var items []model.StockCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.StockCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockCarburant"."chantierId"`)
                if chantierID != "" {
                        q = q.Where(`"StockCarburant"."chantierId" = ?`, chantierID)
                }
                if typeCarburant != "" {
                        q = q.Where(`"StockCarburant"."typeCarburant" = ?`, typeCarburant)
                }
                return q.Order(`"StockCarburant"."createdAt" DESC`).Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// GetStockByID — fetch par ID (RLS via JOIN Chantier).
func (r *CarburantRepository) GetStockByID(ctx context.Context, auth *database.AuthUser, id string) (*model.StockCarburant, error) {
        var s model.StockCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockCarburant"."chantierId"`).
                        Where(`"StockCarburant".id = ?`, id).
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

// CreateStock — insère un nouveau stock carburant.
func (r *CarburantRepository) CreateStock(ctx context.Context, auth *database.AuthUser, s model.StockCarburant) (*model.StockCarburant, error) {
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

// UpdateStock — met à jour un stock carburant par ID.
func (r *CarburantRepository) UpdateStock(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.StockCarburant, error) {
        var updated model.StockCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.StockCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockCarburant"."chantierId"`).
                        Where(`"StockCarburant".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.StockCarburant{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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

// DeleteStock — supprime un stock carburant par ID (hard delete).
func (r *CarburantRepository) DeleteStock(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.StockCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockCarburant"."chantierId"`).
                        Where(`"StockCarburant".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.StockCarburant{}).Error
        })
}

// QuantitesDisponiblesStock — batch compute quantiteDisponible pour plusieurs stocks.
// Returns map[stockID]quantite = sum(EntreeCarburant.quantite) - sum(SortieCarburant.quantite).
func (r *CarburantRepository) QuantitesDisponiblesStock(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error) {
        if len(stockIDs) == 0 {
                return map[string]float64{}, nil
        }
        out := make(map[string]float64, len(stockIDs))
        for _, id := range stockIDs {
                out[id] = 0
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                type row struct {
                        StockID string  `gorm:"column:stockCarburantId"`
                        Total   float64 `gorm:"column:total"`
                }
                // Entrees — Raw SQL pour éviter les problèmes de mapping camelCase
                var entreeRows []row
                if err := tx.Raw(`SELECT "EntreeCarburant"."stockCarburantId" as "stockCarburantId", COALESCE(SUM("EntreeCarburant".quantite), 0) as "total"
                        FROM "EntreeCarburant"
                        JOIN "Chantier" ON "Chantier".id = "EntreeCarburant"."chantierId"
                        WHERE "EntreeCarburant"."stockCarburantId" IN ?
                        GROUP BY "EntreeCarburant"."stockCarburantId"`, stockIDs).Scan(&entreeRows).Error; err != nil {
                        return fmt.Errorf("sum entrees carburant: %w", err)
                }
                for _, r := range entreeRows {
                        out[r.StockID] += r.Total
                }
                // Sorties (soustraites)
                var sortieRows []row
                if err := tx.Raw(`SELECT "SortieCarburant"."stockCarburantId" as "stockCarburantId", COALESCE(SUM("SortieCarburant".quantite), 0) as "total"
                        FROM "SortieCarburant"
                        JOIN "Chantier" ON "Chantier".id = "SortieCarburant"."chantierId"
                        WHERE "SortieCarburant"."stockCarburantId" IN ?
                        GROUP BY "SortieCarburant"."stockCarburantId"`, stockIDs).Scan(&sortieRows).Error; err != nil {
                        return fmt.Errorf("sum sorties carburant: %w", err)
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

// QuantiteDisponibleStock — compute pour un seul stock.
func (r *CarburantRepository) QuantiteDisponibleStock(ctx context.Context, auth *database.AuthUser, stockID string) (float64, error) {
        m, err := r.QuantitesDisponiblesStock(ctx, auth, []string{stockID})
        if err != nil {
                return 0, err
        }
        return m[stockID], nil
}

// ── EntreeCarburant ────────────────────────────────────────────

// ListEntrees — liste des entrées carburant (RLS via JOIN Chantier).
func (r *CarburantRepository) ListEntrees(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID string) ([]model.EntreeCarburant, error) {
        var items []model.EntreeCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.EntreeCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeCarburant"."chantierId"`)
                if chantierID != "" {
                        q = q.Where(`"EntreeCarburant"."chantierId" = ?`, chantierID)
                }
                if stockCarburantID != "" {
                        q = q.Where(`"EntreeCarburant"."stockCarburantId" = ?`, stockCarburantID)
                }
                return q.Order(`"EntreeCarburant"."dateEntree" DESC`).Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// CreateEntree — insère une nouvelle entrée carburant.
func (r *CarburantRepository) CreateEntree(ctx context.Context, auth *database.AuthUser, e model.EntreeCarburant) (*model.EntreeCarburant, error) {
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

// ── SortieCarburant ────────────────────────────────────────────

// ListSorties — liste des sorties carburant (RLS via JOIN Chantier).
func (r *CarburantRepository) ListSorties(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID, equipementID string) ([]model.SortieCarburant, error) {
        var items []model.SortieCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.SortieCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "SortieCarburant"."chantierId"`)
                if chantierID != "" {
                        q = q.Where(`"SortieCarburant"."chantierId" = ?`, chantierID)
                }
                if stockCarburantID != "" {
                        q = q.Where(`"SortieCarburant"."stockCarburantId" = ?`, stockCarburantID)
                }
                if equipementID != "" {
                        q = q.Where(`"SortieCarburant"."equipementId" = ?`, equipementID)
                }
                return q.Order(`"SortieCarburant"."dateSortie" DESC`).Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// CreateSortie — insère une nouvelle sortie carburant.
func (r *CarburantRepository) CreateSortie(ctx context.Context, auth *database.AuthUser, s model.SortieCarburant) (*model.SortieCarburant, error) {
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

// ── BonAchatCarburant ──────────────────────────────────────────

// ListAchats — liste des bons d'achat carburant (RLS via JOIN Chantier).
func (r *CarburantRepository) ListAchats(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.BonAchatCarburant, error) {
        var items []model.BonAchatCarburant
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.BonAchatCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "BonAchatCarburant"."chantierId"`)
                if chantierID != "" {
                        q = q.Where(`"BonAchatCarburant"."chantierId" = ?`, chantierID)
                }
                if equipementID != "" {
                        q = q.Where(`"BonAchatCarburant"."equipementId" = ?`, equipementID)
                }
                return q.Order(`"BonAchatCarburant"."dateAchat" DESC`).Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// CreateAchat — insère un nouveau bon d'achat carburant.
func (r *CarburantRepository) CreateAchat(ctx context.Context, auth *database.AuthUser, b model.BonAchatCarburant) (*model.BonAchatCarburant, error) {
        if b.ID == "" {
                b.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if b.CreatedAt.IsZero() {
                b.CreatedAt = now
        }
        if b.UpdatedAt.IsZero() {
                b.UpdatedAt = now
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&b).Error
        })
        if err != nil {
                return nil, err
        }
        return &b, nil
}

// ── ReleveCompteurEngin ────────────────────────────────────────

// ListReleves — liste des relevés de compteur (RLS via JOIN Chantier).
func (r *CarburantRepository) ListReleves(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.ReleveCompteurEngin, error) {
        var items []model.ReleveCompteurEngin
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.ReleveCompteurEngin{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "ReleveCompteurEngin"."chantierId"`)
                if chantierID != "" {
                        q = q.Where(`"ReleveCompteurEngin"."chantierId" = ?`, chantierID)
                }
                if equipementID != "" {
                        q = q.Where(`"ReleveCompteurEngin"."equipementId" = ?`, equipementID)
                }
                return q.Order(`"ReleveCompteurEngin"."dateReleve" DESC`).Find(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// CreateReleve — insère un nouveau relevé de compteur.
func (r *CarburantRepository) CreateReleve(ctx context.Context, auth *database.AuthUser, rel model.ReleveCompteurEngin) (*model.ReleveCompteurEngin, error) {
        if rel.ID == "" {
                rel.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if rel.CreatedAt.IsZero() {
                rel.CreatedAt = now
        }
        if rel.UpdatedAt.IsZero() {
                rel.UpdatedAt = now
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&rel).Error
        })
        if err != nil {
                return nil, err
        }
        return &rel, nil
}

// ── Stats helpers ──────────────────────────────────────────────

// SumEntreesByType — non utilisé (l'agrégation par type se fait via le stock).
// Conservé pour interface completeness ; délègue à QuantitesDisponiblesStock.
func (r *CarburantRepository) SumEntreesByType(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error) {
        return map[string]float64{}, nil
}

// SumSortiesByType — idem.
func (r *CarburantRepository) SumSortiesByType(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error) {
        return map[string]float64{}, nil
}

// SumEntreesQuantiteInMonth — SUM(EntreeCarburant.quantite) pour le mois donné.
// RLS via JOIN Chantier.
func (r *CarburantRepository) SumEntreesQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error) {
        start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
        end := start.AddDate(0, 1, 0) // début du mois suivant
        var total float64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                row := tx.Model(&model.EntreeCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeCarburant"."chantierId"`).
                        Where(`"EntreeCarburant"."dateEntree" >= ? AND "EntreeCarburant"."dateEntree" < ?`, start, end).
                        Select(`COALESCE(SUM("EntreeCarburant".quantite), 0)`).
                        Row()
                return row.Scan(&total)
        })
        return total, err
}

// SumSortiesQuantiteInMonth — SUM(SortieCarburant.quantite) pour le mois donné.
func (r *CarburantRepository) SumSortiesQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error) {
        start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
        end := start.AddDate(0, 1, 0)
        var total float64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                row := tx.Model(&model.SortieCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "SortieCarburant"."chantierId"`).
                        Where(`"SortieCarburant"."dateSortie" >= ? AND "SortieCarburant"."dateSortie" < ?`, start, end).
                        Select(`COALESCE(SUM("SortieCarburant".quantite), 0)`).
                        Row()
                return row.Scan(&total)
        })
        return total, err
}

// SumAchatsQuantiteInMonth — SUM(BonAchatCarburant.quantite) pour le mois donné.
func (r *CarburantRepository) SumAchatsQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error) {
        start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
        end := start.AddDate(0, 1, 0)
        var total float64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                row := tx.Model(&model.BonAchatCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "BonAchatCarburant"."chantierId"`).
                        Where(`"BonAchatCarburant"."dateAchat" >= ? AND "BonAchatCarburant"."dateAchat" < ?`, start, end).
                        Select(`COALESCE(SUM("BonAchatCarburant".quantite), 0)`).
                        Row()
                return row.Scan(&total)
        })
        return total, err
}

// ══════════════════════════════════════════════════════════════════
// Phase C — Delete methods for EntreeCarburant, SortieCarburant, BonAchatCarburant, ReleveCompteurEngin
// ══════════════════════════════════════════════════════════════════

// DeleteEntree — supprime une entrée carburant par ID (RLS via JOIN Chantier). Idempotent.
func (r *CarburantRepository) DeleteEntree(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.EntreeCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "EntreeCarburant"."chantierId"`).
                        Where(`"EntreeCarburant".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.EntreeCarburant{}).Error
        })
}

// DeleteSortie — supprime une sortie carburant par ID (RLS via JOIN Chantier). Idempotent.
func (r *CarburantRepository) DeleteSortie(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.SortieCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "SortieCarburant"."chantierId"`).
                        Where(`"SortieCarburant".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.SortieCarburant{}).Error
        })
}

// DeleteAchat — supprime un bon d'achat carburant par ID (RLS via JOIN Chantier). Idempotent.
func (r *CarburantRepository) DeleteAchat(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.BonAchatCarburant{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "BonAchatCarburant"."chantierId"`).
                        Where(`"BonAchatCarburant".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.BonAchatCarburant{}).Error
        })
}

// DeleteReleve — supprime un relevé compteur par ID (RLS via JOIN Chantier). Idempotent.
func (r *CarburantRepository) DeleteReleve(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.ReleveCompteurEngin{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "ReleveCompteurEngin"."chantierId"`).
                        Where(`"ReleveCompteurEngin".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.ReleveCompteurEngin{}).Error
        })
}
