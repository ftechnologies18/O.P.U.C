// Package handler — soustraitant_handler.go
// Handlers HTTP pour /api/v1/sous-traitants/* (Phase 5, peripheral).
//
// Routes (cf. router.go) :
//   GET    /api/v1/sous-traitants                          — list paginée (auth requis)
//   POST   /api/v1/sous-traitants                          — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/sous-traitants/{id}                     — détail avec contrats
//   PUT    /api/v1/sous-traitants/{id}                     — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/sous-traitants/{id}                     — delete (409 si contrats liés)
//   GET    /api/v1/sous-traitants/{id}/contrats            — list contrats
//   POST   /api/v1/sous-traitants/{id}/contrats            — create contrat (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   PUT    /api/v1/sous-traitants/{id}/contrats/{contratId} — update contrat
//   DELETE /api/v1/sous-traitants/{id}/contrats/{contratId} — delete contrat
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/soustraitant"
)

// SousTraitantHandler — handlers HTTP pour /api/v1/sous-traitants.
type SousTraitantHandler struct {
	uc  *soustraitant.Usecase
	log *slog.Logger
}

// NewSousTraitantHandler constructeur.
func NewSousTraitantHandler(uc *soustraitant.Usecase, log *slog.Logger) *SousTraitantHandler {
	return &SousTraitantHandler{uc: uc, log: log}
}

// List — GET /api/v1/sous-traitants
// Query params : ?type=ENTREPRISE&search=xxx&page=1&pageSize=50
func (h *SousTraitantHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := soustraitant.ListInput{
		Type:     r.URL.Query().Get("type"),
		Search:   r.URL.Query().Get("search"),
		Page:     atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SousTraitantListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/sous-traitants/{id}
func (h *SousTraitantHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	st, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// Create — POST /api/v1/sous-traitants
func (h *SousTraitantHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateSousTraitantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	st, err := h.uc.Create(r.Context(), au, soustraitant.CreateInput{
		Type:                req.Type,
		RaisonSociale:       req.RaisonSociale,
		Nom:                 req.Nom,
		Prenom:              req.Prenom,
		RCCM:                req.RCCM,
		NIF:                 req.NIF,
		TypePieceIdentite:   req.TypePieceIdentite,
		NumeroPieceIdentite: req.NumeroPieceIdentite,
		Contact:             req.Contact,
		Email:               req.Email,
		Adresse:             req.Adresse,
		Specialite:          req.Specialite,
		RIB:                 req.RIB,
	})
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, st)
}

// Update — PUT /api/v1/sous-traitants/{id}
func (h *SousTraitantHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdateSousTraitantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	st, err := h.uc.Update(r.Context(), au, id, soustraitant.UpdateInput{
		Type:                req.Type,
		RaisonSociale:       req.RaisonSociale,
		Nom:                 req.Nom,
		Prenom:              req.Prenom,
		RCCM:                req.RCCM,
		NIF:                 req.NIF,
		TypePieceIdentite:   req.TypePieceIdentite,
		NumeroPieceIdentite: req.NumeroPieceIdentite,
		Contact:             req.Contact,
		Email:               req.Email,
		Adresse:             req.Adresse,
		Specialite:          req.Specialite,
		RIB:                 req.RIB,
	})
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, st)
}

// Delete — DELETE /api/v1/sous-traitants/{id}
func (h *SousTraitantHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
		writeSousTraitantError(w, h.log, "soustraitant.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ListContrats — GET /api/v1/sous-traitants/{id}/contrats
func (h *SousTraitantHandler) ListContrats(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.uc.ListContrats(r.Context(), au, id)
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.ListContrats", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.ContratSTListResponse{
		Data:  items,
		Total: int64(len(items)),
	})
}

// CreateContrat — POST /api/v1/sous-traitants/{id}/contrats
func (h *SousTraitantHandler) CreateContrat(w http.ResponseWriter, r *http.Request) {
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
	var req dto.CreateContratSTRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	in := soustraitant.CreateContratInput{
		SousTraitantID: id,
		ChantierID:     req.ChantierID,
		ObjetTravaux:   req.ObjetTravaux,
		MontantHT:      req.MontantHT,
		Conditions:     req.Conditions,
		Statut:         derefStr(req.Statut),
	}
	if req.DateDebut != nil {
		t, err := parseDate(*req.DateDebut)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateDebut (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateDebut = &t
	}
	if req.DateFin != nil {
		t, err := parseDate(*req.DateFin)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateFin (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateFin = &t
	}
	c, err := h.uc.CreateContrat(r.Context(), au, in)
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.CreateContrat", err)
		return
	}
	WriteJSON(w, http.StatusCreated, c)
}

// UpdateContrat — PUT /api/v1/sous-traitants/{id}/contrats/{contratId}
func (h *SousTraitantHandler) UpdateContrat(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	contratID := chi.URLParam(r, "contratId")
	if id == "" || contratID == "" {
		WriteError(w, http.StatusBadRequest, "missing id or contratId")
		return
	}
	var req dto.UpdateContratSTRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	in := soustraitant.UpdateContratInput{
		ObjetTravaux: req.ObjetTravaux,
		MontantHT:    req.MontantHT,
		Conditions:   req.Conditions,
		Statut:       req.Statut,
	}
	if req.DateDebut != nil {
		t, err := parseDate(*req.DateDebut)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateDebut (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateDebut = &t
	}
	if req.DateFin != nil {
		t, err := parseDate(*req.DateFin)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateFin (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateFin = &t
	}
	c, err := h.uc.UpdateContrat(r.Context(), au, id, contratID, in)
	if err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.UpdateContrat", err)
		return
	}
	WriteJSON(w, http.StatusOK, c)
}

// DeleteContrat — DELETE /api/v1/sous-traitants/{id}/contrats/{contratId}
func (h *SousTraitantHandler) DeleteContrat(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	contratID := chi.URLParam(r, "contratId")
	if id == "" || contratID == "" {
		WriteError(w, http.StatusBadRequest, "missing id or contratId")
		return
	}
	if err := h.uc.DeleteContrat(r.Context(), au, id, contratID); err != nil {
		writeSousTraitantError(w, h.log, "soustraitant.DeleteContrat", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": contratID})
}

// writeSousTraitantError mappe les erreurs domain → HTTP status.
func writeSousTraitantError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "sous-traitant not found")
	case errors.Is(err, domain.ErrConflict):
		WriteError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}
