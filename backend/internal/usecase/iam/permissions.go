// Package iam — permissions.go
// Use case pour la liste des configurations de permissions (Phase 2).
//
// Les PermissionConfig sont tenant-scoped (RLS via WithTenant).
// Réservées aux SUPER_ADMIN et GERANT (RBAC au niveau route).
package iam

import (
	"context"
	"log/slog"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// PermissionsRepo — interface définie côté usecase.
// Implémentée par repository/gorm.PermissionConfigRepository.
type PermissionsRepo interface {
	List(ctx context.Context, auth *database.AuthUser) ([]model.PermissionConfig, error)
}

// PermissionsUsecase — cas d'usage pour les permissions.
type PermissionsUsecase struct {
	repo PermissionsRepo
	log  *slog.Logger
}

// NewPermissionsUsecase constructeur.
func NewPermissionsUsecase(repo PermissionsRepo, log *slog.Logger) *PermissionsUsecase {
	return &PermissionsUsecase{repo: repo, log: log}
}

// List — retourne toutes les PermissionConfig visibles par le tenant (RLS-filtered).
func (uc *PermissionsUsecase) List(ctx context.Context, auth *database.AuthUser) ([]model.PermissionConfig, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}

	perms, err := uc.repo.List(ctx, auth)
	if err != nil {
		uc.log.Error("iam.Permissions.List", "err", err, "auth_uid", auth.UserID)
		return nil, domain.ErrInternal
	}
	return perms, nil
}
