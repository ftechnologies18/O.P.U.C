// Package handler — devis_handler.go
// Handlers HTTP pour /api/v1/devis/* (Phase 4, commercial).
//
// Routes (cf. router.go) :
//   GET    /api/v1/devis                            — list (auth requis)
//   POST   /api/v1/devis                            — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/devis/{id}                       — détail avec Client + Lignes (auth requis)
//   PUT    /api/v1/devis/{id}                       — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/devis/{id}                       — delete + cascade lignes (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   POST   /api/v1/devis/{id}/statut                — change statut (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   POST   /api/v1/devis/{id}/lignes                — add ligne (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   PUT    /api/v1/devis/{id}/lignes/{ligneId}      — update ligne (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/devis/{id}/lignes/{ligneId}      — delete ligne (CHEF_PROJET, GERANT, SUPER_ADMIN)
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
        "opuc/internal/usecase/devis"
)

// DevisHandler — handlers HTTP pour /api/v1/devis.
type DevisHandler struct {
        uc  *devis.Usecase
        log *slog.Logger
}

// NewDevisHandler constructeur.
func NewDevisHandler(uc *devis.Usecase, log *slog.Logger) *DevisHandler {
        return &DevisHandler{uc: uc, log: log}
}

// List — GET /api/v1/devis
// Query params : ?clientId=xxx&statut=xxx&search=xxx&page=1&pageSize=50
func (h *DevisHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := devis.ListInput{
                ClientID: r.URL.Query().Get("clientId"),
                Statut:   r.URL.Query().Get("statut"),
                Search:   r.URL.Query().Get("search"),
                Page:     atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        items, total, err := h.uc.List(r.Context(), au, in)
        if err != nil {
                writeDevisError(w, h.log, "devis.List", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.DevisListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// Get — GET /api/v1/devis/{id}
func (h *DevisHandler) Get(w http.ResponseWriter, r *http.Request) {
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
                writeDevisError(w, h.log, "devis.Get", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// Create — POST /api/v1/devis
func (h *DevisHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateDevisRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        // Parse dateValidite optionnelle.
        var dateValidite *string
        if req.DateValidite != nil {
                s := *req.DateValidite
                dateValidite = &s
        }
        // Convert DTO lignes to usecase input.
        lignes := make([]devis.LigneInput, 0, len(req.Lignes))
        for _, li := range req.Lignes {
                lignes = append(lignes, devis.LigneInput{
                        Designation:  li.Designation,
                        Description:  li.Description,
                        Quantite:     li.Quantite,
                        Unite:        li.Unite,
                        PrixUnitaire: li.PrixUnitaire,
                        Ordre:        li.Ordre,
                })
        }

        in := devis.CreateInput{
                ClientID:      req.ClientID,
                DateValidite:  parseDateValidite(dateValidite),
                Conditions:    req.Conditions,
                RemiseGlobale: req.RemiseGlobale,
                TauxTVA:       req.TauxTVA,
                Notes:         req.Notes,
                Lignes:        lignes,
        }
        d, err := h.uc.Create(r.Context(), au, in)
        if err != nil {
                writeDevisError(w, h.log, "devis.Create", err)
                return
        }
        WriteJSON(w, http.StatusCreated, d)
}

// parseDateValidite — convertit un *string ISO date en *time.Time (nil si vide).
func parseDateValidite(s *string) *time.Time {
        if s == nil || *s == "" {
                return nil
        }
        t, err := parseDate(*s)
        if err != nil {
                return nil
        }
        return &t
}

// Update — PUT /api/v1/devis/{id}
func (h *DevisHandler) Update(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateDevisRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        d, err := h.uc.Update(r.Context(), au, id, devis.UpdateInput{
                DateValidite:  parseDateValidite(req.DateValidite),
                Conditions:    req.Conditions,
                RemiseGlobale: req.RemiseGlobale,
                TauxTVA:       req.TauxTVA,
                Notes:         req.Notes,
                Statut:        req.Statut,
        })
        if err != nil {
                writeDevisError(w, h.log, "devis.Update", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// Delete — DELETE /api/v1/devis/{id}
func (h *DevisHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
                writeDevisError(w, h.log, "devis.Delete", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ChangeStatut — POST /api/v1/devis/{id}/statut
func (h *DevisHandler) ChangeStatut(w http.ResponseWriter, r *http.Request) {
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
        d, err := h.uc.ChangeStatut(r.Context(), au, id, req.Statut)
        if err != nil {
                writeDevisError(w, h.log, "devis.ChangeStatut", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// AddLigne — POST /api/v1/devis/{id}/lignes
func (h *DevisHandler) AddLigne(w http.ResponseWriter, r *http.Request) {
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
        var req dto.CreateLigneDevisRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        d, err := h.uc.AddLigne(r.Context(), au, id, devis.LigneInput{
                Designation:  req.Designation,
                Description:  req.Description,
                Quantite:     req.Quantite,
                Unite:        req.Unite,
                PrixUnitaire: req.PrixUnitaire,
                Ordre:        req.Ordre,
        })
        if err != nil {
                writeDevisError(w, h.log, "devis.AddLigne", err)
                return
        }
        WriteJSON(w, http.StatusCreated, d)
}

// UpdateLigne — PUT /api/v1/devis/{id}/lignes/{ligneId}
func (h *DevisHandler) UpdateLigne(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        id := chi.URLParam(r, "id")
        ligneID := chi.URLParam(r, "ligneId")
        if id == "" || ligneID == "" {
                WriteError(w, http.StatusBadRequest, "missing id or ligneId")
                return
        }
        var req dto.UpdateLigneDevisRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        // Si aucun champ n'est fourni, on retourne une erreur.
        if req.Designation == nil && req.Description == nil && req.Quantite == nil &&
                req.Unite == nil && req.PrixUnitaire == nil && req.Ordre == nil {
                WriteError(w, http.StatusBadRequest, "no fields to update")
                return
        }
        d, err := h.uc.UpdateLigne(r.Context(), au, id, ligneID, devis.UpdateLigneInput{
                Designation:  req.Designation,
                Description:  req.Description,
                Quantite:     req.Quantite,
                Unite:        req.Unite,
                PrixUnitaire: req.PrixUnitaire,
                Ordre:        req.Ordre,
        })
        if err != nil {
                writeDevisError(w, h.log, "devis.UpdateLigne", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// DeleteLigne — DELETE /api/v1/devis/{id}/lignes/{ligneId}
func (h *DevisHandler) DeleteLigne(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        id := chi.URLParam(r, "id")
        ligneID := chi.URLParam(r, "ligneId")
        if id == "" || ligneID == "" {
                WriteError(w, http.StatusBadRequest, "missing id or ligneId")
                return
        }
        d, err := h.uc.DeleteLigne(r.Context(), au, id, ligneID)
        if err != nil {
                writeDevisError(w, h.log, "devis.DeleteLigne", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// writeDevisError mappe les erreurs domain → HTTP status.
func writeDevisError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "devis not found")
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
