// Package handler — chantier_handler.go
// Handlers HTTP pour /api/v1/chantiers (Phase 2 + Phase 0.2 CRUD write).
//
// Routes (cf. router.go) :
//   GET    /api/v1/chantiers         — list paginée + KPI (auth requis)
//   POST   /api/v1/chantiers         — create (GERANT+)
//   GET    /api/v1/chantiers/{id}    — détail avec phases + taches (auth requis)
//   PUT    /api/v1/chantiers/{id}    — update (CHEF_PROJET+)
//   DELETE /api/v1/chantiers/{id}    — delete (GERANT+, ?force=true pour cascade)
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par
// middleware.Auth) pour le RLS.
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/chantier"
)

// ChantierHandler — handlers HTTP pour /api/v1/chantiers.
type ChantierHandler struct {
        uc  *chantier.Usecase
        log *slog.Logger
}

// NewChantierHandler constructeur.
func NewChantierHandler(uc *chantier.Usecase, log *slog.Logger) *ChantierHandler {
        return &ChantierHandler{uc: uc, log: log}
}

// List — GET /api/v1/chantiers
// Query params (tous optionnels) :
//   ?statut=EN_COURS     — filtre par statut
//   ?search=xxx          — ILIKE sur nom, adresse, maitreOuvrage
//   ?page=1              — 1-based (défaut 1)
//   ?pageSize=50         — défaut 50
//
// RLS : SUPER_ADMIN voit toutes les entreprises, autres rôles ne voient que la leur.
func (h *ChantierHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        out, err := h.uc.List(r.Context(), au, chantier.ListInput{
                Statut:   r.URL.Query().Get("statut"),
                Search:   r.URL.Query().Get("search"),
                Page:     atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
        })
        if err != nil {
                writeChantierError(w, h.log, "chantier.List", err)
                return
        }

        // Conversion usecase.ChantierWithMeta → dto.ChantierWithMeta
        // (flat PhaseCount/JournalierCount → nested _count {phases, journaliers})
        chantiers := make([]dto.ChantierWithMeta, 0, len(out.Chantiers))
        for i := range out.Chantiers {
                c := &out.Chantiers[i]
                chantiers = append(chantiers, dto.ChantierWithMeta{
                        Chantier:         c.Chantier,
                        AvancementGlobal: c.AvancementGlobal,
                        Count: dto.CountMeta{
                                Phases:      c.PhaseCount,
                                Journaliers: c.JournalierCount,
                        },
                })
        }

        WriteJSON(w, http.StatusOK, dto.ChantierListResponse{
                Chantiers: chantiers,
                KPI: dto.KPIResponse{
                        Total:         out.KPI.Total,
                        Actifs:        out.KPI.Actifs,
                        EnPreparation: out.KPI.EnPreparation,
                        Termines:      out.KPI.Termines,
                },
        })
}

// Get — GET /api/v1/chantiers/{id}
// Retourne le chantier avec phases + taches préloadées + avancementGlobal + _count.
// RLS-filtered : un GERANT ne peut pas GET un chantier d'une autre entreprise.
func (h *ChantierHandler) Get(w http.ResponseWriter, r *http.Request) {
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
                writeChantierError(w, h.log, "chantier.Get", err)
                return
        }

        WriteJSON(w, http.StatusOK, dto.ChantierWithMeta{
                Chantier:         c.Chantier,
                AvancementGlobal: c.AvancementGlobal,
                Count: dto.CountMeta{
                        Phases:      c.PhaseCount,
                        Journaliers: c.JournalierCount,
                },
        })
}

// writeChantierError mappe les erreurs domain → HTTP status pour les handlers chantier.
func writeChantierError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "chantier not found")
        case errors.Is(err, domain.ErrUnauthorized):
                WriteError(w, http.StatusUnauthorized, "unauthorized")
        case errors.Is(err, domain.ErrBadRequest):
                WriteError(w, http.StatusBadRequest, err.Error())
        case errors.Is(err, domain.ErrConflict):
                WriteError(w, http.StatusConflict, err.Error())
        default:
                log.Error(op, "err", err)
                // TEMPORAIRE (debug Phase 1) : retourne l'erreur réelle pour diagnostic.
                // TODO: revenir à "internal error" une fois le bug résolu.
                WriteError(w, http.StatusInternalServerError, "internal error: "+err.Error())
        }
}

// ══════════════════════════════════════════════════════════════════
// Phase 0.2 — CRUD write handlers (Create, Update, Delete)
// ══════════════════════════════════════════════════════════════════

// Create — POST /api/v1/chantiers
// Body JSON : { nom, adresse?, maitreOuvrage?, dateDebut?, dateFinPrevue?,
//               budgetPrevisionnel?, statut?, description?, modeCarburant?, clientId? }
//
// RBAC : GERANT+ (réservé à la direction de l'entreprise).
//
// Note : les dates sont envoyées comme strings ("2025-01-30" ou RFC3339) par le
// frontend Next.js. On décode en map raw puis on convertit en *time.Time.
func (h *ChantierHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseChantierCreateInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        c, err := h.uc.Create(r.Context(), au, in)
        if err != nil {
                writeChantierError(w, h.log, "chantier.Create", err)
                return
        }

        WriteJSON(w, http.StatusCreated, dto.ChantierWithMeta{
                Chantier:         c.Chantier,
                AvancementGlobal: c.AvancementGlobal,
                Count: dto.CountMeta{
                        Phases:      c.PhaseCount,
                        Journaliers: c.JournalierCount,
                },
        })
}

// Update — PUT /api/v1/chantiers/{id}
// Body JSON : partial updates (tous les champs optionnels).
//
// RBAC : CHEF_PROJET+ (édition opérationnelle).
func (h *ChantierHandler) Update(w http.ResponseWriter, r *http.Request) {
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

        // On décode dans un map raw pour gérer la conversion flexible des dates
        // (le frontend envoie les dates comme strings YYYY-MM-DD).
        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseChantierUpdateInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        c, err := h.uc.Update(r.Context(), au, id, in)
        if err != nil {
                writeChantierError(w, h.log, "chantier.Update", err)
                return
        }

        WriteJSON(w, http.StatusOK, dto.ChantierWithMeta{
                Chantier:         c.Chantier,
                AvancementGlobal: c.AvancementGlobal,
                Count: dto.CountMeta{
                        Phases:      c.PhaseCount,
                        Journaliers: c.JournalierCount,
                },
        })
}

// Delete — DELETE /api/v1/chantiers/{id}?force=true
//
// Par défaut (force=false) : bloque si le chantier a des dépendances.
// Avec force=true : cascade delete toutes les dépendances.
//
// RBAC : GERANT+ (irréversible, décision de direction).
func (h *ChantierHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

        force := r.URL.Query().Get("force") == "true"

        if err := h.uc.Delete(r.Context(), au, id, force); err != nil {
                writeChantierError(w, h.log, "chantier.Delete", err)
                return
        }

        WriteJSON(w, http.StatusOK, map[string]any{
                "success": true,
                "id":      id,
                "force":   force,
        })
}

// parseChantierUpdateInput convertit un map raw (JSON décodé sans typage)
// en chantier.UpdateInput. Gère la conversion des dates string → *time.Time.
//
// Le frontend envoie les dates comme strings ("2025-01-30" ou "2025-01-30T00:00:00Z").
// On les convertit en *time.Time pour le usecase.
func parseChantierUpdateInput(raw map[string]any) (chantier.UpdateInput, error) {
        var in chantier.UpdateInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = &v
        }
        if v, ok := raw["adresse"].(string); ok {
                in.Adresse = &v
        }
        if v, ok := raw["maitreOuvrage"].(string); ok {
                in.MaitreOuvrage = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFinPrevue"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFinPrevue = &t
        }
        if v, ok := raw["budgetPrevisionnel"]; ok {
                // toFloat64 (défini dans saas_handler.go) retourne 0 si conversion impossible
                f := toFloat64(v)
                in.BudgetPrevisionnel = &f
        }
        if v, ok := raw["statut"].(string); ok {
                in.Statut = &v
        }
        if v, ok := raw["description"].(string); ok {
                in.Description = &v
        }
        if v, ok := raw["modeCarburant"].(string); ok {
                in.ModeCarburant = &v
        }
        if v, ok := raw["clientId"].(string); ok {
                in.ClientID = &v
        }

        return in, nil
}

// parseChantierCreateInput convertit un map raw (JSON décodé sans typage)
// en chantier.CreateInput. Gère la conversion des dates string → *time.Time.
func parseChantierCreateInput(raw map[string]any) (chantier.CreateInput, error) {
        var in chantier.CreateInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = v
        }
        if v, ok := raw["adresse"].(string); ok && v != "" {
                in.Adresse = &v
        }
        if v, ok := raw["maitreOuvrage"].(string); ok && v != "" {
                in.MaitreOuvrage = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFinPrevue"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFinPrevue = &t
        }
        if v, ok := raw["budgetPrevisionnel"]; ok {
                // toFloat64 (défini dans saas_handler.go) retourne 0 si conversion impossible
                in.BudgetPrevisionnel = toFloat64(v)
        }
        if v, ok := raw["statut"].(string); ok {
                in.Statut = v
        }
        if v, ok := raw["description"].(string); ok && v != "" {
                in.Description = &v
        }
        if v, ok := raw["modeCarburant"].(string); ok {
                in.ModeCarburant = v
        }
        if v, ok := raw["clientId"].(string); ok && v != "" {
                in.ClientID = &v
        }

        return in, nil
}
