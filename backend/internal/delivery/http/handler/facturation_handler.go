// Package handler — facturation_handler.go
// Handlers HTTP pour /api/v1/facturation/* (Phase 4, commercial).
//
// Routes (cf. router.go) :
//   GET    /api/v1/facturation                       — list (auth requis)
//   POST   /api/v1/facturation                       — create (GERANT, SUPER_ADMIN)
//   GET    /api/v1/facturation/stats                 — stats (auth requis)
//   GET    /api/v1/facturation/{id}                  — détail avec Client + Contrat + Paiements (auth requis)
//   PUT    /api/v1/facturation/{id}                  — update (GERANT, SUPER_ADMIN)
//   DELETE /api/v1/facturation/{id}                  — delete (409 si paiements) (GERANT, SUPER_ADMIN)
//   POST   /api/v1/facturation/{id}/statut           — change statut (GERANT, SUPER_ADMIN)
//   GET    /api/v1/facturation/{id}/paiements        — list paiements (auth requis)
//   POST   /api/v1/facturation/{id}/paiements        — add paiement (GERANT, SUPER_ADMIN)
//
// IMPORTANT : la route statique /facturation/stats doit être enregistrée AVANT
// /facturation/{id} sinon chi l'interprète comme un ID.
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/facturation"
)

// FacturationHandler — handlers HTTP pour /api/v1/facturation.
type FacturationHandler struct {
        uc  *facturation.Usecase
        log *slog.Logger
}

// NewFacturationHandler constructeur.
func NewFacturationHandler(uc *facturation.Usecase, log *slog.Logger) *FacturationHandler {
        return &FacturationHandler{uc: uc, log: log}
}

// List — GET /api/v1/facturation
// Query params : ?clientId=xxx&contratId=xxx&statut=xxx&typeFacture=xxx&search=xxx&page=1&pageSize=50
func (h *FacturationHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := facturation.ListInput{
                ClientID:    r.URL.Query().Get("clientId"),
                ContratID:   r.URL.Query().Get("contratId"),
                Statut:      r.URL.Query().Get("statut"),
                TypeFacture: r.URL.Query().Get("typeFacture"),
                Search:      r.URL.Query().Get("search"),
                Page:        atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize:    atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        items, total, err := h.uc.List(r.Context(), au, in)
        if err != nil {
                writeFacturationError(w, h.log, "facturation.List", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.FactureListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// Get — GET /api/v1/facturation/{id}
func (h *FacturationHandler) Get(w http.ResponseWriter, r *http.Request) {
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
        f, err := h.uc.Get(r.Context(), au, id)
        if err != nil {
                writeFacturationError(w, h.log, "facturation.Get", err)
                return
        }
        WriteJSON(w, http.StatusOK, f)
}

// Create — POST /api/v1/facturation
func (h *FacturationHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateFactureRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        f, err := h.uc.Create(r.Context(), au, facturation.CreateInput{
                ClientID:     req.ClientID,
                ContratID:    req.ContratID,
                DevisID:      req.DevisID,
                TypeFacture:  req.TypeFacture,
                MontantHT:    req.MontantHT,
                TauxTVA:      req.TauxTVA,
                DateEcheance: parseDatePtr2(req.DateEcheance),
                Notes:        req.Notes,
        })
        if err != nil {
                writeFacturationError(w, h.log, "facturation.Create", err)
                return
        }
        WriteJSON(w, http.StatusCreated, f)
}

// Update — PUT /api/v1/facturation/{id}
func (h *FacturationHandler) Update(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateFactureRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        f, err := h.uc.Update(r.Context(), au, id, facturation.UpdateInput{
                DateEcheance: parseDatePtr2(req.DateEcheance),
                Notes:        req.Notes,
                ModePaiement: req.ModePaiement,
        })
        if err != nil {
                writeFacturationError(w, h.log, "facturation.Update", err)
                return
        }
        WriteJSON(w, http.StatusOK, f)
}

// Delete — DELETE /api/v1/facturation/{id}
func (h *FacturationHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
                writeFacturationError(w, h.log, "facturation.Delete", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ChangeStatut — POST /api/v1/facturation/{id}/statut
func (h *FacturationHandler) ChangeStatut(w http.ResponseWriter, r *http.Request) {
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
        f, err := h.uc.ChangeStatut(r.Context(), au, id, req.Statut)
        if err != nil {
                writeFacturationError(w, h.log, "facturation.ChangeStatut", err)
                return
        }
        WriteJSON(w, http.StatusOK, f)
}

// ListPaiements — GET /api/v1/facturation/{id}/paiements
func (h *FacturationHandler) ListPaiements(w http.ResponseWriter, r *http.Request) {
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
        items, err := h.uc.ListPaiements(r.Context(), au, id)
        if err != nil {
                writeFacturationError(w, h.log, "facturation.ListPaiements", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.PaiementListResponse{Data: items})
}

// CreatePaiement — POST /api/v1/facturation/{id}/paiements
func (h *FacturationHandler) CreatePaiement(w http.ResponseWriter, r *http.Request) {
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
        var req dto.CreatePaiementRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        datePaiement, err := parseDate(req.DatePaiement)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid datePaiement (use RFC3339 or YYYY-MM-DD)")
                return
        }
        f, err := h.uc.CreatePaiement(r.Context(), au, id, facturation.PaiementInput{
                Montant:      req.Montant,
                DatePaiement: datePaiement,
                ModePaiement: req.ModePaiement,
                Reference:    req.Reference,
                Notes:        req.Notes,
        })
        if err != nil {
                writeFacturationError(w, h.log, "facturation.CreatePaiement", err)
                return
        }
        WriteJSON(w, http.StatusCreated, f)
}

// Stats — GET /api/v1/facturation/stats
func (h *FacturationHandler) Stats(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        s, err := h.uc.Stats(r.Context(), au)
        if err != nil {
                writeFacturationError(w, h.log, "facturation.Stats", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.FacturationStatsResponse{
                Total:         s.Total,
                ByStatut:      s.ByStatut,
                TotalTTC:      s.TotalTTC,
                TotalPaye:     s.TotalPaye,
                TotalImpaye:   s.TotalImpaye,
                EnRetardCount: s.EnRetardCount,
        })
}

// writeFacturationError mappe les erreurs domain → HTTP status.
func writeFacturationError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "facture not found")
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
