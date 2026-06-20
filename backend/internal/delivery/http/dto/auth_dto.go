// Package dto — Data Transfer Objects pour la couche HTTP.
// Sépare le format wire (JSON) des entités domaine (model).
package dto

import "encoding/json"

// LoginRequest — payload POST /api/v1/auth/login
type LoginRequest struct {
        Email    string `json:"email" validate:"required,email"`
        Password string `json:"password" validate:"required,min=6"`
}

// LoginResponse — réponse POST /api/v1/auth/login
type LoginResponse struct {
        User          json.RawMessage `json:"user"`
        TwoFARequired bool            `json:"twoFARequired"`
        TwoFAVerified bool            `json:"twoFAVerified"`
        ExpiresIn     int             `json:"expiresIn"` // secondes
}

// MeResponse — réponse GET /api/v1/auth/me
type MeResponse struct {
        ID           string  `json:"id"`
        Email        string  `json:"email"`
        Name         string  `json:"name"`
        Role         string  `json:"role"`
        Telephone    *string `json:"telephone,omitempty"`
        Active       bool    `json:"active"`
        EntrepriseID *string `json:"entrepriseId,omitempty"`
        TwoFAEnabled bool    `json:"twoFactorEnabled"`
        IsCoGerant   bool    `json:"isCoGerant"`
}

// ErrorResponse — format d'erreur standard pour toutes les routes.
type ErrorResponse struct {
        Error   string `json:"error"`
        Message string `json:"message,omitempty"`
        Code    string `json:"code,omitempty"`
}

// HealthResponse — réponse GET /api/v1/health
type HealthResponse struct {
        Status   string `json:"status"`
        Service  string `json:"service"`
        Version  string `json:"version"`
        Time     string `json:"time"`
}
