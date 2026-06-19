// Package handler — document_handler.go
// Handlers HTTP pour /api/v1/documents/*, /api/v1/photos/*, /api/v1/rapports/*
// (Phase 5, peripheral endpoints).
//
// Routes (cf. router.go) :
//   Documents :
//     GET    /api/v1/documents           — list paginée (auth requis)
//     POST   /api/v1/documents           — create (auth requis)
//     GET    /api/v1/documents/{id}      — détail
//     PUT    /api/v1/documents/{id}      — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//     DELETE /api/v1/documents/{id}      — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   Photos :
//     GET    /api/v1/photos              — list paginée
//     POST   /api/v1/photos              — create (auth requis)
//     DELETE /api/v1/photos/{id}         — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   Rapports :
//     GET    /api/v1/rapports            — list paginée
//     POST   /api/v1/rapports            — create (auth requis)
//     GET    /api/v1/rapports/{id}       — détail avec photos
//     PUT    /api/v1/rapports/{id}       — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/document"
)

// DocumentHandler — handlers HTTP pour /api/v1/documents|photos|rapports.
type DocumentHandler struct {
	uc  *document.Usecase
	log *slog.Logger
}

// NewDocumentHandler constructeur.
func NewDocumentHandler(uc *document.Usecase, log *slog.Logger) *DocumentHandler {
	return &DocumentHandler{uc: uc, log: log}
}

// ── Documents ──────────────────────────────────────────────────

// List — GET /api/v1/documents
// Query params : ?chantierId=xxx&type=plan&statut=valid&search=xxx&page=1&pageSize=50
func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := document.ListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		Type:       r.URL.Query().Get("type"),
		Statut:     r.URL.Query().Get("statut"),
		Search:     r.URL.Query().Get("search"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writeDocumentError(w, h.log, "document.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.DocumentListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/documents/{id}
func (h *DocumentHandler) Get(w http.ResponseWriter, r *http.Request) {
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
		writeDocumentError(w, h.log, "document.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, d)
}

// Create — POST /api/v1/documents
func (h *DocumentHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	in := document.CreateDocumentInput{
		Titre:         req.Titre,
		Type:          req.Type,
		Categorie:     req.Categorie,
		NumeroRef:     req.NumeroRef,
		FichierNom:    req.FichierNom,
		FichierUrl:    req.FichierUrl,
		FichierTaille: req.FichierTaille,
		FichierType:   req.FichierType,
		Description:   req.Description,
		ChantierID:    req.ChantierID,
		PhaseID:       req.PhaseID,
	}
	if req.DateDocument != nil {
		t, err := parseDate(*req.DateDocument)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateDocument (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateDocument = &t
	}
	d, err := h.uc.Create(r.Context(), au, in)
	if err != nil {
		writeDocumentError(w, h.log, "document.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, d)
}

// Update — PUT /api/v1/documents/{id}
func (h *DocumentHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	d, err := h.uc.Update(r.Context(), au, id, document.UpdateDocumentInput{
		Titre:       req.Titre,
		Type:        req.Type,
		Description: req.Description,
		Statut:      req.Statut,
		Tags:        req.Tags,
	})
	if err != nil {
		writeDocumentError(w, h.log, "document.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, d)
}

// Delete — DELETE /api/v1/documents/{id}
func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
		writeDocumentError(w, h.log, "document.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ── Photos ─────────────────────────────────────────────────────

// ListPhotos — GET /api/v1/photos
// Query params : ?chantierId=xxx&categorie=avancement&page=1&pageSize=50
func (h *DocumentHandler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := document.PhotoListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		Categorie:  r.URL.Query().Get("categorie"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListPhotos(r.Context(), au, in)
	if err != nil {
		writeDocumentError(w, h.log, "photo.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.PhotoListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// CreatePhoto — POST /api/v1/photos
func (h *DocumentHandler) CreatePhoto(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreatePhotoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	datePrise, err := parseDate(req.DatePrise)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid datePrise (use RFC3339 or YYYY-MM-DD)")
		return
	}
	p, err := h.uc.CreatePhoto(r.Context(), au, document.CreatePhotoInput{
		ChantierID:   req.ChantierID,
		PhaseID:      req.PhaseID,
		TacheID:      req.TacheID,
		RapportID:    req.RapportID,
		DatePrise:    datePrise,
		Legende:      req.Legende,
		Categorie:    req.Categorie,
		UrlOriginale: req.UrlOriginale,
		UrlThumbnail: req.UrlThumbnail,
	})
	if err != nil {
		writeDocumentError(w, h.log, "photo.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, p)
}

// DeletePhoto — DELETE /api/v1/photos/{id}
func (h *DocumentHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
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
	if err := h.uc.DeletePhoto(r.Context(), au, id); err != nil {
		writeDocumentError(w, h.log, "photo.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ── Rapports ───────────────────────────────────────────────────

// ListRapports — GET /api/v1/rapports
// Query params : ?chantierId=xxx&date=2025-01-30&page=1&pageSize=50
func (h *DocumentHandler) ListRapports(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := document.RapportListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	if d := r.URL.Query().Get("date"); d != "" {
		t, err := parseDate(d)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid date format")
			return
		}
		in.Date = t
	}
	items, total, err := h.uc.ListRapports(r.Context(), au, in)
	if err != nil {
		writeDocumentError(w, h.log, "rapport.List", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.RapportListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// GetRapport — GET /api/v1/rapports/{id}
func (h *DocumentHandler) GetRapport(w http.ResponseWriter, r *http.Request) {
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
	rp, err := h.uc.GetRapport(r.Context(), au, id)
	if err != nil {
		writeDocumentError(w, h.log, "rapport.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, rp)
}

// CreateRapport — POST /api/v1/rapports
func (h *DocumentHandler) CreateRapport(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateRapportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	dateRapport, err := parseDate(req.DateRapport)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateRapport (use RFC3339 or YYYY-MM-DD)")
		return
	}
	rp, err := h.uc.CreateRapport(r.Context(), au, document.CreateRapportInput{
		ChantierID:      req.ChantierID,
		DateRapport:     dateRapport,
		Meteo:           req.Meteo,
		EffectifPresent: req.EffectifPresent,
		TravauxRealises: req.TravauxRealises,
		Incidents:       req.Incidents,
		Observations:    req.Observations,
	})
	if err != nil {
		writeDocumentError(w, h.log, "rapport.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, rp)
}

// UpdateRapport — PUT /api/v1/rapports/{id}
func (h *DocumentHandler) UpdateRapport(w http.ResponseWriter, r *http.Request) {
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
	var req dto.UpdateRapportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	rp, err := h.uc.UpdateRapport(r.Context(), au, id, document.UpdateRapportInput{
		Meteo:           req.Meteo,
		EffectifPresent: req.EffectifPresent,
		TravauxRealises: req.TravauxRealises,
		Incidents:       req.Incidents,
		Observations:    req.Observations,
	})
	if err != nil {
		writeDocumentError(w, h.log, "rapport.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, rp)
}

// writeDocumentError mappe les erreurs domain → HTTP status.
func writeDocumentError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "resource not found")
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
