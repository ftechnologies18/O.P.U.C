// Package dto — devis_dto.go
// DTOs pour les routes /api/v1/devis/* (Phase 4, commercial).
//
// Devis : numero (auto-genéré), clientId, statut, dateEmission, dateValidite,
// conditions, remiseGlobale (%), tauxTVA, totalHT, montantTVA, totalTTC, notes,
// lignes []LigneDevis.
//
// Calculs :
//   - ligne.totalHT = ligne.quantite × ligne.prixUnitaire
//   - totalHT = sum(ligne.totalHT)
//   - totalHTRemise = totalHT × (1 - remiseGlobale/100)
//   - montantTVA = totalHTRemise × tauxTVA/100
//   - totalTTC = totalHTRemise + montantTVA
package dto

import (
        "opuc/internal/domain/model"
)

// LigneDevisInput — input pour créer/modifier une ligne de devis.
type LigneDevisInput struct {
        Designation  string  `json:"designation"`
        Description  *string `json:"description,omitempty"`
        Quantite     float64 `json:"quantite"`
        Unite        string  `json:"unite"`
        PrixUnitaire float64 `json:"prixUnitaire"`
        Ordre        int     `json:"ordre,omitempty"`
}

// CreateDevisRequest — payload POST /api/v1/devis
type CreateDevisRequest struct {
        ClientID     string           `json:"clientId"`
        DateValidite *string          `json:"dateValidite,omitempty"` // ISO 8601
        Conditions   *string          `json:"conditions,omitempty"`
        RemiseGlobale *float64        `json:"remiseGlobale,omitempty"`
        TauxTVA      *float64         `json:"tauxTVA,omitempty"`
        Notes        *string          `json:"notes,omitempty"`
        Lignes       []LigneDevisInput `json:"lignes"`
}

// UpdateDevisRequest — payload PUT /api/v1/devis/{id}
type UpdateDevisRequest struct {
        DateValidite  *string  `json:"dateValidite,omitempty"`
        Conditions    *string  `json:"conditions,omitempty"`
        RemiseGlobale *float64 `json:"remiseGlobale,omitempty"`
        TauxTVA       *float64 `json:"tauxTVA,omitempty"`
        Notes         *string  `json:"notes,omitempty"`
        Statut        *string  `json:"statut,omitempty"`
}

// DevisListResponse — réponse GET /api/v1/devis
type DevisListResponse struct {
        Data     []model.Devis `json:"data"`
        Total    int64         `json:"total"`
        Page     int           `json:"page"`
        PageSize int           `json:"pageSize"`
}

// ── Lignes ─────────────────────────────────────────────────────

// CreateLigneDevisRequest — payload POST /api/v1/devis/{id}/lignes
type CreateLigneDevisRequest struct {
        Designation  string  `json:"designation"`
        Description  *string `json:"description,omitempty"`
        Quantite     float64 `json:"quantite"`
        Unite        string  `json:"unite"`
        PrixUnitaire float64 `json:"prixUnitaire"`
        Ordre        int     `json:"ordre,omitempty"`
}

// UpdateLigneDevisRequest — payload PUT /api/v1/devis/{id}/lignes/{ligneId}
type UpdateLigneDevisRequest struct {
        Designation  *string  `json:"designation,omitempty"`
        Description  *string  `json:"description,omitempty"`
        Quantite     *float64 `json:"quantite,omitempty"`
        Unite        *string  `json:"unite,omitempty"`
        PrixUnitaire *float64 `json:"prixUnitaire,omitempty"`
        Ordre        *int     `json:"ordre,omitempty"`
}

// ── Statut ─────────────────────────────────────────────────────

// (ChangeStatutRequest est défini dans contrat_dto.go et partagé entre les
// domaines commercial — devis/contrat/facturation ont tous le même payload
// `{statut: string}`.)
