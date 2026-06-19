// Package gorm — paie_repo.go
// Repository pour la paie (PaiementHebdo + SalaireMensuel, Phase 3).
//
// Toutes les méthodes utilisent WithTenant pour activer le RLS.
//   - PaiementHebdo : RLS via JOIN sur "Chantier" (a un chantierId)
//   - SalaireMensuel : RLS via JOIN sur "Journalier" (a un journalierId,
//     Journalier a entrepriseId → RLS-protected)
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/paie"

        "gorm.io/gorm"
)

// PaieRepository — repository tenant-scoped pour la paie.
type PaieRepository struct {
        db *gorm.DB
}

// NewPaieRepository constructeur.
func NewPaieRepository(runtimeDB *gorm.DB) *PaieRepository {
        return &PaieRepository{db: runtimeDB}
}

// compile-time check.
var _ paie.Repo = (*PaieRepository)(nil)

// ── PaiementHebdo ──────────────────────────────────────────────

// ListPaiementHebdo — liste paginée (RLS via JOIN Chantier).
func (r *PaieRepository) ListPaiementHebdo(ctx context.Context, auth *database.AuthUser, filter paie.PaiementHebdoListInput) ([]model.PaiementHebdo, int64, error) {
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
                items []model.PaiementHebdo
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.PaiementHebdo{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "PaiementHebdo"."chantierId"`)
                if filter.ChantierID != "" {
                        q = q.Where(`"PaiementHebdo"."chantierId" = ?`, filter.ChantierID)
                }
                if filter.JournalierID != "" {
                        q = q.Where(`"PaiementHebdo"."journalierId" = ?`, filter.JournalierID)
                }
                if filter.Statut != "" {
                        q = q.Where(`"PaiementHebdo".statut = ?`, filter.Statut)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count paiements hebdo: %w", err)
                }
                if err := q.
                        Order(`"PaiementHebdo"."semaineDebut" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list paiements hebdo: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetPaiementHebdoByID — fetch par ID (RLS via JOIN Chantier).
func (r *PaieRepository) GetPaiementHebdoByID(ctx context.Context, auth *database.AuthUser, id string) (*model.PaiementHebdo, error) {
        var p model.PaiementHebdo
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "PaiementHebdo"."chantierId"`).
                        Where(`"PaiementHebdo".id = ?`, id).
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

// UpdatePaiementHebdo — met à jour un paiement hebdo par ID.
func (r *PaieRepository) UpdatePaiementHebdo(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.PaiementHebdo, error) {
        var updated model.PaiementHebdo
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.PaiementHebdo{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "PaiementHebdo"."chantierId"`).
                        Where(`"PaiementHebdo".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.PaiementHebdo{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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

// ComputeWeeklySums — calcule SUM(tauxJournalier) par journalier pour une semaine.
// Query : SELECT journalierId, SUM(tauxJournalier) FROM "Pointage"
//         WHERE chantierId=? AND present=true AND valide=true
//         AND dateTravail BETWEEN ? AND ?
//         GROUP BY journalierId
// RLS via JOIN sur "Chantier".
func (r *PaieRepository) ComputeWeeklySums(ctx context.Context, auth *database.AuthUser, chantierID string, semaineDebut, semaineFin time.Time) (map[string]float64, error) {
        type row struct {
                JournalierID string  `gorm:"column:journalierId"`
                Total        float64 `gorm:"column:total"`
        }
        var rows []row
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Raw SQL pour éviter les problèmes de mapping camelCase avec GORM builder
                return tx.Raw(`SELECT "Pointage"."journalierId" as "journalierId", COALESCE(SUM("Pointage"."tauxJournalier"), 0) as "total"
                        FROM "Pointage"
                        JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"
                        WHERE "Pointage"."chantierId" = ? AND "Pointage".present = true AND "Pointage".valide = true
                        AND "Pointage"."dateTravail" BETWEEN ? AND ?
                        GROUP BY "Pointage"."journalierId"`,
                        chantierID, semaineDebut, semaineFin).Scan(&rows).Error
        })
        if err != nil {
                return nil, err
        }
        out := make(map[string]float64, len(rows))
        for _, r := range rows {
                out[r.JournalierID] = r.Total
        }
        return out, nil
}

// BulkCreatePaiementHebdo — insère plusieurs PaiementHebdo en une seule transaction.
// Les IDs sont générés (cuid-like).
func (r *PaieRepository) BulkCreatePaiementHebdo(ctx context.Context, auth *database.AuthUser, items []model.PaiementHebdo) ([]model.PaiementHebdo, error) {
        now := time.Now().UTC()
        for i := range items {
                if items[i].ID == "" {
                        items[i].ID = newCuidLikeID()
                }
                if items[i].CreatedAt.IsZero() {
                        items[i].CreatedAt = now
                }
                if items[i].UpdatedAt.IsZero() {
                        items[i].UpdatedAt = now
                }
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&items).Error
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// ── SalaireMensuel ─────────────────────────────────────────────

// ListSalaireMensuel — liste paginée (RLS via JOIN Journalier).
func (r *PaieRepository) ListSalaireMensuel(ctx context.Context, auth *database.AuthUser, filter paie.SalaireMensuelListInput) ([]model.SalaireMensuel, int64, error) {
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
                items []model.SalaireMensuel
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.SalaireMensuel{}).
                        Joins(`JOIN "Journalier" ON "Journalier".id = "SalaireMensuel"."journalierId"`)
                if filter.JournalierID != "" {
                        q = q.Where(`"SalaireMensuel"."journalierId" = ?`, filter.JournalierID)
                }
                if filter.Mois > 0 {
                        q = q.Where(`"SalaireMensuel".mois = ?`, filter.Mois)
                }
                if filter.Annee > 0 {
                        q = q.Where(`"SalaireMensuel".annee = ?`, filter.Annee)
                }
                if filter.Statut != "" {
                        q = q.Where(`"SalaireMensuel".statut = ?`, filter.Statut)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count salaires mensuels: %w", err)
                }
                if err := q.
                        Order(`"SalaireMensuel".annee DESC, "SalaireMensuel".mois DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list salaires mensuels: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetSalaireMensuelByID — fetch par ID (RLS via JOIN Journalier).
func (r *PaieRepository) GetSalaireMensuelByID(ctx context.Context, auth *database.AuthUser, id string) (*model.SalaireMensuel, error) {
        var s model.SalaireMensuel
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Journalier" ON "Journalier".id = "SalaireMensuel"."journalierId"`).
                        Where(`"SalaireMensuel".id = ?`, id).
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

// CreateSalaireMensuel — insère un nouveau salaire mensuel.
func (r *PaieRepository) CreateSalaireMensuel(ctx context.Context, auth *database.AuthUser, s model.SalaireMensuel) (*model.SalaireMensuel, error) {
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

// UpdateSalaireMensuel — met à jour un salaire mensuel par ID.
func (r *PaieRepository) UpdateSalaireMensuel(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.SalaireMensuel, error) {
        var updated model.SalaireMensuel
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.SalaireMensuel{}).
                        Joins(`JOIN "Journalier" ON "Journalier".id = "SalaireMensuel"."journalierId"`).
                        Where(`"SalaireMensuel".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.SalaireMensuel{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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
