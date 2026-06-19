// Package handler — chantier_handler.go
// Handlers HTTP pour /api/v1/chantiers (Phase 2, lecture métier).
//
// Routes (cf. router.go) :
//   GET /api/v1/chantiers         — list paginée + KPI (auth requis)
//   GET /api/v1/chantiers/{id}    — détail avec phases + taches (auth requis)
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par
// middleware.Auth) pour le RLS.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/chantier"
)

// ChantierHandler — handlers HTTP pour /api/v1/chantiers.
type ChantierHandler struct {
	uc  *chantier.Usecase
	log *slog.Logger
}

// NewChantierHandler constructeur.
func NewChantierHandler(uc *chantier.Usecase, log *slog.Logger) *ChantierHandler {
	return &ChantierHandler{uc: uc, log: log}
}

// List — GET /api/v1/chantiers
// Query params (tous optionnels) :
//   ?statut=EN_COURS     — filtre par statut
//   ?search=xxx          — ILIKE sur nom, adresse, maitreOuvrage
//   ?page=1              — 1-based (défaut 1)
//   ?pageSize=50         — défaut 50
//
// RLS : SUPER_ADMIN voit toutes les entreprises, autres rôles ne voient que la leur.
func (h *ChantierHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	out, err := h.uc.List(r.Context(), au, chantier.ListInput{
		Statut:   r.URL.Query().Get("statut"),
		Search:   r.URL.Query().Get("search"),
		Page:     atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
	})
	if err != nil {
		writeChantierError(w, h.log, "chantier.List", err)
		return
	}

	// Conversion usecase.ChantierWithMeta → dto.ChantierWithMeta
	// (flat PhaseCount/JournalierCount → nested _count {phases, journaliers})
	chantiers := make([]dto.ChantierWithMeta, 0, len(out.Chantiers))
	for i := range out.Chantiers {
		c := &out.Chantiers[i]
		chantiers = append(chantiers, dto.ChantierWithMeta{
			Chantier:         c.Chantier,
			AvancementGlobal: c.AvancementGlobal,
			Count: dto.CountMeta{
				Phases:      c.PhaseCount,
				Journaliers: c.JournalierCount,
			},
		})
	}

	WriteJSON(w, http.StatusOK, dto.ChantierListResponse{
		Chantiers: chantiers,
		KPI: dto.KPIResponse{
			Total:         out.KPI.Total,
			Actifs:        out.KPI.Actifs,
			EnPreparation: out.KPI.EnPreparation,
			Termines:      out.KPI.Termines,
		},
	})
}

// Get — GET /api/v1/chantiers/{id}
// Retourne le chantier avec phases + taches préloadées + avancementGlobal + _count.
// RLS-filtered : un GERANT ne peut pas GET un chantier d'une autre entreprise.
func (h *ChantierHandler) Get(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}

	c, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writeChantierError(w, h.log, "chantier.Get", err)
		return
	}

	WriteJSON(w, http.StatusOK, dto.ChantierWithMeta{
		Chantier:         c.Chantier,
		AvancementGlobal: c.AvancementGlobal,
		Count: dto.CountMeta{
			Phases:      c.PhaseCount,
			Journaliers: c.JournalierCount,
		},
	})
}

// writeChantierError mappe les erreurs domain → HTTP status pour les handlers chantier.
func writeChantierError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
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
