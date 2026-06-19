// Package dto — pointage_dto.go
// DTOs pour les routes /api/v1/pointage (Phase 3, write métier).
//
// Format wire (JSON) aligné sur le frontend Next.js. Les dates sont transmises
// en ISO 8601 (RFC3339 ou YYYY-MM-DD) et parsées par le handler.
package dto

import "opuc/internal/domain/model"

// CreatePointageRequest — payload POST /api/v1/pointage
// dateTravail : ISO 8601 (RFC3339 ou YYYY-MM-DD).
type CreatePointageRequest struct {
	JournalierID   string  `json:"journalierId"`
	ChantierID     string  `json:"chantierId"`
	DateTravail    string  `json:"dateTravail"`
	TauxJournalier float64 `json:"tauxJournalier"`
	Present        bool    `json:"present"`
	Observation    *string `json:"observation,omitempty"`
}

// UpdatePointageRequest — payload PUT /api/v1/pointage/{id}
// Tous les champs optionnels (pointeurs).
type UpdatePointageRequest struct {
	TauxJournalier *float64 `json:"tauxJournalier,omitempty"`
	Present        *bool    `json:"present,omitempty"`
	Observation    *string  `json:"observation,omitempty"`
}

// PointageListResponse — réponse GET /api/v1/pointage
type PointageListResponse struct {
	Data     []model.Pointage `json:"data"`
	Total    int64            `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"pageSize"`
}
