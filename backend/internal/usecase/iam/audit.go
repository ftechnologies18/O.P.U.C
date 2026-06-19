// Package iam — audit.go
// Use case pour la liste des logs d'audit (Phase 2).
//
// Les AuditLog sont tenant-scoped (RLS via WithTenant).
// Réservés aux SUPER_ADMIN et GERANT (RBAC au niveau route).
package iam

import (
	"context"
	"log/slog"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// AuditLogRepo — interface définie côté usecase.
// Implémentée par repository/gorm.AuditLogRepository.
type AuditLogRepo interface {
	List(ctx context.Context, auth *database.AuthUser, page, pageSize int) ([]model.AuditLog, int64, error)
}

// AuditLogListOutput — résultat paginé de List.
type AuditLogListOutput struct {
	Data     []model.AuditLog `json:"data"`
	Total    int64            `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"pageSize"`
}

// AuditLogUsecase — cas d'usage pour les logs d'audit.
type AuditLogUsecase struct {
	repo AuditLogRepo
	log  *slog.Logger
}

// NewAuditLogUsecase constructeur.
func NewAuditLogUsecase(repo AuditLogRepo, log *slog.Logger) *AuditLogUsecase {
	return &AuditLogUsecase{repo: repo, log: log}
}

// List — retourne une page de logs d'audit (RLS-filtered).
// page 1-based, pageSize défaut 50.
func (uc *AuditLogUsecase) List(ctx context.Context, auth *database.AuthUser, page, pageSize int) (*AuditLogListOutput, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}

	logs, total, err := uc.repo.List(ctx, auth, page, pageSize)
	if err != nil {
		uc.log.Error("iam.AuditLog.List", "err", err, "auth_uid", auth.UserID)
		return nil, domain.ErrInternal
	}

	return &AuditLogListOutput{
		Data:     logs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}
