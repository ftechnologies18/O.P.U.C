// Package handler — client_handler.go
// Handlers HTTP pour /api/v1/clients/* (Phase 4, commercial).
//
// Routes (cf. router.go) :
//   GET    /api/v1/clients            — list paginée (auth requis)
//   POST   /api/v1/clients            — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/clients/stats      — stats (auth requis)
//   GET    /api/v1/clients/{id}       — détail avec compteurs (auth requis)
//   PUT    /api/v1/clients/{id}       — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/clients/{id}       — delete (409 si devis/contrats/factures liés)
//
// IMPORTANT : la route statique /clients/stats doit être enregistrée AVANT
// /clients/{id} sinon chi l'interprète comme un ID.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/client"
)

// ClientHandler — handlers HTTP pour /api/v1/clients.
type ClientHandler struct {
	uc  *client.Usecase
	log *slog.Logger
}

// NewClientHandler constructeur.
func NewClientHandler(uc *client.Usecase, log *slog.Logger) *ClientHandler {
	return &ClientHandler{uc: uc, log: log}
}

// List — GET /api/v1/clients
// Query params (tous optionnels) :
//   ?type=ENTREPRISE
//   ?statut=ACTIF
//   ?search=xxx
//   ?page=1
//   ?pageSize=50
func (h *ClientHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := client.ListInput{
		Type:     r.URL.Query().Get("type"),
		Statut:   r.URL.Query().Get("statut"),
		Search:   r.URL.Query().Get("search"),
		Page:     atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writeClientError(w, h.log, "client.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.ClientListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/clients/{id}
func (h *ClientHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	d, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writeClientError(w, h.log, "client.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.ClientDetailResponse{
		Client:         d.Client,
		ChantiersCount: d.ChantiersCount,
		DevisCount:     d.DevisCount,
		FacturesCount:  d.FacturesCount,
	})
}

// Create — POST /api/v1/clients
func (h *ClientHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	c, err := h.uc.Create(r.Context(), au, client.CreateInput{
		RaisonSociale: req.RaisonSociale,
		NomContact:    req.NomContact,
		Telephone:     req.Telephone,
		Email:         req.Email,
		Adresse:       req.Adresse,
		RCCM:          req.RCCM,
		NIF:           req.NIF,
		Type:          req.Type,
		Statut:        req.Statut,
		Notes:         req.Notes,
	})
	if err != nil {
		writeClientError(w, h.log, "client.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, c)
}

// Update — PUT /api/v1/clients/{id}
func (h *ClientHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdateClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	c, err := h.uc.Update(r.Context(), au, id, client.UpdateInput{
		RaisonSociale: req.RaisonSociale,
		NomContact:    req.NomContact,
		Telephone:     req.Telephone,
		Email:         req.Email,
		Adresse:       req.Adresse,
		RCCM:          req.RCCM,
		NIF:           req.NIF,
		Type:          req.Type,
		Statut:        req.Statut,
		Notes:         req.Notes,
	})
	if err != nil {
		writeClientError(w, h.log, "client.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, c)
}

// Delete — DELETE /api/v1/clients/{id}
func (h *ClientHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
		writeClientError(w, h.log, "client.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// Stats — GET /api/v1/clients/stats
func (h *ClientHandler) Stats(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	s, err := h.uc.Stats(r.Context(), au)
	if err != nil {
		writeClientError(w, h.log, "client.Stats", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.ClientStatsResponse{
		Total:       s.Total,
		ByType:      s.ByType,
		ByStatut:    s.ByStatut,
		RecentCount: s.RecentCount,
	})
}

// writeClientError mappe les erreurs domain → HTTP status.
func writeClientError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "client not found")
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
