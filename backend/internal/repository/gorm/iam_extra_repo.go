// Package gorm — iam_extra_repo.go
// Repositories pour PermissionConfig + AuditLog (Phase 2).
//
// Les deux tables sont tenant-scoped (RLS via WithTenant).
// Implémentent les interfaces iam.PermissionsRepo et iam.AuditLogRepo.
package gorm

import (
        "context"
        "fmt"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/iam"

        "gorm.io/gorm"
)

// ── PermissionConfigRepository ──────────────────────────────────

// PermissionConfigRepository — repository tenant-scoped pour les PermissionConfig.
type PermissionConfigRepository struct {
        db *gorm.DB // Runtime (app_user, RLS enforced)
}

// NewPermissionConfigRepository constructeur.
func NewPermissionConfigRepository(runtimeDB *gorm.DB) *PermissionConfigRepository {
        return &PermissionConfigRepository{db: runtimeDB}
}

// compile-time check : PermissionConfigRepository implémente iam.PermissionsRepo.
var _ iam.PermissionsRepo = (*PermissionConfigRepository)(nil)

// List — retourne toutes les PermissionConfig visibles par le tenant (RLS-filtered).
// Ordonnées par rôle (la table n'a pas de colonne module — permissions est un JSON agrégat).
func (r *PermissionConfigRepository) List(ctx context.Context, auth *database.AuthUser) ([]model.PermissionConfig, error) {
        var perms []model.PermissionConfig
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                if err := tx.Model(&model.PermissionConfig{}).
                        Order("role").
                        Find(&perms).Error; err != nil {
                        return fmt.Errorf("list permission configs: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        return perms, nil
}

// ── AuditLogRepository ──────────────────────────────────────────

// AuditLogRepository — repository tenant-scoped pour les AuditLog.
type AuditLogRepository struct {
        db *gorm.DB // Runtime (app_user, RLS enforced)
}

// NewAuditLogRepository constructeur.
func NewAuditLogRepository(runtimeDB *gorm.DB) *AuditLogRepository {
        return &AuditLogRepository{db: runtimeDB}
}

// compile-time check : AuditLogRepository implémente iam.AuditLogRepo.
var _ iam.AuditLogRepo = (*AuditLogRepository)(nil)

// List — retourne une page de logs d'audit (RLS-filtered).
// page 1-based, pageSize défaut 50. Ordonné par createdAt DESC.
func (r *AuditLogRepository) List(ctx context.Context, auth *database.AuthUser, page, pageSize int) ([]model.AuditLog, int64, error) {
        if page < 1 {
                page = 1
        }
        if pageSize < 1 {
                pageSize = 50
        }
        offset := (page - 1) * pageSize

        var (
                logs  []model.AuditLog
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.AuditLog{})
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count audit logs: %w", err)
                }
                if err := q.
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&logs).Error; err != nil {
                        return fmt.Errorf("list audit logs: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return logs, total, nil
}
