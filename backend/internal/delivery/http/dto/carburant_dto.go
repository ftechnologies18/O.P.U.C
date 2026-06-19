// Package dto — carburant_dto.go
// DTOs pour les routes /api/v1/carburant/* (Phase 3, write métier).
//
// Sous-domaines : StockCarburant, EntreeCarburant, SortieCarburant,
// BonAchatCarburant, ReleveCompteurEngin.
// prixTotal = quantite * prixUnitaire (calculé côté usecase).
package dto

import (
	"opuc/internal/domain/model"
)

// ── StockCarburant ─────────────────────────────────────────────

// CreateStockCarburantRequest — payload POST /api/v1/carburant/stock
type CreateStockCarburantRequest struct {
	ChantierID    string  `json:"chantierId"`
	TypeCarburant string  `json:"typeCarburant"` // GASOIL, ESSENCE
	Capacite      float64 `json:"capacite"`
	SeuilAlerte   float64 `json:"seuilAlerte"`
}

// UpdateStockCarburantRequest — payload PUT /api/v1/carburant/stock/{id}
type UpdateStockCarburantRequest struct {
	Capacite    *float64 `json:"capacite,omitempty"`
	SeuilAlerte *float64 `json:"seuilAlerte,omitempty"`
}

// StockCarburantWithQuantite — stock carburant + quantiteDisponible calculée.
type StockCarburantWithQuantite struct {
	model.StockCarburant
	QuantiteDisponible float64 `json:"quantiteDisponible"`
}

// StockCarburantListResponse — réponse GET /api/v1/carburant/stock
type StockCarburantListResponse struct {
	Data []StockCarburantWithQuantite `json:"data"`
}

// StockCarburantDetailResponse — réponse GET /api/v1/carburant/stock/{id}
type StockCarburantDetailResponse struct {
	model.StockCarburant
	QuantiteDisponible float64 `json:"quantiteDisponible"`
}

// ── EntreeCarburant ────────────────────────────────────────────

// CreateEntreeCarburantRequest — payload POST /api/v1/carburant/entrees
// prixTotal est calculé = quantite * prixUnitaire.
type CreateEntreeCarburantRequest struct {
	StockCarburantID string  `json:"stockCarburantId"`
	ChantierID       string  `json:"chantierId"`
	DateEntree       string  `json:"dateEntree"`
	Quantite         float64 `json:"quantite"`
	PrixUnitaire     float64 `json:"prixUnitaire"`
	Fournisseur      *string `json:"fournisseur,omitempty"`
	NumeroBL         *string `json:"numeroBL,omitempty"`
}

// EntreeCarburantListResponse — réponse GET /api/v1/carburant/entrees
type EntreeCarburantListResponse struct {
	Data []model.EntreeCarburant `json:"data"`
}

// ── SortieCarburant ────────────────────────────────────────────

// CreateSortieCarburantRequest — payload POST /api/v1/carburant/sorties
type CreateSortieCarburantRequest struct {
	StockCarburantID      string  `json:"stockCarburantId"`
	ChantierID            string  `json:"chantierId"`
	EquipementID          *string `json:"equipementId,omitempty"`
	DateSortie            string  `json:"dateSortie"`
	Quantite              float64 `json:"quantite"`
	Operateur             *string `json:"operateur,omitempty"`
	CompteurHeuresAvant   *float64 `json:"compteurHeuresAvant,omitempty"`
	CompteurHeuresApres   *float64 `json:"compteurHeuresApres,omitempty"`
}

// SortieCarburantListResponse — réponse GET /api/v1/carburant/sorties
type SortieCarburantListResponse struct {
	Data []model.SortieCarburant `json:"data"`
}

// ── BonAchatCarburant ──────────────────────────────────────────

// CreateBonAchatCarburantRequest — payload POST /api/v1/carburant/achats
// prixTotal est calculé = quantite * prixUnitaire.
type CreateBonAchatCarburantRequest struct {
	ChantierID            string  `json:"chantierId"`
	DateAchat             string  `json:"dateAchat"`
	TypeCarburant         string  `json:"typeCarburant"`
	Quantite              float64 `json:"quantite"`
	PrixUnitaire          float64 `json:"prixUnitaire"`
	StationService        *string `json:"stationService,omitempty"`
	NumeroRecu            *string `json:"numeroRecu,omitempty"`
	EquipementID          *string `json:"equipementId,omitempty"`
	Operateur             *string `json:"operateur,omitempty"`
	CompteurHeuresAvant   *float64 `json:"compteurHeuresAvant,omitempty"`
	CompteurHeuresApres   *float64 `json:"compteurHeuresApres,omitempty"`
}

// BonAchatCarburantListResponse — réponse GET /api/v1/carburant/achats
type BonAchatCarburantListResponse struct {
	Data []model.BonAchatCarburant `json:"data"`
}

// ── ReleveCompteurEngin ────────────────────────────────────────

// CreateReleveCompteurEnginRequest — payload POST /api/v1/carburant/releves
type CreateReleveCompteurEnginRequest struct {
	EquipementID string  `json:"equipementId"`
	ChantierID   string  `json:"chantierId"`
	DateReleve   string  `json:"dateReleve"`
	HeuresKm     float64 `json:"heuresKm"`
	Observation  *string `json:"observation,omitempty"`
}

// ReleveCompteurEnginListResponse — réponse GET /api/v1/carburant/releves
type ReleveCompteurEnginListResponse struct {
	Data []model.ReleveCompteurEngin `json:"data"`
}

// ── Stats ──────────────────────────────────────────────────────

// CarburantStatsResponse — réponse GET /api/v1/carburant/stats
type CarburantStatsResponse struct {
	TotalStockByType    map[string]float64              `json:"totalStockByType"`
	TotalEntreesMonth   float64                         `json:"totalEntreesMonth"`
	TotalSortiesMonth   float64                         `json:"totalSortiesMonth"`
	TotalAchatsMonth    float64                         `json:"totalAchatsMonth"`
	Alerts              []StockCarburantWithQuantite    `json:"alerts"`
	MonthLabel          string                          `json:"monthLabel"`
}
