// Package dto — facturation_dto.go
// DTOs pour les routes /api/v1/facturation/* (Phase 4, commercial).
//
// Facture : numero (auto), clientId, contratId?, devisId?, typeFacture (FACTURE,
// ACOMPTE, SITUATION, SOLDE), statut (BROUILLON, ENVOYE, PAYEE,
// PARTIELLEMENT_PAYEE, ANNULEE, EN_RETARD), dateEmission, dateEcheance,
// datePaiement, montantHT, tauxTVA, montantTVA (computed), totalTTC (computed),
// montantPaye, modePaiement, notes + paiements []PaiementFacture.
//
// Calculs :
//   - montantTVA = montantHT × tauxTVA/100
//   - totalTTC = montantHT + montantTVA
//   - paiement update : montantPaye += paiement.montant ;
//     si montantPaye >= totalTTC → statut=PAYEE, datePaiement=now ;
//     sinon si montantPaye > 0 → statut=PARTIELLEMENT_PAYEE
package dto

import (
        "opuc/internal/domain/model"
)

// CreateFactureRequest — payload POST /api/v1/facturation
type CreateFactureRequest struct {
        ClientID     string  `json:"clientId"`
        ContratID    *string `json:"contratId,omitempty"`
        DevisID      *string `json:"devisId,omitempty"`
        TypeFacture  *string `json:"typeFacture,omitempty"` // default FACTURE
        MontantHT    float64 `json:"montantHT"`
        TauxTVA      *float64 `json:"tauxTVA,omitempty"` // default 18
        DateEcheance *string `json:"dateEcheance,omitempty"`
        Notes        *string `json:"notes,omitempty"`
}

// UpdateFactureRequest — payload PUT /api/v1/facturation/{id}
type UpdateFactureRequest struct {
        DateEcheance *string `json:"dateEcheance,omitempty"`
        Notes        *string `json:"notes,omitempty"`
        ModePaiement *string `json:"modePaiement,omitempty"`
}

// FactureListResponse — réponse GET /api/v1/facturation
type FactureListResponse struct {
        Data     []model.Facture `json:"data"`
        Total    int64           `json:"total"`
        Page     int             `json:"page"`
        PageSize int             `json:"pageSize"`
}

// (ChangeStatutRequest est défini dans contrat_dto.go et partagé entre les
// domaines commercial — devis/contrat/facturation ont tous le même payload
// `{statut: string}`.)

// ── Paiements ──────────────────────────────────────────────────

// CreatePaiementRequest — payload POST /api/v1/facturation/{id}/paiements
type CreatePaiementRequest struct {
        Montant      float64 `json:"montant"`
        DatePaiement string  `json:"datePaiement"` // ISO 8601
        ModePaiement string  `json:"modePaiement"` // ESPECES, VIREMENT, MOBILE_MONEY, CHEQUE
        Reference    *string `json:"reference,omitempty"`
        Notes        *string `json:"notes,omitempty"`
}

// PaiementListResponse — réponse GET /api/v1/facturation/{id}/paiements
type PaiementListResponse struct {
        Data []model.PaiementFacture `json:"data"`
}

// ── Stats ──────────────────────────────────────────────────────

// FacturationStatsResponse — réponse GET /api/v1/facturation/stats
type FacturationStatsResponse struct {
        Total         int64            `json:"total"`
        ByStatut      map[string]int64 `json:"byStatut"`
        TotalTTC      float64          `json:"totalTTC"`
        TotalPaye     float64          `json:"totalPaye"`
        TotalImpaye   float64          `json:"totalImpaye"` // totalTTC - totalPaye
        EnRetardCount int64            `json:"enRetardCount"`
}
