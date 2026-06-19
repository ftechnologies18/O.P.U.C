// Package handler — support_handler.go
// Handlers HTTP pour /api/v1/support/* (Phase 5, peripheral endpoints).
//
// Routes (cf. router.go) :
//   GET    /api/v1/support                          — list paginée (auth requis)
//   POST   /api/v1/support                          — create ticket (auth requis)
//   GET    /api/v1/support/stats                    — stats (auth requis)
//   GET    /api/v1/support/{id}                     — détail avec messages
//   PUT    /api/v1/support/{id}                     — update ticket (GERANT, SUPER_ADMIN)
//   POST   /api/v1/support/{id}/statut              — change statut (GERANT, SUPER_ADMIN)
//   GET    /api/v1/support/{id}/messages            — list messages
//   POST   /api/v1/support/{id}/messages            — add message (auth requis)
//
// IMPORTANT : la route statique /support/stats doit être enregistrée AVANT
// /support/{id} sinon chi l'interprète comme un ID.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/support"
)

// SupportHandler — handlers HTTP pour /api/v1/support.
type SupportHandler struct {
	uc  *support.Usecase
	log *slog.Logger
}

// NewSupportHandler constructeur.
func NewSupportHandler(uc *support.Usecase, log *slog.Logger) *SupportHandler {
	return &SupportHandler{uc: uc, log: log}
}

// List — GET /api/v1/support
// Query params : ?statut=OUVERT&priorite=HAUTE&categorie=TECHNIQUE&clientId=xxx&assigneAId=xxx&search=titre&page=1&pageSize=50
func (h *SupportHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := support.ListInput{
		Statut:     r.URL.Query().Get("statut"),
		Priorite:   r.URL.Query().Get("priorite"),
		Categorie:  r.URL.Query().Get("categorie"),
		ClientID:   r.URL.Query().Get("clientId"),
		AssigneAID: r.URL.Query().Get("assigneAId"),
		Search:     r.URL.Query().Get("search"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writeSupportError(w, h.log, "support.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.TicketListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/support/{id}
func (h *SupportHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	t, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writeSupportError(w, h.log, "support.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, t)
}

// Create — POST /api/v1/support
func (h *SupportHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	t, err := h.uc.Create(r.Context(), au, support.CreateInput{
		Titre:       req.Titre,
		Description: req.Description,
		Priorite:    req.Priorite,
		Categorie:   req.Categorie,
		ClientID:    req.ClientID,
	})
	if err != nil {
		writeSupportError(w, h.log, "support.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, t)
}

// Update — PUT /api/v1/support/{id}
func (h *SupportHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	t, err := h.uc.Update(r.Context(), au, id, support.UpdateInput{
		Titre:       req.Titre,
		Description: req.Description,
		Priorite:    req.Priorite,
		Categorie:   req.Categorie,
		AssigneAID:  req.AssigneeAID,
	})
	if err != nil {
		writeSupportError(w, h.log, "support.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, t)
}

// ChangeStatut — POST /api/v1/support/{id}/statut
func (h *SupportHandler) ChangeStatut(w http.ResponseWriter, r *http.Request) {
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
	var req dto.ChangeTicketStatutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Statut == "" {
		WriteError(w, http.StatusBadRequest, "statut is required")
		return
	}
	t, err := h.uc.ChangeStatut(r.Context(), au, id, req.Statut)
	if err != nil {
		writeSupportError(w, h.log, "support.ChangeStatut", err)
		return
	}
	WriteJSON(w, http.StatusOK, t)
}

// ListMessages — GET /api/v1/support/{id}/messages
func (h *SupportHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.uc.ListMessages(r.Context(), au, id)
	if err != nil {
		writeSupportError(w, h.log, "support.ListMessages", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.TicketMessageListResponse{
		Data:  items,
		Total: int64(len(items)),
	})
}

// CreateMessage — POST /api/v1/support/{id}/messages
func (h *SupportHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
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
	var req dto.CreateTicketMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	m, err := h.uc.CreateMessage(r.Context(), au, support.CreateMessageInput{
		TicketID:    id,
		Contenu:     req.Contenu,
		PieceJointe: req.PieceJointe,
	})
	if err != nil {
		writeSupportError(w, h.log, "support.CreateMessage", err)
		return
	}
	WriteJSON(w, http.StatusCreated, m)
}

// Stats — GET /api/v1/support/stats
func (h *SupportHandler) Stats(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	s, err := h.uc.Stats(r.Context(), au)
	if err != nil {
		writeSupportError(w, h.log, "support.Stats", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SupportStatsResponse{
		Total:         s.Total,
		ByStatut:      s.ByStatut,
		ByPriorite:    s.ByPriorite,
		ByCategorie:   s.ByCategorie,
		OpenCount:     s.OpenCount,
		ResolvedCount: s.ResolvedCount,
	})
}

// writeSupportError mappe les erreurs domain → HTTP status.
func writeSupportError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "ticket not found")
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
