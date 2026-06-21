// Package handler — carburant_handler.go
// Handlers HTTP pour /api/v1/carburant/* (Phase 3, write métier).
//
// Routes (cf. router.go) :
//   GET    /api/v1/carburant/stock           — list (auth requis)
//   POST   /api/v1/carburant/stock           — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/stock/{id}      — get (auth requis)
//   PUT    /api/v1/carburant/stock/{id}      — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/carburant/stock/{id}      — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/entrees         — list (auth requis)
//   POST   /api/v1/carburant/entrees         — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/sorties         — list (auth requis)
//   POST   /api/v1/carburant/sorties         — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/achats          — list (auth requis)
//   POST   /api/v1/carburant/achats          — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/releves         — list (auth requis)
//   POST   /api/v1/carburant/releves         — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/carburant/stats           — stats (auth requis)
//
// IMPORTANT : les routes statiques /carburant/stock, /carburant/entrees,
// /carburant/sorties, /carburant/achats, /carburant/releves, /carburant/stats
// doivent être enregistrées AVANT /carburant/stock/{id} sinon chi les interprète
// comme un ID.
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/carburant"
)

// CarburantHandler — handlers HTTP pour /api/v1/carburant/*.
type CarburantHandler struct {
        uc  *carburant.Usecase
        log *slog.Logger
}

// NewCarburantHandler constructeur.
func NewCarburantHandler(uc *carburant.Usecase, log *slog.Logger) *CarburantHandler {
        return &CarburantHandler{uc: uc, log: log}
}

// ── StockCarburant ─────────────────────────────────────────────

// ListStock — GET /api/v1/carburant/stock
func (h *CarburantHandler) ListStock(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        stocks, err := h.uc.ListStock(r.Context(), au,
                r.URL.Query().Get("chantierId"),
                r.URL.Query().Get("typeCarburant"),
        )
        if err != nil {
                writeCarburantError(w, h.log, "carburant.ListStock", err)
                return
        }
        out := make([]dto.StockCarburantWithQuantite, 0, len(stocks))
        for i := range stocks {
                out = append(out, dto.StockCarburantWithQuantite{
                        StockCarburant:     stocks[i].StockCarburant,
                        QuantiteDisponible: stocks[i].QuantiteDisponible,
                })
        }
        WriteJSON(w, http.StatusOK, dto.StockCarburantListResponse{Data: out})
}

// GetStock — GET /api/v1/carburant/stock/{id}
func (h *CarburantHandler) GetStock(w http.ResponseWriter, r *http.Request) {
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
        s, err := h.uc.GetStock(r.Context(), au, id)
        if err != nil {
                writeCarburantError(w, h.log, "carburant.GetStock", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.StockCarburantDetailResponse{
                StockCarburant:     s.StockCarburant,
                QuantiteDisponible: s.QuantiteDisponible,
        })
}

// CreateStock — POST /api/v1/carburant/stock
func (h *CarburantHandler) CreateStock(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateStockCarburantRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        s, err := h.uc.CreateStock(r.Context(), au, carburant.CreateStockInput{
                ChantierID:    req.ChantierID,
                TypeCarburant: req.TypeCarburant,
                Capacite:      req.Capacite,
                SeuilAlerte:   req.SeuilAlerte,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.CreateStock", err)
                return
        }
        WriteJSON(w, http.StatusCreated, s)
}

// UpdateStock — PUT /api/v1/carburant/stock/{id}
func (h *CarburantHandler) UpdateStock(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateStockCarburantRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        s, err := h.uc.UpdateStock(r.Context(), au, id, carburant.UpdateStockInput{
                Capacite:    req.Capacite,
                SeuilAlerte: req.SeuilAlerte,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.UpdateStock", err)
                return
        }
        WriteJSON(w, http.StatusOK, s)
}

// DeleteStock — DELETE /api/v1/carburant/stock/{id}
func (h *CarburantHandler) DeleteStock(w http.ResponseWriter, r *http.Request) {
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
        if err := h.uc.DeleteStock(r.Context(), au, id); err != nil {
                writeCarburantError(w, h.log, "carburant.DeleteStock", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ── EntreeCarburant ────────────────────────────────────────────

// ListEntrees — GET /api/v1/carburant/entrees
func (h *CarburantHandler) ListEntrees(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        items, err := h.uc.ListEntrees(r.Context(), au,
                r.URL.Query().Get("chantierId"),
                r.URL.Query().Get("stockCarburantId"),
        )
        if err != nil {
                writeCarburantError(w, h.log, "carburant.ListEntrees", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.EntreeCarburantListResponse{Data: items})
}

// CreateEntree — POST /api/v1/carburant/entrees
func (h *CarburantHandler) CreateEntree(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateEntreeCarburantRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        dateEntree, err := parseDate(req.DateEntree)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid dateEntree (use RFC3339 or YYYY-MM-DD)")
                return
        }
        e, err := h.uc.CreateEntree(r.Context(), au, carburant.CreateEntreeInput{
                StockCarburantID: req.StockCarburantID,
                ChantierID:       req.ChantierID,
                DateEntree:       dateEntree,
                Quantite:         req.Quantite,
                PrixUnitaire:     req.PrixUnitaire,
                Fournisseur:      req.Fournisseur,
                NumeroBL:         req.NumeroBL,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.CreateEntree", err)
                return
        }
        WriteJSON(w, http.StatusCreated, e)
}

// ── SortieCarburant ────────────────────────────────────────────

// ListSorties — GET /api/v1/carburant/sorties
func (h *CarburantHandler) ListSorties(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        items, err := h.uc.ListSorties(r.Context(), au,
                r.URL.Query().Get("chantierId"),
                r.URL.Query().Get("stockCarburantId"),
                r.URL.Query().Get("equipementId"),
        )
        if err != nil {
                writeCarburantError(w, h.log, "carburant.ListSorties", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.SortieCarburantListResponse{Data: items})
}

// CreateSortie — POST /api/v1/carburant/sorties
func (h *CarburantHandler) CreateSortie(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateSortieCarburantRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        dateSortie, err := parseDate(req.DateSortie)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid dateSortie (use RFC3339 or YYYY-MM-DD)")
                return
        }
        s, err := h.uc.CreateSortie(r.Context(), au, carburant.CreateSortieInput{
                StockCarburantID:    req.StockCarburantID,
                ChantierID:          req.ChantierID,
                EquipementID:        req.EquipementID,
                DateSortie:          dateSortie,
                Quantite:            req.Quantite,
                Operateur:           req.Operateur,
                CompteurHeuresAvant: req.CompteurHeuresAvant,
                CompteurHeuresApres: req.CompteurHeuresApres,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.CreateSortie", err)
                return
        }
        WriteJSON(w, http.StatusCreated, s)
}

// ── BonAchatCarburant ──────────────────────────────────────────

// ListAchats — GET /api/v1/carburant/achats
func (h *CarburantHandler) ListAchats(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        items, err := h.uc.ListAchats(r.Context(), au,
                r.URL.Query().Get("chantierId"),
                r.URL.Query().Get("equipementId"),
        )
        if err != nil {
                writeCarburantError(w, h.log, "carburant.ListAchats", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.BonAchatCarburantListResponse{Data: items})
}

// CreateAchat — POST /api/v1/carburant/achats
func (h *CarburantHandler) CreateAchat(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateBonAchatCarburantRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        dateAchat, err := parseDate(req.DateAchat)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid dateAchat (use RFC3339 or YYYY-MM-DD)")
                return
        }
        b, err := h.uc.CreateAchat(r.Context(), au, carburant.CreateAchatInput{
                ChantierID:          req.ChantierID,
                DateAchat:           dateAchat,
                TypeCarburant:       req.TypeCarburant,
                Quantite:            req.Quantite,
                PrixUnitaire:        req.PrixUnitaire,
                StationService:      req.StationService,
                NumeroRecu:          req.NumeroRecu,
                EquipementID:        req.EquipementID,
                Operateur:           req.Operateur,
                CompteurHeuresAvant: req.CompteurHeuresAvant,
                CompteurHeuresApres: req.CompteurHeuresApres,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.CreateAchat", err)
                return
        }
        WriteJSON(w, http.StatusCreated, b)
}

// ── ReleveCompteurEngin ────────────────────────────────────────

// ListReleves — GET /api/v1/carburant/releves
func (h *CarburantHandler) ListReleves(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        items, err := h.uc.ListReleves(r.Context(), au,
                r.URL.Query().Get("chantierId"),
                r.URL.Query().Get("equipementId"),
        )
        if err != nil {
                writeCarburantError(w, h.log, "carburant.ListReleves", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.ReleveCompteurEnginListResponse{Data: items})
}

// CreateReleve — POST /api/v1/carburant/releves
func (h *CarburantHandler) CreateReleve(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateReleveCompteurEnginRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        dateReleve, err := parseDate(req.DateReleve)
        if err != nil {
                WriteError(w, http.StatusBadRequest, "invalid dateReleve (use RFC3339 or YYYY-MM-DD)")
                return
        }
        rel, err := h.uc.CreateReleve(r.Context(), au, carburant.CreateReleveInput{
                EquipementID: req.EquipementID,
                ChantierID:   req.ChantierID,
                DateReleve:   dateReleve,
                HeuresKm:     req.HeuresKm,
                Observation:  req.Observation,
        })
        if err != nil {
                writeCarburantError(w, h.log, "carburant.CreateReleve", err)
                return
        }
        WriteJSON(w, http.StatusCreated, rel)
}

// ── Stats ──────────────────────────────────────────────────────

// Stats — GET /api/v1/carburant/stats
// Query params (optionnels) : ?year=2025&month=1 (défaut: mois courant UTC)
func (h *CarburantHandler) Stats(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        year := atoiDefault(r.URL.Query().Get("year"), 0)
        month := atoiDefault(r.URL.Query().Get("month"), 0)
        s, err := h.uc.Stats(r.Context(), au, year, month)
        if err != nil {
                writeCarburantError(w, h.log, "carburant.Stats", err)
                return
        }
        alerts := make([]dto.StockCarburantWithQuantite, 0, len(s.Alerts))
        for i := range s.Alerts {
                alerts = append(alerts, dto.StockCarburantWithQuantite{
                        StockCarburant:     s.Alerts[i].StockCarburant,
                        QuantiteDisponible: s.Alerts[i].QuantiteDisponible,
                })
        }
        WriteJSON(w, http.StatusOK, dto.CarburantStatsResponse{
                TotalStockByType:  s.TotalStockByType,
                TotalEntreesMonth: s.TotalEntreesMonth,
                TotalSortiesMonth: s.TotalSortiesMonth,
                TotalAchatsMonth:  s.TotalAchatsMonth,
                Alerts:            alerts,
                MonthLabel:        s.MonthLabel,
        })
}

// writeCarburantError mappe les erreurs domain → HTTP status.
func writeCarburantError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "carburant resource not found")
        case errors.Is(err, domain.ErrConflict):
                WriteError(w, http.StatusConflict, "carburant resource already exists")
        case errors.Is(err, domain.ErrUnauthorized):
                WriteError(w, http.StatusUnauthorized, "unauthorized")
        case errors.Is(err, domain.ErrBadRequest):
                WriteError(w, http.StatusBadRequest, err.Error())
        default:
                log.Error(op, "err", err)
                WriteError(w, http.StatusInternalServerError, "internal error")
        }
}

// ══════════════════════════════════════════════════════════════════
// Phase C — Delete handlers for entrees/sorties/achats/releves
// ══════════════════════════════════════════════════════════════════

// DeleteEntree — DELETE /api/v1/carburant/entrees/{id}
func (h *CarburantHandler) DeleteEntree(w http.ResponseWriter, r *http.Request) {
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
        if err := h.uc.DeleteEntree(r.Context(), au, id); err != nil {
                writeCarburantError(w, h.log, "carburant.DeleteEntree", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// DeleteSortie — DELETE /api/v1/carburant/sorties/{id}
func (h *CarburantHandler) DeleteSortie(w http.ResponseWriter, r *http.Request) {
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
        if err := h.uc.DeleteSortie(r.Context(), au, id); err != nil {
                writeCarburantError(w, h.log, "carburant.DeleteSortie", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// DeleteAchat — DELETE /api/v1/carburant/achats/{id}
func (h *CarburantHandler) DeleteAchat(w http.ResponseWriter, r *http.Request) {
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
        if err := h.uc.DeleteAchat(r.Context(), au, id); err != nil {
                writeCarburantError(w, h.log, "carburant.DeleteAchat", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// DeleteReleve — DELETE /api/v1/carburant/releves/{id}
func (h *CarburantHandler) DeleteReleve(w http.ResponseWriter, r *http.Request) {
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
        if err := h.uc.DeleteReleve(r.Context(), au, id); err != nil {
                writeCarburantError(w, h.log, "carburant.DeleteReleve", err)
                return
        }
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}
