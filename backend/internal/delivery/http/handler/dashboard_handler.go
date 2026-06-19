// Package handler — dashboard_handler.go
// Handler HTTP pour /api/v1/dashboard (Phase 2, KPIs agrégés).
//
// Route :
//   GET /api/v1/dashboard — KPIs + budgetData (auth requis)
//
// Toutes les requêtes sont tenant-scoped (RLS) sauf unreadNotifications (user-scoped).
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/dashboard"
)

// DashboardHandler — handler HTTP pour /api/v1/dashboard.
type DashboardHandler struct {
	uc  *dashboard.Usecase
	log *slog.Logger
}

// NewDashboardHandler constructeur.
func NewDashboardHandler(uc *dashboard.Usecase, log *slog.Logger) *DashboardHandler {
	return &DashboardHandler{uc: uc, log: log}
}

// Get — GET /api/v1/dashboard
// Calcule tous les KPIs + budgetData pour le user courant.
func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	out, err := h.uc.Get(r.Context(), au, au.UserID)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrUnauthorized):
			WriteError(w, http.StatusUnauthorized, "unauthorized")
		default:
			h.log.Error("dashboard.Get", "err", err)
			WriteError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	// Conversion []dashboard.BudgetItem → []dto.BudgetItemDTO
	budgetData := make([]dto.BudgetItemDTO, 0, len(out.BudgetData))
	for i := range out.BudgetData {
		b := &out.BudgetData[i]
		budgetData = append(budgetData, dto.BudgetItemDTO{
			ID:                 b.ID,
			Nom:                b.Nom,
			BudgetPrevisionnel: b.BudgetPrevisionnel,
			CoutReel:           b.CoutReel,
			Statut:             b.Statut,
		})
	}

	WriteJSON(w, http.StatusOK, dto.DashboardResponse{
		ChantiersActifs:     out.ChantiersActifs,
		JournaliersSurSite:  out.JournaliersSurSite,
		PointagesAujourdhui: out.PointagesAujourdhui,
		TachesEnRetard:      out.TachesEnRetard,
		AlertesActives:      out.AlertesActives,
		UnreadNotifications: out.UnreadNotifications,
		StockAlerts:         out.StockAlerts,
		BudgetData:          budgetData,
	})
}
