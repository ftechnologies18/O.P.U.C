// Package handler — paie_handler.go
// Handlers HTTP pour /api/v1/paie/* (Phase 3, write métier).
//
// Routes (cf. router.go) :
//   GET  /api/v1/paie/paiements-hebdo             — list paginée (auth requis)
//   POST /api/v1/paie/paiements-hebdo/generate    — génère depuis pointages validés (GERANT, SUPER_ADMIN)
//   PUT  /api/v1/paie/paiements-hebdo/{id}        — update (GERANT, SUPER_ADMIN)
//   GET  /api/v1/paie/salaires                    — list paginée (auth requis)
//   POST /api/v1/paie/salaires/generate           — génère salaire mensuel (GERANT, SUPER_ADMIN)
//   PUT  /api/v1/paie/salaires/{id}               — update (GERANT, SUPER_ADMIN)
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/paie"
)

// PaieHandler — handlers HTTP pour /api/v1/paie/*.
type PaieHandler struct {
        uc  *paie.Usecase
        log *slog.Logger
}

// NewPaieHandler constructeur.
func NewPaieHandler(uc *paie.Usecase, log *slog.Logger) *PaieHandler {
        return &PaieHandler{uc: uc, log: log}
}

// ── PaiementHebdo ──────────────────────────────────────────────

// ListPaiementHebdo — GET /api/v1/paie/paiements-hebdo
func (h *PaieHandler) ListPaiementHebdo(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := paie.PaiementHebdoListInput{
                ChantierID:   r.URL.Query().Get("chantierId"),
                JournalierID: r.URL.Query().Get("journalierId"),
                Statut:       r.URL.Query().Get("statut"),
                Page:         atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        items, total, err := h.uc.ListPaiementHebdo(r.Context(), au, in)
        if err != nil {
                writePaieError(w, h.log, "paie.ListPaiementHebdo", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.PaiementHebdoListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// GeneratePaiementHebdo — POST /api/v1/paie/paiements-hebdo/generate
// Body : dto.GeneratePaiementHebdoRequest
func (h *PaieHandler) GeneratePaiementHebdo(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.GeneratePaiementHebdoRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        semaineDebut, err := parseDate(req.SemaineDebut)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid semaineDebut (use RFC3339 or YYYY-MM-DD)")
                return
        }
        out, err := h.uc.GeneratePaiementHebdo(r.Context(), au, paie.GeneratePaiementHebdoInput{
                ChantierID:   req.ChantierID,
                SemaineDebut: semaineDebut,
        })
        if err != nil {
                writePaieError(w, h.log, "paie.GeneratePaiementHebdo", err)
                return
        }
        WriteJSON(w, http.StatusCreated, dto.GeneratePaiementHebdoResponse{
                ChantierID:   out.ChantierID,
                SemaineDebut: out.SemaineDebut.Format("2006-01-02"),
                SemaineFin:   out.SemaineFin.Format("2006-01-02"),
                Generated:    out.Generated,
                Count:        len(out.Generated),
        })
}

// UpdatePaiementHebdo — PUT /api/v1/paie/paiements-hebdo/{id}
// Body : dto.UpdatePaiementHebdoRequest
func (h *PaieHandler) UpdatePaiementHebdo(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdatePaiementHebdoRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        datePaiement, err := parseDatePtr(derefStr(req.DatePaiement))
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid datePaiement")
                return
        }
        p, err := h.uc.UpdatePaiementHebdo(r.Context(), au, id, paie.UpdatePaiementHebdoInput{
                MontantVerse: req.MontantVerse,
                ModePaiement: req.ModePaiement,
                Statut:       req.Statut,
                DatePaiement: datePaiement,
        })
        if err != nil {
                writePaieError(w, h.log, "paie.UpdatePaiementHebdo", err)
                return
        }
        WriteJSON(w, http.StatusOK, p)
}

// ── SalaireMensuel ─────────────────────────────────────────────

// ListSalaireMensuel — GET /api/v1/paie/salaires
func (h *PaieHandler) ListSalaireMensuel(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := paie.SalaireMensuelListInput{
                JournalierID: r.URL.Query().Get("journalierId"),
                Statut:       r.URL.Query().Get("statut"),
                Page:         atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        if v := r.URL.Query().Get("mois"); v != "" {
                in.Mois = atoiDefault(v, 0)
        }
        if v := r.URL.Query().Get("annee"); v != "" {
                in.Annee = atoiDefault(v, 0)
        }
        items, total, err := h.uc.ListSalaireMensuel(r.Context(), au, in)
        if err != nil {
                writePaieError(w, h.log, "paie.ListSalaireMensuel", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.SalaireMensuelListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// GenerateSalaireMensuel — POST /api/v1/paie/salaires/generate
// Body : dto.GenerateSalaireMensuelRequest
func (h *PaieHandler) GenerateSalaireMensuel(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.GenerateSalaireMensuelRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        s, err := h.uc.GenerateSalaireMensuel(r.Context(), au, paie.GenerateSalaireMensuelInput{
                JournalierID:  req.JournalierID,
                Mois:          req.Mois,
                Annee:         req.Annee,
                SalaireBase:   req.SalaireBase,
                Primes:        req.Primes,
                HeuresSupp:    req.HeuresSupp,
                RetenuesCNPS:  req.RetenuesCNPS,
                RetenuesIR:    req.RetenuesIR,
                Avances:       req.Avances,
                Absences:      req.Absences,
        })
        if err != nil {
                writePaieError(w, h.log, "paie.GenerateSalaireMensuel", err)
                return
        }
        WriteJSON(w, http.StatusCreated, s)
}

// UpdateSalaireMensuel — PUT /api/v1/paie/salaires/{id}
// Body : dto.UpdateSalaireMensuelRequest
func (h *PaieHandler) UpdateSalaireMensuel(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateSalaireMensuelRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        datePaiement, err := parseDatePtr(derefStr(req.DatePaiement))
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid datePaiement")
                return
        }
        s, err := h.uc.UpdateSalaireMensuel(r.Context(), au, id, paie.UpdateSalaireMensuelInput{
                Statut:       req.Statut,
                DatePaiement: datePaiement,
                ModePaiement: req.ModePaiement,
        })
        if err != nil {
                writePaieError(w, h.log, "paie.UpdateSalaireMensuel", err)
                return
        }
        WriteJSON(w, http.StatusOK, s)
}

// writePaieError mappe les erreurs domain → HTTP status.
func writePaieError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "paie resource not found")
        case errors.Is(err, domain.ErrConflict):
                WriteError(w, http.StatusConflict, "paie resource already exists")
        case errors.Is(err, domain.ErrUnauthorized):
                WriteError(w, http.StatusUnauthorized, "unauthorized")
        case errors.Is(err, domain.ErrBadRequest):
                WriteError(w, http.StatusBadRequest, err.Error())
        default:
                log.Error(op, "err", err)
                WriteError(w, http.StatusInternalServerError, "internal error")
        }
}
