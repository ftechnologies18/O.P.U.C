// Package handler — delegation_handler.go
// Handlers HTTP pour les routes de délégation.
//
// Routes (cf. router.go) :
//   GET    /api/v1/delegations                  — list (GERANT sees all, user sees own)
//   POST   /api/v1/delegations                  — create (GERANT only)
//   GET    /api/v1/delegations/{id}             — detail
//   PUT    /api/v1/delegations/{id}             — update (GERANT only)
//   POST   /api/v1/delegations/{id}/revoke      — revoke (GERANT only)
//   GET    /api/v1/delegations/my               — my received delegations (any auth user)
//   POST   /api/v1/users/{id}/promote-co-gerant — promote (principal GERANT only)
//   POST   /api/v1/users/{id}/demote-co-gerant  — demote (principal GERANT only)
//   GET    /api/v1/users/co-gerants             — list co-gerants (GERANT only)
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par middleware.Auth).
// L'autorisation RBAC est faite côté usecase (rôle + ownership).
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/usecase/delegation"
)

// DelegationHandler — handlers HTTP pour /api/v1/delegations/* et co-gerants.
type DelegationHandler struct {
        uc  *delegation.Usecase
        log *slog.Logger
}

// NewDelegationHandler constructeur.
func NewDelegationHandler(uc *delegation.Usecase, log *slog.Logger) *DelegationHandler {
        return &DelegationHandler{uc: uc, log: log}
}

// ── Delegations CRUD ────────────────────────────────────────────────

// List — GET /api/v1/delegations
// Query params (tous optionnels) :
//   ?page=1&pageSize=50          — pagination
//   ?toUserId=xxx                — filtre par user receveur
//   ?domain=FINANCE              — filtre par domaine
//   ?statut=ACTIF                — filtre par statut (ACTIF | REVOCQUE | EXPIRE)
//   ?fromUserId=xxx              — filtre par user source (GERANT qui a délégué)
//
// RLS-aware : GERANT/co-GERANT voit toutes les délégations de SON entreprise,
// les autres rôles ne voient que leurs propres délégations reçues (force toUserId).
func (h *DelegationHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        in := delegation.ListInput{
                ToUserID:   r.URL.Query().Get("toUserId"),
                Domain:     r.URL.Query().Get("domain"),
                Statut:     r.URL.Query().Get("statut"),
                FromUserID: r.URL.Query().Get("fromUserId"),
                Page:       atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
        }
        items, total, err := h.uc.List(r.Context(), au, in)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.List", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.DelegationListResponse{
                Data:     items,
                Total:    total,
                Page:     in.Page,
                PageSize: in.PageSize,
        })
}

// Create — POST /api/v1/delegations
// Body : dto.CreateDelegationRequest
// Règles (cf. usecase) : GERANT/co-GERANT/SUPER_ADMIN only, toUser must be in same entreprise,
// no duplicate (toUser, domain) active, etc.
func (h *DelegationHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        var req dto.CreateDelegationRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        created, err := h.uc.Create(r.Context(), au, delegation.CreateInput{
                ToUserID:    req.ToUserID,
                Domain:      req.Domain,
                Permissions: req.Permissions,
                ExpiresLe:   req.ExpiresLe,
                Raison:      req.Raison,
        })
        if err != nil {
                writeDelegationError(w, h.log, "delegation.Create", err)
                return
        }
        WriteJSON(w, http.StatusCreated, created)
}

// Get — GET /api/v1/delegations/{id}
// RLS-aware : un user non-GERANT ne peut voir que ses propres délégations reçues.
func (h *DelegationHandler) Get(w http.ResponseWriter, r *http.Request) {
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
        d, err := h.uc.GetByID(r.Context(), au, id)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.Get", err)
                return
        }
        WriteJSON(w, http.StatusOK, d)
}

// Update — PUT /api/v1/delegations/{id}
// Body : dto.UpdateDelegationRequest (tous les champs optionnels)
func (h *DelegationHandler) Update(w http.ResponseWriter, r *http.Request) {
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
        var req dto.UpdateDelegationRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }
        updated, err := h.uc.Update(r.Context(), au, id, delegation.UpdateInput{
                ToUserID:    req.ToUserID,
                Permissions: req.Permissions,
                ExpiresLe:   req.ExpiresLe,
                Raison:      req.Raison,
        })
        if err != nil {
                writeDelegationError(w, h.log, "delegation.Update", err)
                return
        }
        WriteJSON(w, http.StatusOK, updated)
}

// Revoke — POST /api/v1/delegations/{id}/revoke
// Règles : GERANT/co-GERANT/SUPER_ADMIN (ou le toUserId lui-même pour "renoncer").
func (h *DelegationHandler) Revoke(w http.ResponseWriter, r *http.Request) {
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
        revoked, err := h.uc.Revoke(r.Context(), au, id)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.Revoke", err)
                return
        }
        WriteJSON(w, http.StatusOK, revoked)
}

// ListMy — GET /api/v1/delegations/my
// Liste les délégations reçues par le user courant (auth.UserID).
// Accessible à tous les authentifiés.
func (h *DelegationHandler) ListMy(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        items, err := h.uc.ListMyDelegations(r.Context(), au)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.ListMy", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.MyDelegationsResponse{Data: items})
}

// ── Co-GERANTS management ───────────────────────────────────────────

// PromoteCoGerant — POST /api/v1/users/{id}/promote-co-gerant
// Règles : principal GERANT (role=="GERANT", pas isCoGerant) ou SUPER_ADMIN only.
// Max 2 co-GERANTS par entreprise.
func (h *DelegationHandler) PromoteCoGerant(w http.ResponseWriter, r *http.Request) {
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
        user, err := h.uc.PromoteCoGerant(r.Context(), au, id)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.PromoteCoGerant", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.CoGerantActionResponse{
                User: dto.UserToCoGerantSummary(user),
        })
}

// DemoteCoGerant — POST /api/v1/users/{id}/demote-co-gerant
// Règles : principal GERANT (role=="GERANT", pas isCoGerant) ou SUPER_ADMIN only.
func (h *DelegationHandler) DemoteCoGerant(w http.ResponseWriter, r *http.Request) {
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
        user, err := h.uc.DemoteCoGerant(r.Context(), au, id)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.DemoteCoGerant", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.CoGerantActionResponse{
                User: dto.UserToCoGerantSummary(user),
        })
}

// ListCoGerants — GET /api/v1/users/co-gerants
// Liste les co-GERANTS de l'entreprise courante. GERANT (principal ou co) only.
// Retourne aussi le count actuel et le max (pour le frontend).
func (h *DelegationHandler) ListCoGerants(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }
        users, err := h.uc.ListCoGerants(r.Context(), au)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.ListCoGerants", err)
                return
        }
        count, err := h.uc.CountCoGerants(r.Context(), au)
        if err != nil {
                writeDelegationError(w, h.log, "delegation.CountCoGerants", err)
                return
        }
        WriteJSON(w, http.StatusOK, dto.CoGerantsListResponse{
                Data:  dto.UsersToCoGerantSummaries(users),
                Count: count,
                Max:   2, // model.MaxCoGerants
        })
}

// ── helpers ─────────────────────────────────────────────────────────

// writeDelegationError mappe les erreurs domain → HTTP status pour les handlers délégation.
func writeDelegationError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "resource not found")
        case errors.Is(err, domain.ErrForbidden):
                WriteError(w, http.StatusForbidden, "insufficient permissions")
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
