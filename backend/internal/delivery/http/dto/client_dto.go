// Package dto — client_dto.go
// DTOs pour les routes /api/v1/clients/* (Phase 4, commercial).
//
// Client : raisonSociale (required), nomContact, telephone, email, adresse,
// rccm, nif, type (ENTREPRISE/PARTICULIER/INSTITUTION), statut
// (ACTIF/INACTIF/PROSPECT), notes.
package dto

import (
	"opuc/internal/domain/model"
)

// ── Client ─────────────────────────────────────────────────────

// CreateClientRequest — payload POST /api/v1/clients
type CreateClientRequest struct {
	RaisonSociale string  `json:"raisonSociale"`
	NomContact    *string `json:"nomContact,omitempty"`
	Telephone     *string `json:"telephone,omitempty"`
	Email         *string `json:"email,omitempty"`
	Adresse       *string `json:"adresse,omitempty"`
	RCCM          *string `json:"rccm,omitempty"`
	NIF           *string `json:"nif,omitempty"`
	Type          *string `json:"type,omitempty"`   // default ENTREPRISE
	Statut        *string `json:"statut,omitempty"` // default ACTIF
	Notes         *string `json:"notes,omitempty"`
}

// UpdateClientRequest — payload PUT /api/v1/clients/{id}
// Tous les champs optionnels (pointeurs).
type UpdateClientRequest struct {
	RaisonSociale *string `json:"raisonSociale,omitempty"`
	NomContact    *string `json:"nomContact,omitempty"`
	Telephone     *string `json:"telephone,omitempty"`
	Email         *string `json:"email,omitempty"`
	Adresse       *string `json:"adresse,omitempty"`
	RCCM          *string `json:"rccm,omitempty"`
	NIF           *string `json:"nif,omitempty"`
	Type          *string `json:"type,omitempty"`
	Statut        *string `json:"statut,omitempty"`
	Notes         *string `json:"notes,omitempty"`
}

// ClientDetailResponse — réponse GET /api/v1/clients/{id} avec compteurs.
type ClientDetailResponse struct {
	model.Client
	ChantiersCount int64 `json:"chantiersCount"`
	DevisCount     int64 `json:"devisCount"`
	FacturesCount  int64 `json:"facturesCount"`
}

// ClientListResponse — réponse GET /api/v1/clients
type ClientListResponse struct {
	Data     []model.Client `json:"data"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

// ClientStatsResponse — réponse GET /api/v1/clients/stats
type ClientStatsResponse struct {
	Total        int64            `json:"total"`
	ByType       map[string]int64 `json:"byType"`
	ByStatut     map[string]int64 `json:"byStatut"`
	RecentCount  int64            `json:"recentCount"` // created within last 30 days
}
