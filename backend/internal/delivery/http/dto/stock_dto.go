// Package dto — stock_dto.go
// DTOs pour les routes /api/v1/stocks/* (Phase 3, write métier).
//
// Stock de matériel : StockMateriel + EntreeStock + SortieStock.
// Le champ quantiteDisponible est calculé = sum(EntreeStock.quantite) - sum(SortieStock.quantite).
package dto

import (
	"opuc/internal/domain/model"
)

// ── StockMateriel ──────────────────────────────────────────────

// CreateStockRequest — payload POST /api/v1/stocks
type CreateStockRequest struct {
	Reference   *string `json:"reference,omitempty"`
	Designation string  `json:"designation"`
	Categorie   *string `json:"categorie,omitempty"`
	Unite       *string `json:"unite,omitempty"`
	SeuilAlerte float64 `json:"seuilAlerte"`
	ChantierID  *string `json:"chantierId,omitempty"`
}

// UpdateStockRequest — payload PUT /api/v1/stocks/{id}
// Tous les champs optionnels (pointeurs).
type UpdateStockRequest struct {
	Designation *string  `json:"designation,omitempty"`
	Categorie   *string  `json:"categorie,omitempty"`
	Unite       *string  `json:"unite,omitempty"`
	SeuilAlerte *float64 `json:"seuilAlerte,omitempty"`
}

// StockWithQuantite — stock + quantiteDisponible calculée.
// Embeds model.StockMateriel (les champs JSON sont flattés par Go).
type StockWithQuantite struct {
	model.StockMateriel
	QuantiteDisponible float64 `json:"quantiteDisponible"`
}

// StockListResponse — réponse GET /api/v1/stocks
type StockListResponse struct {
	Data     []StockWithQuantite `json:"data"`
	Total    int64               `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// StockDetailResponse — réponse GET /api/v1/stocks/{id}
type StockDetailResponse struct {
	model.StockMateriel
	QuantiteDisponible float64             `json:"quantiteDisponible"`
	Entrees            []model.EntreeStock `json:"entrees"`
	Sorties            []model.SortieStock `json:"sorties"`
}

// ── EntreeStock ────────────────────────────────────────────────

// CreateEntreeStockRequest — payload POST /api/v1/stocks/entrees
type CreateEntreeStockRequest struct {
	StockID      string  `json:"stockId"`
	ChantierID   string  `json:"chantierId"`
	Quantite     float64 `json:"quantite"`
	PrixUnitaire float64 `json:"prixUnitaire"`
	Fournisseur  *string `json:"fournisseur,omitempty"`
	NumeroBL     *string `json:"numeroBL,omitempty"`
	DateEntree   string  `json:"dateEntree"` // ISO 8601
}

// EntreeStockListResponse — réponse GET /api/v1/stocks/entrees
type EntreeStockListResponse struct {
	Data     []model.EntreeStock `json:"data"`
	Total    int64               `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// ── SortieStock ────────────────────────────────────────────────

// CreateSortieStockRequest — payload POST /api/v1/stocks/sorties
type CreateSortieStockRequest struct {
	StockID    string  `json:"stockId"`
	ChantierID string  `json:"chantierId"`
	Quantite   float64 `json:"quantite"`
	TacheID    *string `json:"tacheId,omitempty"`
	Operateur  *string `json:"operateur,omitempty"`
	Motif      *string `json:"motif,omitempty"`
	DateSortie string  `json:"dateSortie"` // ISO 8601
}

// SortieStockListResponse — réponse GET /api/v1/stocks/sorties
type SortieStockListResponse struct {
	Data     []model.SortieStock `json:"data"`
	Total    int64               `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}
