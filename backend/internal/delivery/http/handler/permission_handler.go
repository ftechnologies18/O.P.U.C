// Package handler — permission_handler.go
// Handler HTTP pour /api/v1/permissions (Phase 2).
//
// Route :
//   GET /api/v1/permissions — liste des PermissionConfig (SUPER_ADMIN, GERANT)
//
// Tenant-scoped via RLS (WithTenant).
package handler

import (
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/usecase/iam"
)

// PermissionHandler — handler HTTP pour /api/v1/permissions.
type PermissionHandler struct {
	uc  *iam.PermissionsUsecase
	log *slog.Logger
}

// NewPermissionHandler constructeur.
func NewPermissionHandler(uc *iam.PermissionsUsecase, log *slog.Logger) *PermissionHandler {
	return &PermissionHandler{uc: uc, log: log}
}

// List — GET /api/v1/permissions
// Retourne toutes les PermissionConfig visibles par le tenant (RLS-filtered).
func (h *PermissionHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	perms, err := h.uc.List(r.Context(), au)
	if err != nil {
		h.log.Error("permission.List", "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	WriteJSON(w, http.StatusOK, dto.PermissionsListResponse{Data: perms})
}
