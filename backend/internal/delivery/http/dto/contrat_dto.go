// Package dto — contrat_dto.go
// DTOs pour les routes /api/v1/contrats/* (Phase 4, commercial).
//
// Contrat : numero (auto-genéré), clientId, objet, typeContrat (TRAVAUX,
// FOURNITURE, SERVICE, MIXTE), montantHT, tauxTVA, montantTTC (computed),
// dateDebut, dateFin, conditions, statut (EN_PREPARATION, ACTIF, EXPIRE,
// RESILIE, TERMINE), penaltyRetard (% par jour de retard).
//
// Calcul : montantTTC = montantHT × (1 + tauxTVA/100)
package dto

import (
	"opuc/internal/domain/model"
)

// CreateContratRequest — payload POST /api/v1/contrats
type CreateContratRequest struct {
	ClientID      string  `json:"clientId"`
	Objet         string  `json:"objet"`
	TypeContrat   *string `json:"typeContrat,omitempty"` // default TRAVAUX
	MontantHT     float64 `json:"montantHT"`
	TauxTVA       *float64 `json:"tauxTVA,omitempty"` // default 18
	DateDebut     *string `json:"dateDebut,omitempty"`
	DateFin       *string `json:"dateFin,omitempty"`
	Conditions    *string `json:"conditions,omitempty"`
	PenaltyRetard *float64 `json:"penaltyRetard,omitempty"`
}

// UpdateContratRequest — payload PUT /api/v1/contrats/{id}
type UpdateContratRequest struct {
	Objet         *string  `json:"objet,omitempty"`
	TypeContrat   *string  `json:"typeContrat,omitempty"`
	MontantHT     *float64 `json:"montantHT,omitempty"`
	TauxTVA       *float64 `json:"tauxTVA,omitempty"`
	DateDebut     *string  `json:"dateDebut,omitempty"`
	DateFin       *string  `json:"dateFin,omitempty"`
	Conditions    *string  `json:"conditions,omitempty"`
	PenaltyRetard *float64 `json:"penaltyRetard,omitempty"`
}

// ContratListResponse — réponse GET /api/v1/contrats
type ContratListResponse struct {
	Data     []model.Contrat `json:"data"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

// ChangeStatutRequest — payload POST /api/v1/contrats/{id}/statut
type ChangeStatutRequest struct {
	Statut string `json:"statut"` // EN_PREPARATION, ACTIF, EXPIRE, RESILIE, TERMINE
}
