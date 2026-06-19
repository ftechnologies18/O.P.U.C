// Package handler — contrat_handler.go
// Handlers HTTP pour /api/v1/contrats/* (Phase 4, commercial).
//
// Routes (cf. router.go) :
//   GET    /api/v1/contrats            — list (auth requis)
//   POST   /api/v1/contrats            — create (GERANT, SUPER_ADMIN)
//   GET    /api/v1/contrats/{id}       — détail avec Client + Factures (auth requis)
//   PUT    /api/v1/contrats/{id}       — update (GERANT, SUPER_ADMIN)
//   DELETE /api/v1/contrats/{id}       — delete (409 si factures liés) (GERANT, SUPER_ADMIN)
//   POST   /api/v1/contrats/{id}/statut — change statut (GERANT, SUPER_ADMIN)
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"
        "time"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/contrat"
)

// ContratHandler — handlers HTTP pour /api/v1/contrats.
type ContratHandler struct {
        uc  *contrat.Usecase
        log *slog.Logger
}

// NewContratHandler constructeur.
func NewContratHandler(uc *contrat.Usecase, log *slog.Logger) *ContratHandler {
        return &ContratHandler{uc: uc, log: log}
}

// List — GET /api/v1/contrats
// Query params : ?clientId=xxx&statut=xxx&typeContrat=xxx&search=xxx&page=1&pageSize=50
func (h *ContratHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := contrat.ListInput{
                ClientID:    r.URL.Query().Get("clientId"),
                Statut:      r.URL.Query().Get("statut"),
                TypeContrat: r.URL.Query().Get("typeContrat"),
                Search:      r.URL.Query().Get("search"),
                Page:        atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize:    atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        items, total, err := h.uc.List(r.Context(), au, in)
        if err != nil {
                writeContratError(w, h.log, "contrat.List", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.ContratListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// Get — GET /api/v1/contrats/{id}
func (h *ContratHandler) Get(w http.ResponseWriter, r *http.Request) {
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
                writeContratError(w, h.log, "contrat.Get", err)
                return
        }
        WriteJSON(w, http.StatusOK, c)
}

// Create — POST /api/v1/contrats
func (h *ContratHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateContratRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        c, err := h.uc.Create(r.Context(), au, contrat.CreateInput{
                ClientID:      req.ClientID,
                Objet:         req.Objet,
                TypeContrat:   req.TypeContrat,
                MontantHT:     req.MontantHT,
                TauxTVA:       req.TauxTVA,
                DateDebut:     parseDatePtr2(req.DateDebut),
                DateFin:       parseDatePtr2(req.DateFin),
                Conditions:    req.Conditions,
                PenaltyRetard: req.PenaltyRetard,
        })
        if err != nil {
                writeContratError(w, h.log, "contrat.Create", err)
                return
        }
        WriteJSON(w, http.StatusCreated, c)
}

// Update — PUT /api/v1/contrats/{id}
func (h *ContratHandler) Update(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateContratRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        c, err := h.uc.Update(r.Context(), au, id, contrat.UpdateInput{
                Objet:         req.Objet,
                TypeContrat:   req.TypeContrat,
                MontantHT:     req.MontantHT,
                TauxTVA:       req.TauxTVA,
                DateDebut:     parseDatePtr2(req.DateDebut),
                DateFin:       parseDatePtr2(req.DateFin),
                Conditions:    req.Conditions,
                PenaltyRetard: req.PenaltyRetard,
        })
        if err != nil {
                writeContratError(w, h.log, "contrat.Update", err)
                return
        }
        WriteJSON(w, http.StatusOK, c)
}

// Delete — DELETE /api/v1/contrats/{id}
func (h *ContratHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
                writeContratError(w, h.log, "contrat.Delete", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ChangeStatut — POST /api/v1/contrats/{id}/statut
func (h *ContratHandler) ChangeStatut(w http.ResponseWriter, r *http.Request) {
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
        var req dto.ChangeStatutRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        c, err := h.uc.ChangeStatut(r.Context(), au, id, req.Statut)
        if err != nil {
                writeContratError(w, h.log, "contrat.ChangeStatut", err)
                return
        }
        WriteJSON(w, http.StatusOK, c)
}

// parseDatePtr2 — convertit un *string ISO date en *time.Time (nil si nil ou vide).
// Helper local pour les handlers Contrat (le parseDatePtr existant prend un string).
func parseDatePtr2(s *string) *time.Time {
        if s == nil || *s == "" {
                return nil
        }
        t, err := parseDate(*s)
        if err != nil {
                return nil
        }
        return &t
}

// writeContratError mappe les erreurs domain → HTTP status.
func writeContratError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "contrat not found")
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
