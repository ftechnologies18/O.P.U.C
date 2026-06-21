// Package handler — phase_handler.go
// Handlers HTTP pour /api/v1/chantiers/{chantierId}/phases/* et
// /api/v1/taches/mes-taches (Phase 3, délégation de suivi).
//
// Routes (cf. router.go) :
//
//      POST   /api/v1/chantiers/{chantierId}/phases                              — create phase
//      PUT    /api/v1/chantiers/{chantierId}/phases/{phaseId}                    — update phase
//      DELETE /api/v1/chantiers/{chantierId}/phases/{phaseId}                    — delete phase (cascade taches)
//      POST   /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches             — create tache
//      PUT    /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}   — update tache
//      DELETE /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}   — delete tache
//      GET    /api/v1/taches/mes-taches                                          — mes tâches assignées
//
// RBAC :
//   - 6 routes CRUD Phase/Tache → RequireAccess(CHANTIER, ECRITURE, DelegationRepo)
//     (CHEF_PROJET a accès baseline, EMPLOYE nécessite une délégation active)
//   - GET /taches/mes-taches → auth requis seulement (route personnelle :
//     un EMPLOYE peut consulter ses propres tâches assignées)
//
// Le chantierId dans l'URL est utilisé uniquement pour CreatePhase (FK
// chantierId sur la phase). Pour Update/Delete, le filtrage tenant se fait
// via JOIN Chantier au niveau du repo — chantierId est ignoré.
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/domain"
        "opuc/internal/usecase/phase"
)

// PhaseHandler — handlers HTTP pour les Phases et Tâches.
type PhaseHandler struct {
        uc  *phase.Usecase
        log *slog.Logger
}

// NewPhaseHandler constructeur.
func NewPhaseHandler(uc *phase.Usecase, log *slog.Logger) *PhaseHandler {
        return &PhaseHandler{uc: uc, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Phase CRUD
// ══════════════════════════════════════════════════════════════════

// CreatePhase — POST /api/v1/chantiers/{chantierId}/phases
// Body JSON : { nom, description?, dateDebut?, dateFin? }
func (h *PhaseHandler) CreatePhase(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        chantierID := chi.URLParam(r, "chantierId")
        if chantierID == "" {
                WriteError(w, http.StatusBadRequest, "missing chantierId")
                return
        }

        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseCreatePhaseInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        created, err := h.uc.CreatePhase(r.Context(), au, chantierID, in)
        if err != nil {
                writePhaseError(w, h.log, "phase.Create", err)
                return
        }

        WriteJSON(w, http.StatusCreated, created)
}

// UpdatePhase — PUT /api/v1/chantiers/{chantierId}/phases/{phaseId}
// Body JSON : partial updates { nom?, description?, dateDebut?, dateFin?, avancement?, ordre? }
func (h *PhaseHandler) UpdatePhase(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        phaseID := chi.URLParam(r, "phaseId")
        if phaseID == "" {
                WriteError(w, http.StatusBadRequest, "missing phaseId")
                return
        }

        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseUpdatePhaseInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        updated, err := h.uc.UpdatePhase(r.Context(), au, phaseID, in)
        if err != nil {
                writePhaseError(w, h.log, "phase.Update", err)
                return
        }

        WriteJSON(w, http.StatusOK, updated)
}

// DeletePhase — DELETE /api/v1/chantiers/{chantierId}/phases/{phaseId}
// Cascade : supprime les tâches de la phase d'abord, puis la phase.
// Réponse : { ok: true }
func (h *PhaseHandler) DeletePhase(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        phaseID := chi.URLParam(r, "phaseId")
        if phaseID == "" {
                WriteError(w, http.StatusBadRequest, "missing phaseId")
                return
        }

        if err := h.uc.DeletePhase(r.Context(), au, phaseID); err != nil {
                writePhaseError(w, h.log, "phase.Delete", err)
                return
        }

        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": phaseID})
}

// ══════════════════════════════════════════════════════════════════
// Tache CRUD
// ══════════════════════════════════════════════════════════════════

// CreateTache — POST /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches
// Body JSON : { nom, description?, dateDebut?, dateFin?, responsableId?, tachePrecedenteId? }
// Statut auto = "PLANIFIEE" si vide.
func (h *PhaseHandler) CreateTache(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        phaseID := chi.URLParam(r, "phaseId")
        if phaseID == "" {
                WriteError(w, http.StatusBadRequest, "missing phaseId")
                return
        }

        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseCreateTacheInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        created, err := h.uc.CreateTache(r.Context(), au, phaseID, in)
        if err != nil {
                writePhaseError(w, h.log, "tache.Create", err)
                return
        }

        WriteJSON(w, http.StatusCreated, created)
}

// UpdateTache — PUT /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}
// Body JSON : partial updates { nom?, description?, dateDebut?, dateFin?,
//
//      responsableId?, tachePrecedenteId?, avancement?, statut?, ordre? }
//
// Règle auto : si avancement fourni sans statut explicite → statut dérivé
// (TERMINE si >= 100, EN_COURS si > 0, PLANIFIEE sinon).
//
// Le frontend utilise cet endpoint pour l'édition inline de l'avancement
// (chantier-detail-view.tsx ligne 464) en envoyant seulement { avancement: val }.
func (h *PhaseHandler) UpdateTache(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        tacheID := chi.URLParam(r, "tacheId")
        if tacheID == "" {
                WriteError(w, http.StatusBadRequest, "missing tacheId")
                return
        }

        var raw map[string]any
        if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        in, err := parseUpdateTacheInput(raw)
        if err != nil {
                WriteError(w, http.StatusBadRequest, err.Error())
                return
        }

        updated, err := h.uc.UpdateTache(r.Context(), au, tacheID, in)
        if err != nil {
                writePhaseError(w, h.log, "tache.Update", err)
                return
        }

        WriteJSON(w, http.StatusOK, updated)
}

// DeleteTache — DELETE /api/v1/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}
// Réponse : { ok: true }
func (h *PhaseHandler) DeleteTache(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        tacheID := chi.URLParam(r, "tacheId")
        if tacheID == "" {
                WriteError(w, http.StatusBadRequest, "missing tacheId")
                return
        }

        if err := h.uc.DeleteTache(r.Context(), au, tacheID); err != nil {
                writePhaseError(w, h.log, "tache.Delete", err)
                return
        }

        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": tacheID})
}

// ══════════════════════════════════════════════════════════════════
// Mes tâches (page /mes-taches)
// ══════════════════════════════════════════════════════════════════

// ListMyTaches — GET /api/v1/taches/mes-taches
// Retourne toutes les tâches où responsableId = currentUser.ID, avec
// Phase.Chantier préloadé pour le contexte.
//
// RBAC : auth requis (pas de RequireAccess — route personnelle).
// Un EMPLOYE peut consulter ses propres tâches assignées.
//
// Réponse 200 : { data: [...], total: N } où chaque tâche inclut
// { id, nom, statut, avancement, dateDebut, dateFin, phase: {...chantier: {...}}, responsableId }.
func (h *PhaseHandler) ListMyTaches(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        items, total, err := h.uc.ListMyTaches(r.Context(), au)
        if err != nil {
                writePhaseError(w, h.log, "tache.ListMy", err)
                return
        }

        // Assure que data est toujours un tableau (même vide) pour le frontend
        // (range sur un slice nil = 0 itérations → data = [] vide, pas null en JSON)
        data := make([]any, 0, len(items))
        for i := range items {
                data = append(data, items[i])
        }

        WriteJSON(w, http.StatusOK, map[string]any{
                "data":  data,
                "total": total,
        })
}

// ══════════════════════════════════════════════════════════════════
// Helpers — parsing JSON → usecase inputs
// ══════════════════════════════════════════════════════════════════

// parseCreatePhaseInput convertit un map raw en phase.CreatePhaseInput.
func parseCreatePhaseInput(raw map[string]any) (phase.CreatePhaseInput, error) {
        var in phase.CreatePhaseInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = v
        }
        if v, ok := raw["description"].(string); ok && v != "" {
                in.Description = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFin"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFin = &t
        }
        return in, nil
}

// parseUpdatePhaseInput convertit un map raw en phase.UpdatePhaseInput.
func parseUpdatePhaseInput(raw map[string]any) (phase.UpdatePhaseInput, error) {
        var in phase.UpdatePhaseInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = &v
        }
        if v, ok := raw["description"].(string); ok {
                in.Description = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFin"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFin = &t
        }
        if v, ok := raw["avancement"]; ok {
                f := toFloat64(v)
                in.Avancement = &f
        }
        if v, ok := raw["ordre"]; ok {
                i := int(toInt64(v))
                in.Ordre = &i
        }
        return in, nil
}

// parseCreateTacheInput convertit un map raw en phase.CreateTacheInput.
func parseCreateTacheInput(raw map[string]any) (phase.CreateTacheInput, error) {
        var in phase.CreateTacheInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = v
        }
        if v, ok := raw["description"].(string); ok && v != "" {
                in.Description = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFin"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFin = &t
        }
        if v, ok := raw["responsableId"].(string); ok && v != "" {
                in.ResponsableID = &v
        }
        if v, ok := raw["tachePrecedenteId"].(string); ok && v != "" {
                in.TachePrecedenteID = &v
        }
        return in, nil
}

// parseUpdateTacheInput convertit un map raw en phase.UpdateTacheInput.
func parseUpdateTacheInput(raw map[string]any) (phase.UpdateTacheInput, error) {
        var in phase.UpdateTacheInput

        if v, ok := raw["nom"].(string); ok {
                in.Nom = &v
        }
        if v, ok := raw["description"].(string); ok {
                in.Description = &v
        }
        if v, ok := raw["dateDebut"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateDebut = &t
        }
        if v, ok := raw["dateFin"].(string); ok && v != "" {
                t, err := parseDate(v)
                if err != nil {
                        return in, err
                }
                in.DateFin = &t
        }
        if v, ok := raw["responsableId"].(string); ok {
                in.ResponsableID = &v
        }
        if v, ok := raw["tachePrecedenteId"].(string); ok {
                in.TachePrecedenteID = &v
        }
        if v, ok := raw["avancement"]; ok {
                f := toFloat64(v)
                in.Avancement = &f
        }
        if v, ok := raw["statut"].(string); ok {
                in.Statut = &v
        }
        if v, ok := raw["ordre"]; ok {
                i := int(toInt64(v))
                in.Ordre = &i
        }
        return in, nil
}

// writePhaseError mappe les erreurs domain → HTTP status.
func writePhaseError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "phase or tache not found")
        case errors.Is(err, domain.ErrUnauthorized):
                WriteError(w, http.StatusUnauthorized, "unauthorized")
        case errors.Is(err, domain.ErrForbidden):
                WriteError(w, http.StatusForbidden, err.Error())
        case errors.Is(err, domain.ErrBadRequest):
                WriteError(w, http.StatusBadRequest, err.Error())
        case errors.Is(err, domain.ErrConflict):
                WriteError(w, http.StatusConflict, err.Error())
        default:
                log.Error(op, "err", err)
                WriteError(w, http.StatusInternalServerError, "internal error")
        }
}
