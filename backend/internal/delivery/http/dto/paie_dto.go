// Package dto — paie_dto.go
// DTOs pour les routes /api/v1/paie/* (Phase 3, write métier).
//
// Deux sous-domaines : PaiementHebdo (paiement hebdomadaire calculé depuis les
// pointages validés) et SalaireMensuel (paie mensuelle avec retenues).
package dto

import (
	"opuc/internal/domain/model"
)

// ── PaiementHebdo ──────────────────────────────────────────────

// GeneratePaiementHebdoRequest — payload POST /api/v1/paie/paiements-hebdo/generate
// semaineDebut : ISO 8601 (YYYY-MM-DD). semaineFin est calculée = semaineDebut + 6 jours.
type GeneratePaiementHebdoRequest struct {
	ChantierID   string `json:"chantierId"`
	SemaineDebut string `json:"semaineDebut"`
}

// UpdatePaiementHebdoRequest — payload PUT /api/v1/paie/paiements-hebdo/{id}
// Tous les champs optionnels (pointeurs). valideParId est forcé = auth.UserID côté usecase.
type UpdatePaiementHebdoRequest struct {
	MontantVerse *float64 `json:"montantVerse,omitempty"`
	ModePaiement *string  `json:"modePaiement,omitempty"`
	Statut       *string  `json:"statut,omitempty"`
	DatePaiement *string  `json:"datePaiement,omitempty"` // ISO 8601 string → parsée en *time.Time
}

// PaiementHebdoListResponse — réponse GET /api/v1/paie/paiements-hebdo
type PaiementHebdoListResponse struct {
	Data     []model.PaiementHebdo `json:"data"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

// GeneratePaiementHebdoResponse — réponse POST /api/v1/paie/paiements-hebdo/generate
type GeneratePaiementHebdoResponse struct {
	ChantierID   string                `json:"chantierId"`
	SemaineDebut string                `json:"semaineDebut"`
	SemaineFin   string                `json:"semaineFin"`
	Generated    []model.PaiementHebdo `json:"generated"`
	Count        int                   `json:"count"`
}

// ── SalaireMensuel ─────────────────────────────────────────────

// GenerateSalaireMensuelRequest — payload POST /api/v1/paie/salaires/generate
// montantHeuresSupp et retenueAbsences sont calculés côté usecase :
//   - montantHeuresSupp = (salaireBase / 173.33) * heuresSupp * 1.25
//     (173.33 = heures mensuelles légales, 1.25 = majoration heures supp)
//   - retenueAbsences  = (salaireBase / 30) * absences
//     (30 = jours par mois, prorata journalier)
type GenerateSalaireMensuelRequest struct {
	JournalierID  string  `json:"journalierId"`
	Mois          int     `json:"mois"`     // 1-12
	Annee         int     `json:"annee"`    // ex: 2025
	SalaireBase   float64 `json:"salaireBase"`
	Primes        float64 `json:"primes"`
	HeuresSupp    float64 `json:"heuresSupp"`
	RetenuesCNPS  float64 `json:"retenuesCNPS"`
	RetenuesIR    float64 `json:"retenuesIR"`
	Avances       float64 `json:"avances"`
	Absences      int     `json:"absences"`
}

// UpdateSalaireMensuelRequest — payload PUT /api/v1/paie/salaires/{id}
type UpdateSalaireMensuelRequest struct {
	Statut       *string `json:"statut,omitempty"`
	DatePaiement *string `json:"datePaiement,omitempty"`
	ModePaiement *string `json:"modePaiement,omitempty"`
}

// SalaireMensuelListResponse — réponse GET /api/v1/paie/salaires
type SalaireMensuelListResponse struct {
	Data     []model.SalaireMensuel `json:"data"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
}
