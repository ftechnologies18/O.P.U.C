// Package dto — delegation_dto.go
// DTOs pour les routes de délégation :
//   - /api/v1/delegations/* (CRUD délégations de domaines)
//   - /api/v1/users/{id}/promote-co-gerant
//   - /api/v1/users/{id}/demote-co-gerant
//   - /api/v1/users/co-gerants
//
// Format wire (JSON) aligné sur le frontend Next.js (camelCase).
package dto

import (
        "time"

        "opuc/internal/domain/model"
)

// ── Delegations CRUD ────────────────────────────────────────────────

// CreateDelegationRequest — payload POST /api/v1/delegations
type CreateDelegationRequest struct {
        ToUserID    string     `json:"toUserId" validate:"required"`
        Domain      string     `json:"domain" validate:"required"`
        Permissions string     `json:"permissions" validate:"required"`
        ExpiresLe   *time.Time `json:"expiresLe,omitempty"`
        Raison      *string    `json:"raison,omitempty"`
}

// UpdateDelegationRequest — payload PUT /api/v1/delegations/{id}
// Tous les champs sont optionnels (seuls les non-nil sont updatés).
type UpdateDelegationRequest struct {
        ToUserID    *string    `json:"toUserId,omitempty"`
        Permissions *string    `json:"permissions,omitempty"`
        ExpiresLe   *time.Time `json:"expiresLe,omitempty"`
        Raison      *string    `json:"raison,omitempty"`
}

// DelegationListResponse — réponse GET /api/v1/delegations
type DelegationListResponse struct {
        Data     []model.Delegation `json:"data"`
        Total    int64              `json:"total"`
        Page     int                `json:"page"`
        PageSize int                `json:"pageSize"`
}

// MyDelegationsResponse — réponse GET /api/v1/delegations/my
type MyDelegationsResponse struct {
        Data []model.Delegation `json:"data"`
}

// ── Co-GERANTS ──────────────────────────────────────────────────────

// CoGerantSummary — résumé d'un co-GERANT dans la liste.
type CoGerantSummary struct {
        ID            string     `json:"id"`
        Email         string     `json:"email"`
        Name          string     `json:"name"`
        Role          string     `json:"role"`
        Telephone     *string    `json:"telephone,omitempty"`
        Active        bool       `json:"active"`
        EntrepriseID  *string    `json:"entrepriseId,omitempty"`
        IsCoGerant    bool       `json:"isCoGerant"`
        LastLoginAt   *time.Time `json:"lastLoginAt,omitempty"`
        CreatedAt     time.Time  `json:"createdAt"`
}

// CoGerantsListResponse — réponse GET /api/v1/users/co-gerants
type CoGerantsListResponse struct {
        Data  []CoGerantSummary `json:"data"`
        Count int               `json:"count"`
        Max   int               `json:"max"`
}

// CoGerantActionResponse — réponse POST promote/demote-co-gerant
// Retourne le user mis à jour.
type CoGerantActionResponse struct {
        User CoGerantSummary `json:"user"`
}

// ── Helpers ─────────────────────────────────────────────────────────

// UserToCoGerantSummary convertit un model.User en CoGerantSummary.
func UserToCoGerantSummary(u *model.User) CoGerantSummary {
        return CoGerantSummary{
                ID:           u.ID,
                Email:        u.Email,
                Name:         u.Name,
                Role:         u.Role,
                Telephone:    u.Telephone,
                Active:       u.Active,
                EntrepriseID: u.EntrepriseID,
                IsCoGerant:   u.IsCoGerant,
                LastLoginAt:  u.LastLoginAt,
                CreatedAt:    u.CreatedAt,
        }
}

// UsersToCoGerantSummaries convertit un slice de users en slice de CoGerantSummary.
func UsersToCoGerantSummaries(users []model.User) []CoGerantSummary {
        out := make([]CoGerantSummary, 0, len(users))
        for i := range users {
                out = append(out, UserToCoGerantSummary(&users[i]))
        }
        return out
}
