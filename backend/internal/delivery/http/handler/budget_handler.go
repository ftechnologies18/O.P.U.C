// Package handler — budget_handler.go
// Handler HTTP pour /api/v1/budget (PHASE-B-BUDGET, agrégation des coûts).
//
// Route (cf. router.go) :
//
//	GET /api/v1/budget/{chantierId} — agrégation des coûts d'un chantier
//
// Réponse JSON : cf. budget.BudgetData (structure alignée sur le frontend
// frontend/src/components/budget/budget-view.tsx).
//
// RBAC (router.go) : RequireAccess(model.DomainFinance, model.PermLecture).
// Le budget est un domaine financier (cf. domain/model/delegation.go →
// DomainModules[DomainFinance] inclut "budget").
//
// Le handler extrait *database.AuthUser du context (injecté par middleware.Auth)
// pour le RLS, et le paramètre {chantierId} de l'URL via chi.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/domain"
	"opuc/internal/usecase/budget"
)

// BudgetHandler — handler HTTP pour /api/v1/budget.
type BudgetHandler struct {
	uc  *budget.Usecase
	log *slog.Logger
}

// NewBudgetHandler constructeur.
func NewBudgetHandler(uc *budget.Usecase, log *slog.Logger) *BudgetHandler {
	return &BudgetHandler{uc: uc, log: log}
}

// Get — GET /api/v1/budget/{chantierId}
//
// Retourne l'agrégation des coûts d'un chantier :
//   - budgetPrevisionnel (depuis Chantier)
//   - coutPersonnel (PaiementHebdo + SalaireMensuel)
//   - coutMateriaux (EntreeStock)
//   - coutSousTraitants (ContratST)
//   - coutLocations (LocationEngin)
//   - coutTotal + ecart + ecartPourcentage + niveauAlerte
//   - historique mensuel (année courante)
//   - repartition par catégorie
//
// Codes HTTP :
//
//	200 — OK (BudgetData, même si toutes les valeurs sont à 0)
//	400 — chantierId manquant dans l'URL
//	401 — non authentifié
//	404 — chantier introuvable ou non visible (RLS)
//	500 — erreur interne
func (h *BudgetHandler) Get(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	chantierID := chi.URLParam(r, "chantierId")
	if chantierID == "" {
		WriteError(w, http.StatusBadRequest, "chantierId is required")
		return
	}

	out, err := h.uc.Get(r.Context(), au, chantierID)
	if err != nil {
		writeBudgetError(w, h.log, "budget.Get", err)
		return
	}

	WriteJSON(w, http.StatusOK, out)
}

// writeBudgetError mappe les erreurs domain → HTTP status pour le handler budget.
func writeBudgetError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "chantier not found")
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}
