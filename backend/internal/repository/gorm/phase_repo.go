// Package gorm — phase_repo.go
// Repository pour les Phases et Tâches (Phase 3, délégation de suivi).
//
// Tables sans RLS direct :
//   - Phase : filtrage tenant via JOIN sur "Chantier" (RLS-protected)
//   - Tache : filtrage tenant via JOIN "Phase" → "Chantier"
//
// Si le chantierID / phaseID n'appartient pas au tenant, le JOIN renvoie 0
// lignes → l'opération est soit no-op (Update/Delete), soit rejetée (Create
// via un check explicite de visibilité du parent).
//
// Cascade : DeletePhase supprime d'abord les Taches de la phase, puis la
// Phase elle-même (tout dans la même transaction WithTenant).
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/phase"

        "gorm.io/gorm"
)

// PhaseRepository — repository tenant-scoped pour les Phases et Tâches.
type PhaseRepository struct {
        db *gorm.DB // runtime (app_user) connection — RLS enforced
}

// NewPhaseRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewPhaseRepository(runtimeDB *gorm.DB) *PhaseRepository {
        return &PhaseRepository{db: runtimeDB}
}

// compile-time check : PhaseRepository implémente phase.Repo.
var _ phase.Repo = (*PhaseRepository)(nil)

// ══════════════════════════════════════════════════════════════════
// Phase CRUD
// ══════════════════════════════════════════════════════════════════

// CreatePhase — insère une nouvelle phase.
//
// Étapes (dans la même transaction RLS) :
//  1. Vérifie que le chantier parent est visible dans le tenant (SELECT sur
//     "Chantier" — RLS-protected). Si 0 ligne → ErrBadRequest (chantier non
//     trouvé dans le tenant).
//  2. Génère un ID cuid-like si vide, set createdAt/updatedAt.
//  3. INSERT la phase.
func (r *PhaseRepository) CreatePhase(ctx context.Context, auth *database.AuthUser, p model.Phase) (*model.Phase, error) {
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
                // 1. Vérifie que le chantier parent est visible dans le tenant
                var n int64
                if err := tx.Model(&model.Chantier{}).
                        Where("id = ?", p.ChantierID).
                        Count(&n).Error; err != nil {
                        return fmt.Errorf("check chantier: %w", err)
                }
                if n == 0 {
                        return fmt.Errorf("chantier %q not found in tenant", p.ChantierID)
                }

                // 2. INSERT la phase
                return tx.Create(&p).Error
        })
        if err != nil {
                return nil, err
        }
        return &p, nil
}

// UpdatePhase — met à jour une phase par ID (partial updates via map).
// Le filtrage tenant se fait via JOIN "Chantier" (RLS-protected) :
// si la phase n'appartient pas à un chantier du tenant → 0 ligne → (nil, nil).
func (r *PhaseRepository) UpdatePhase(ctx context.Context, auth *database.AuthUser, phaseID string, updates map[string]any) (*model.Phase, error) {
        // Force updatedAt
        updates["updatedAt"] = time.Now().UTC()

        var updated model.Phase
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Applique les updates en JOIN-ant sur Chantier pour le RLS
                // (GORM ne supporte pas directement Updates + Joins, on fait en 2 étapes :
                //  1. SELECT id FROM Phase JOIN Chantier WHERE Phase.id = ? → vérifie visibilité
                //  2. UPDATE Phase WHERE id = ?)
                var exists int64
                if err := tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase".id = ?`, phaseID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // (nil, nil) → phase non visible par RLS
                }

                // Applique les updates
                if err := tx.Model(&model.Phase{}).Where("id = ?", phaseID).Updates(updates).Error; err != nil {
                        return err
                }

                // Recharge la phase mise à jour
                if err := tx.Where("id = ?", phaseID).First(&updated).Error; err != nil {
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

// DeletePhase — supprime une phase (cascade delete ses tâches d'abord).
// RLS via JOIN "Chantier" : si la phase n'est pas visible → no-op (idempotent).
func (r *PhaseRepository) DeletePhase(ctx context.Context, auth *database.AuthUser, phaseID string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // 1. Vérifie l'existence + visibilité (RLS via JOIN Chantier)
                var exists int64
                if err := tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase".id = ?`, phaseID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // idempotent — phase invisible → nothing to delete
                }

                // 2. Cascade : supprime les tâches de la phase
                if err := tx.Where(`"phaseId" = ?`, phaseID).Delete(&model.Tache{}).Error; err != nil {
                        return fmt.Errorf("cascade delete Tache: %w", err)
                }

                // 3. Supprime la phase
                return tx.Where("id = ?", phaseID).Delete(&model.Phase{}).Error
        })
}

// GetPhaseByID — fetch une phase par ID (RLS via JOIN Chantier).
// (nil, nil) si non trouvée ou non visible par RLS.
func (r *PhaseRepository) GetPhaseByID(ctx context.Context, auth *database.AuthUser, phaseID string) (*model.Phase, error) {
        var p model.Phase
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase".id = ?`, phaseID).
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

// ══════════════════════════════════════════════════════════════════
// Tache CRUD
// ══════════════════════════════════════════════════════════════════

// CreateTache — insère une nouvelle tâche.
//
// Étapes (dans la même transaction RLS) :
//  1. Vérifie que la phase parente est visible dans le tenant (JOIN Phase →
//     Chantier RLS-protected). Si 0 ligne → ErrBadRequest.
//  2. Génère un ID cuid-like si vide, set createdAt/updatedAt.
//  3. INSERT la tâche.
//
// Note : si responsableId est fourni mais n'existe pas dans le tenant
// (User RLS-protected), la FK échouera → l'usecase convertit en ErrBadRequest.
func (r *PhaseRepository) CreateTache(ctx context.Context, auth *database.AuthUser, t model.Tache) (*model.Tache, error) {
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
        // Defaults défensifs
        if t.Statut == "" {
                t.Statut = "PLANIFIEE"
        }

        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // 1. Vérifie que la phase parente est visible dans le tenant
                var n int64
                if err := tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase".id = ?`, t.PhaseID).
                        Count(&n).Error; err != nil {
                        return fmt.Errorf("check phase: %w", err)
                }
                if n == 0 {
                        return fmt.Errorf("phase %q not found in tenant", t.PhaseID)
                }

                // 2. INSERT la tâche
                return tx.Create(&t).Error
        })
        if err != nil {
                return nil, err
        }
        return &t, nil
}

// UpdateTache — met à jour une tâche par ID (partial updates via map).
// RLS via JOIN Phase → Chantier : si la tâche n'est pas visible → (nil, nil).
func (r *PhaseRepository) UpdateTache(ctx context.Context, auth *database.AuthUser, tacheID string, updates map[string]any) (*model.Tache, error) {
        // Force updatedAt
        updates["updatedAt"] = time.Now().UTC()

        var updated model.Tache
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Vérifie l'existence + visibilité via JOIN Phase → Chantier
                var exists int64
                if err := tx.Model(&model.Tache{}).
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache".id = ?`, tacheID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // (nil, nil) → tâche non visible par RLS
                }

                // Applique les updates
                if err := tx.Model(&model.Tache{}).Where("id = ?", tacheID).Updates(updates).Error; err != nil {
                        return err
                }

                // Recharge la tâche mise à jour
                if err := tx.Where("id = ?", tacheID).First(&updated).Error; err != nil {
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

// DeleteTache — supprime une tâche.
// RLS via JOIN Phase → Chantier : si la tâche n'est pas visible → no-op (idempotent).
func (r *PhaseRepository) DeleteTache(ctx context.Context, auth *database.AuthUser, tacheID string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // 1. Vérifie l'existence + visibilité
                var exists int64
                if err := tx.Model(&model.Tache{}).
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache".id = ?`, tacheID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // idempotent
                }

                // 2. Supprime la tâche
                return tx.Where("id = ?", tacheID).Delete(&model.Tache{}).Error
        })
}

// GetTacheByID — fetch une tâche par ID (RLS via JOIN Phase → Chantier).
// (nil, nil) si non trouvée ou non visible par RLS.
func (r *PhaseRepository) GetTacheByID(ctx context.Context, auth *database.AuthUser, tacheID string) (*model.Tache, error) {
        var t model.Tache
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache".id = ?`, tacheID).
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

// ══════════════════════════════════════════════════════════════════
// Mes tâches (page /mes-taches)
// ══════════════════════════════════════════════════════════════════

// ListMyTaches — liste toutes les tâches où responsableId = userID,
// avec Phase.Chantier préloadé pour le contexte.
//
// Le filtrage tenant se fait via JOIN Phase → Chantier (RLS-protected) :
// un user ne voit que les tâches des chantiers de son entreprise.
//
// La requête utilise :
//   - 2 JOINs pour le filtrage RLS (Phase + Chantier)
//   - Preload("Phase.Chantier") pour charger les relations dans la réponse
//     (Preload fait des queries séparées, qui héritent du contexte RLS)
func (r *PhaseRepository) ListMyTaches(ctx context.Context, auth *database.AuthUser, userID string) ([]model.Tache, int64, error) {
        var (
                items []model.Tache
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Tache{}).
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache"."responsableId" = ?`, userID)

                // 1. Count total
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count my taches: %w", err)
                }

                // 2. List avec Preload Phase.Chantier pour le contexte
                //    (Preload fait des queries séparées — héritent du RLS)
                if err := q.
                        Preload("Phase.Chantier").
                        Order(`"Tache"."createdAt" DESC`).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list my taches: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// UpdateMyTacheAvancement — update avancement + statut d'une tâche dont l'user
// est responsable. Vérifie ownership via WHERE id = ? AND responsableId = ?
// (RLS via JOIN Phase→Chantier pour le filtrage tenant).
//
// Retourne (nil, nil) si la tâche n'existe pas OU si l'user n'en est pas responsable.
func (r *PhaseRepository) UpdateMyTacheAvancement(ctx context.Context, auth *database.AuthUser, tacheID, userID string, updates map[string]any) (*model.Tache, error) {
        var updated model.Tache
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Vérifie ownership + RLS via JOIN
                var exists int64
                if err := tx.Model(&model.Tache{}).
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache".id = ? AND "Tache"."responsableId" = ?`, tacheID, userID).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // non trouvé ou non owner → (nil, nil)
                }
                // Applique l'update
                if err := tx.Model(&model.Tache{}).
                        Where(`id = ? AND "responsableId" = ?`, tacheID, userID).
                        Updates(updates).Error; err != nil {
                        return err
                }
                // Recharge avec Preload Phase.Chantier pour la réponse
                if err := tx.
                        Preload("Phase.Chantier").
                        Where(`id = ?`, tacheID).
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
