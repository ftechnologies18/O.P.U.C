// Package dto — iam_dto.go
// Data Transfer Objects pour les routes IAM (/api/v1/users, /api/v1/auth/2fa).
//
// Ces DTOs séparent le format wire (JSON HTTP) des entités domaine (model.User).
// Le handler convertit model.User → UserSummary pour éviter d'exposer les champs
// sensibles (password, twoFactorSecret, loginAttempts…).
package dto

import (
        "encoding/json"
        "time"

        "opuc/internal/domain/model"
)

// ── Users CRUD ─────────────────────────────────────────────────

// CreateUserRequest — payload POST /api/v1/users
type CreateUserRequest struct {
        Email        string  `json:"email" validate:"required,email"`
        Name         string  `json:"name" validate:"required"`
        Role         string  `json:"role" validate:"required"`
        Password     string  `json:"password" validate:"required,min=6"`
        Telephone    *string `json:"telephone,omitempty"`
        EntrepriseID *string `json:"entrepriseId,omitempty"`
}

// UpdateUserRequest — payload PUT /api/v1/users/{id}
// Tous les champs sont optionnels (pointeurs) : seuls les champs non-nil sont updatés.
type UpdateUserRequest struct {
        Name      *string `json:"name,omitempty"`
        Telephone *string `json:"telephone,omitempty"`
        Role      *string `json:"role,omitempty"`
        Active    *bool   `json:"active,omitempty"`
}

// ResetPasswordRequest — payload POST /api/v1/users/{id}/reset-password
type ResetPasswordRequest struct {
        Password string `json:"password" validate:"required,min=6"`
}

// UserResponse — réponse GET/POST/PUT /api/v1/users/{id}
// Retourne le user complet (sans password ni twoFactorSecret).
type UserResponse struct {
        ID                string     `json:"id"`
        Email             string     `json:"email"`
        Name              string     `json:"name"`
        Role              string     `json:"role"`
        Telephone         *string    `json:"telephone,omitempty"`
        Active            bool       `json:"active"`
        EntrepriseID      *string    `json:"entrepriseId,omitempty"`
        TwoFactorEnabled  bool       `json:"twoFactorEnabled"`
        LastLoginAt       *time.Time `json:"lastLoginAt,omitempty"`
        PremiereConnexion bool       `json:"premiereConnexion"`
        CreatedAt         time.Time  `json:"createdAt"`
        UpdatedAt         time.Time  `json:"updatedAt"`
}

// UserSummary — résumé d'un user dans la liste (sans LastLoginAt ni PremiereConnexion
// pour alléger la réponse paginée).
type UserSummary struct {
        ID               string     `json:"id"`
        Email            string     `json:"email"`
        Name             string     `json:"name"`
        Role             string     `json:"role"`
        Telephone        *string    `json:"telephone,omitempty"`
        Active           bool       `json:"active"`
        EntrepriseID     *string    `json:"entrepriseId,omitempty"`
        TwoFactorEnabled bool       `json:"twoFactorEnabled"`
        LastLoginAt      *time.Time `json:"lastLoginAt,omitempty"`
        CreatedAt        time.Time  `json:"createdAt"`
}

// UsersListResponse — réponse GET /api/v1/users
type UsersListResponse struct {
        Data     []UserSummary `json:"data"`
        Total    int64         `json:"total"`
        Page     int           `json:"page"`
        PageSize int           `json:"pageSize"`
}

// ToggleActiveResponse — réponse POST /api/v1/users/{id}/toggle-active
type ToggleActiveResponse struct {
        User UserResponse `json:"user"`
}

// ── 2FA ─────────────────────────────────────────────────────────

// TwoFASetupRequest — pas de body (userID vient du JWT).
// Défini pour homogénéité si on veut ajouter des options plus tard.
type TwoFASetupRequest struct{}

// TwoFASetupResponse — réponse POST /api/v1/auth/2fa/setup
// secret = à conserver côté frontend pour fallback (codes de secours plus tard).
// qrUrl = URL otpauth:// à encoder en QR code côté frontend (librairie qrcode).
type TwoFASetupResponse struct {
        Secret string `json:"secret"`
        QrURL  string `json:"qrUrl"`
}

// TwoFAVerifyRequest — payload POST /api/v1/auth/2fa/verify
type TwoFAVerifyRequest struct {
        Code string `json:"code" validate:"required,len=6"`
}

// TwoFADisableRequest — payload POST /api/v1/auth/2fa/disable
type TwoFADisableRequest struct {
        Password string `json:"password" validate:"required"`
}

// ── Permissions & Audit ────────────────────────────────────────

// PermissionsListResponse — réponse GET /api/v1/permissions
type PermissionsListResponse struct {
        Data []model.PermissionConfig `json:"data"`
}

// AuditLogsListResponse — réponse GET /api/v1/audit-logs
type AuditLogsListResponse struct {
        Data     []model.AuditLog `json:"data"`
        Total    int64            `json:"total"`
        Page     int              `json:"page"`
        PageSize int              `json:"pageSize"`
}

// ── Helpers de conversion ──────────────────────────────────────

// UserToResponse convertit un model.User en UserResponse (sans champs sensibles).
func UserToResponse(u *model.User) UserResponse {
        return UserResponse{
                ID:                u.ID,
                Email:             u.Email,
                Name:              u.Name,
                Role:              u.Role,
                Telephone:         u.Telephone,
                Active:            u.Active,
                EntrepriseID:      u.EntrepriseID,
                TwoFactorEnabled:  u.TwoFactorEnabled,
                LastLoginAt:       u.LastLoginAt,
                PremiereConnexion: u.PremiereConnexion,
                CreatedAt:         u.CreatedAt,
                UpdatedAt:         u.UpdatedAt,
        }
}

// UserToSummary convertit un model.User en UserSummary (pour la liste paginée).
func UserToSummary(u *model.User) UserSummary {
        return UserSummary{
                ID:               u.ID,
                Email:            u.Email,
                Name:             u.Name,
                Role:             u.Role,
                Telephone:        u.Telephone,
                Active:           u.Active,
                EntrepriseID:     u.EntrepriseID,
                TwoFactorEnabled: u.TwoFactorEnabled,
                LastLoginAt:      u.LastLoginAt,
                CreatedAt:        u.CreatedAt,
        }
}

// UsersToSummaries convertit un slice de users en slice de summaries.
func UsersToSummaries(users []model.User) []UserSummary {
        out := make([]UserSummary, 0, len(users))
        for i := range users {
                out = append(out, UserToSummary(&users[i]))
        }
        return out
}

// compile-time check : s'assurer que json.RawMessage reste utilisé ailleurs.
var _ json.RawMessage
