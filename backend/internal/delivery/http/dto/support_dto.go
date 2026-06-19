// Package dto — support_dto.go
// DTOs pour les routes /api/v1/support/* (Phase 5, peripheral endpoints).
//
// TicketSupport : titre, description, priorite (BASSE/MOYENNE/HAUTE/URGENTE),
// categorie (TECHNIQUE/FACTURATION/PLANNING/AUTRE), clientId?, assigneAId?.
// entrepriseId est forcé à auth.EntrepriseID côté usecase (RLS WITH CHECK).
// statut defaults to OUVERT. resoluLe + resoluParId set when statut=RESOLU/FERME.
//
// TicketMessage : ticketId, contenu, pieceJointe?. auteurId = auth.UserID.
package dto

import (
	"opuc/internal/domain/model"
)

// ── TicketSupport ──────────────────────────────────────────────

// CreateTicketRequest — payload POST /api/v1/support
type CreateTicketRequest struct {
	Titre      string  `json:"titre"`
	Description string `json:"description"`
	Priorite   string  `json:"priorite"` // BASSE/MOYENNE/HAUTE/URGENTE
	Categorie  *string `json:"categorie,omitempty"`
	ClientID   *string `json:"clientId,omitempty"`
}

// UpdateTicketRequest — payload PUT /api/v1/support/{id}
// Tous les champs optionnels.
type UpdateTicketRequest struct {
	Titre       *string `json:"titre,omitempty"`
	Description *string `json:"description,omitempty"`
	Priorite    *string `json:"priorite,omitempty"`
	Categorie   *string `json:"categorie,omitempty"`
	AssigneeAID *string `json:"assigneAId,omitempty"`
}

// ChangeTicketStatutRequest — payload POST /api/v1/support/{id}/statut
type ChangeTicketStatutRequest struct {
	Statut string `json:"statut"` // OUVERT, EN_COURS, RESOLU, FERME
}

// TicketListResponse — réponse GET /api/v1/support
type TicketListResponse struct {
	Data     []model.TicketSupport `json:"data"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

// ── TicketMessage ──────────────────────────────────────────────

// CreateTicketMessageRequest — payload POST /api/v1/support/{id}/messages
type CreateTicketMessageRequest struct {
	Contenu     string  `json:"contenu"`
	PieceJointe *string `json:"pieceJointe,omitempty"`
}

// TicketMessageListResponse — réponse GET /api/v1/support/{id}/messages
type TicketMessageListResponse struct {
	Data  []model.TicketMessage `json:"data"`
	Total int64                 `json:"total"`
}

// ── Stats ──────────────────────────────────────────────────────

// SupportStatsResponse — réponse GET /api/v1/support/stats
type SupportStatsResponse struct {
	Total      int64            `json:"total"`
	ByStatut   map[string]int64 `json:"byStatut"`
	ByPriorite map[string]int64 `json:"byPriorite"`
	ByCategorie map[string]int64 `json:"byCategorie"`
	OpenCount  int64            `json:"openCount"`
	ResolvedCount int64         `json:"resolvedCount"`
}
