// Package handler — audit_log_handler.go
// Handler HTTP pour /api/v1/audit-logs (Phase 2).
//
// Route :
//   GET /api/v1/audit-logs — liste paginée des AuditLog (SUPER_ADMIN, GERANT)
//
// Tenant-scoped via RLS (WithTenant).
package handler

import (
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/usecase/iam"
)

// AuditLogHandler — handler HTTP pour /api/v1/audit-logs.
type AuditLogHandler struct {
	uc  *iam.AuditLogUsecase
	log *slog.Logger
}

// NewAuditLogHandler constructeur.
func NewAuditLogHandler(uc *iam.AuditLogUsecase, log *slog.Logger) *AuditLogHandler {
	return &AuditLogHandler{uc: uc, log: log}
}

// List — GET /api/v1/audit-logs?page=1&pageSize=50
// Retourne une page de logs d'audit (RLS-filtered), ordonnés par createdAt DESC.
func (h *AuditLogHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	page := atoiDefault(r.URL.Query().Get("page"), 1)
	pageSize := atoiDefault(r.URL.Query().Get("pageSize"), 50)

	out, err := h.uc.List(r.Context(), au, page, pageSize)
	if err != nil {
		h.log.Error("audit_log.List", "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	WriteJSON(w, http.StatusOK, dto.AuditLogsListResponse{
		Data:     out.Data,
		Total:    out.Total,
		Page:     out.Page,
		PageSize: out.PageSize,
	})
}
