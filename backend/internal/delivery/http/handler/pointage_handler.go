// Package handler — pointage_handler.go
// Handlers HTTP pour /api/v1/pointage (Phase 3, write métier).
//
// Routes (cf. router.go) :
//   GET    /api/v1/pointage            — list paginée (auth requis)
//   GET    /api/v1/pointage/summary    — agrégats par chantier + date range (auth requis)
//   GET    /api/v1/pointage/{id}       — get by id (auth requis)
//   POST   /api/v1/pointage            — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   PUT    /api/v1/pointage/{id}       — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/pointage/{id}       — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   POST   /api/v1/pointage/{id}/validate — set valide=true (CHEF_PROJET, GERANT, SUPER_ADMIN)
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/pointage"
)

// PointageHandler — handlers HTTP pour /api/v1/pointage.
type PointageHandler struct {
	uc  *pointage.Usecase
	log *slog.Logger
}

// NewPointageHandler constructeur.
func NewPointageHandler(uc *pointage.Usecase, log *slog.Logger) *PointageHandler {
	return &PointageHandler{uc: uc, log: log}
}

// List — GET /api/v1/pointage
// Query params (tous optionnels) :
//   ?chantierId=xxx
//   ?journalierId=xxx
//   ?date=2025-01-30        — ISO 8601 (RFC3339 ou YYYY-MM-DD)
//   ?page=1                 — 1-based (défaut 1)
//   ?pageSize=50            — défaut 50
func (h *PointageHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	in := pointage.ListInput{
		ChantierID:   r.URL.Query().Get("chantierId"),
		JournalierID: r.URL.Query().Get("journalierId"),
		Page:         atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	if d := r.URL.Query().Get("date"); d != "" {
		t, err := parseDate(d)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid date format")
			return
		}
		in.Date = t
	}

	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writePointageError(w, h.log, "pointage.List", err)
		return
	}

	WriteJSON(w, http.StatusOK, dto.PointageListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/pointage/{id}
func (h *PointageHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	p, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writePointageError(w, h.log, "pointage.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, p)
}

// Create — POST /api/v1/pointage
// Body : dto.CreatePointageRequest
func (h *PointageHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreatePointageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	dateTravail, err := parseDate(req.DateTravail)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateTravail (use RFC3339 or YYYY-MM-DD)")
		return
	}
	p, err := h.uc.Create(r.Context(), au, pointage.CreateInput{
		JournalierID:   req.JournalierID,
		ChantierID:     req.ChantierID,
		DateTravail:    dateTravail,
		TauxJournalier: req.TauxJournalier,
		Present:        req.Present,
		Observation:    req.Observation,
	})
	if err != nil {
		writePointageError(w, h.log, "pointage.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, p)
}

// Update — PUT /api/v1/pointage/{id}
// Body : dto.UpdatePointageRequest
func (h *PointageHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdatePointageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	p, err := h.uc.Update(r.Context(), au, id, pointage.UpdateInput{
		TauxJournalier: req.TauxJournalier,
		Present:        req.Present,
		Observation:    req.Observation,
	})
	if err != nil {
		writePointageError(w, h.log, "pointage.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, p)
}

// Delete — DELETE /api/v1/pointage/{id}
func (h *PointageHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	if err := h.uc.Delete(r.Context(), au, id); err != nil {
		writePointageError(w, h.log, "pointage.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// Validate — POST /api/v1/pointage/{id}/validate
// Marque valide=true (RBAC: CHEF_PROJET, GERANT, SUPER_ADMIN au niveau route).
func (h *PointageHandler) Validate(w http.ResponseWriter, r *http.Request) {
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
	p, err := h.uc.Validate(r.Context(), au, id)
	if err != nil {
		writePointageError(w, h.log, "pointage.Validate", err)
		return
	}
	WriteJSON(w, http.StatusOK, p)
}

// Summary — GET /api/v1/pointage/summary
// Query params : ?chantierId=xxx&dateDebut=2025-01-01&dateFin=2025-01-31
func (h *PointageHandler) Summary(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	chantierID := r.URL.Query().Get("chantierId")
	if chantierID == "" {
		WriteError(w, http.StatusBadRequest, "chantierId is required")
		return
	}
	dateDebut, err := parseDate(r.URL.Query().Get("dateDebut"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateDebut")
		return
	}
	dateFin, err := parseDate(r.URL.Query().Get("dateFin"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateFin")
		return
	}
	s, err := h.uc.Summary(r.Context(), au, chantierID, dateDebut, dateFin)
	if err != nil {
		writePointageError(w, h.log, "pointage.Summary", err)
		return
	}
	WriteJSON(w, http.StatusOK, s)
}

// writePointageError mappe les erreurs domain → HTTP status.
func writePointageError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "pointage not found")
	case errors.Is(err, domain.ErrConflict):
		WriteError(w, http.StatusConflict, "pointage already exists for this journalier/chantier/date")
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}
