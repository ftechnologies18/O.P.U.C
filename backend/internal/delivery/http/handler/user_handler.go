// Package handler — user_handler.go
// Handlers HTTP pour /api/v1/users/* (IAM CRUD).
//
// Routes (cf. router.go) :
//   GET    /api/v1/users                      — list paginée (SUPER_ADMIN, GERANT)
//   POST   /api/v1/users                      — create (SUPER_ADMIN, GERANT)
//   GET    /api/v1/users/{id}                 — get by id (auth requis)
//   PUT    /api/v1/users/{id}                 — update (auth requis)
//   DELETE /api/v1/users/{id}                 — soft delete (SUPER_ADMIN)
//   POST   /api/v1/users/{id}/toggle-active   — toggle active (SUPER_ADMIN, GERANT)
//   POST   /api/v1/users/{id}/reset-password  — reset password (SUPER_ADMIN, GERANT)
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par
// middleware.Auth) pour le RLS.
package handler

import (
        "encoding/json"
        "errors"
        "log/slog"
        "net/http"
        "strconv"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/domain"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/iam"
)

// UserHandler — handlers HTTP pour /api/v1/users/*.
type UserHandler struct {
        uc  *iam.UsersUsecase
        log *slog.Logger
}

// NewUserHandler constructeur.
func NewUserHandler(uc *iam.UsersUsecase, log *slog.Logger) *UserHandler {
        return &UserHandler{uc: uc, log: log}
}

// List — GET /api/v1/users
// Query params (tous optionnels) :
//   ?page=1           — 1-based (défaut 1)
//   ?pageSize=50      — défaut 50
//   ?search=xxx       — ILIKE sur email OU name
//   ?role=GERANT      — filtre par rôle
//   ?active=true      — filtre par statut (true|false)
//
// RLS : SUPER_ADMIN voit toutes les entreprises, autres rôles ne voient que la leur.
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        filter := iam.ListFilter{
                Page:     atoiDefault(r.URL.Query().Get("page"), 1),
                PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
                Search:   r.URL.Query().Get("search"),
                Role:     r.URL.Query().Get("role"),
        }
        if v := r.URL.Query().Get("active"); v != "" {
                b := v == "true" || v == "1"
                filter.Active = &b
        }

        users, total, err := h.uc.List(r.Context(), au, filter)
        if err != nil {
                h.log.Error("users.List", "err", err)
                WriteError(w, http.StatusInternalServerError, "internal error")
                return
        }

        WriteJSON(w, http.StatusOK, dto.UsersListResponse{
                Data:     dto.UsersToSummaries(users),
                Total:    total,
                Page:     filter.Page,
                PageSize: filter.PageSize,
        })
}

// Get — GET /api/v1/users/{id}
// RLS-filtered : un GERANT ne peut pas GET un user d'une autre entreprise.
func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
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

        user, err := h.uc.Get(r.Context(), au, id)
        if err != nil {
                writeIAMError(w, h.log, "users.Get", err)
                return
        }

        WriteJSON(w, http.StatusOK, dto.UserToResponse(user))
}

// Create — POST /api/v1/users
// Body : dto.CreateUserRequest
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
        au := authUserFromCtx(r.Context())
        if au == nil {
                WriteError(w, http.StatusUnauthorized, "unauthorized")
                return
        }

        var req dto.CreateUserRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        user, err := h.uc.Create(r.Context(), au, iam.CreateUserInput{
                Email:        req.Email,
                Name:         req.Name,
                Role:         req.Role,
                Password:     req.Password,
                Fonction:     req.Fonction,
                Telephone:    req.Telephone,
                EntrepriseID: req.EntrepriseID,
        })
        if err != nil {
                writeIAMError(w, h.log, "users.Create", err)
                return
        }

        WriteJSON(w, http.StatusCreated, dto.UserToResponse(user))
}

// Update — PUT /api/v1/users/{id}
// Body : dto.UpdateUserRequest (tous les champs optionnels)
func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
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

        var req dto.UpdateUserRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        user, err := h.uc.Update(r.Context(), au, id, iam.UpdateUserInput{
                Name:      req.Name,
                Telephone: req.Telephone,
                Role:      req.Role,
                Fonction:  req.Fonction,
                Active:    req.Active,
        })
        if err != nil {
                writeIAMError(w, h.log, "users.Update", err)
                return
        }

        WriteJSON(w, http.StatusOK, dto.UserToResponse(user))
}

// Delete — DELETE /api/v1/users/{id}
// Soft delete (active=false). Idempotent.
func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
                writeIAMError(w, h.log, "users.Delete", err)
                return
        }

        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ToggleActive — POST /api/v1/users/{id}/toggle-active
// Bascule active true/false.
func (h *UserHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
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

        user, err := h.uc.ToggleActive(r.Context(), au, id)
        if err != nil {
                writeIAMError(w, h.log, "users.ToggleActive", err)
                return
        }

        WriteJSON(w, http.StatusOK, dto.ToggleActiveResponse{User: dto.UserToResponse(user)})
}

// ResetPassword — POST /api/v1/users/{id}/reset-password
// Body : dto.ResetPasswordRequest
func (h *UserHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
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

        var req dto.ResetPasswordRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                WriteError(w, http.StatusBadRequest, "invalid JSON body")
                return
        }

        if err := h.uc.ResetPassword(r.Context(), au, id, req.Password); err != nil {
                writeIAMError(w, h.log, "users.ResetPassword", err)
                return
        }

        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ── helpers ────────────────────────────────────────────────────

// writeIAMError mappe les erreurs domain → HTTP status pour les handlers IAM.
// Centralise la logique de mapping pour éviter la répétition dans chaque handler.
func writeIAMError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
        switch {
        case errors.Is(err, domain.ErrNotFound):
                WriteError(w, http.StatusNotFound, "resource not found")
        case errors.Is(err, domain.ErrForbidden):
                WriteError(w, http.StatusForbidden, "insufficient permissions")
        case errors.Is(err, domain.ErrConflict):
                WriteError(w, http.StatusConflict, "resource already exists")
        case errors.Is(err, domain.ErrUnauthorized):
                WriteError(w, http.StatusUnauthorized, "unauthorized")
        case errors.Is(err, domain.ErrBadRequest):
                WriteError(w, http.StatusBadRequest, err.Error())
        default:
                log.Error(op, "err", err)
                WriteError(w, http.StatusInternalServerError, "internal error")
        }
}

// atoiDefault parse un int depuis une string, avec fallback.
func atoiDefault(s string, def int) int {
        if s == "" {
                return def
        }
        n, err := strconv.Atoi(s)
        if err != nil || n < 1 {
                return def
        }
        return n
}

// compile-time check : s'assurer que database.AuthUser est bien référencé.
var _ = database.FromContext
