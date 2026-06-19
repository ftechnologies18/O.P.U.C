// Package dto — soustraitant_dto.go
// DTOs pour les routes /api/v1/sous-traitants/* (Phase 5, peripheral).
//
// SousTraitant : type (ENTREPRISE/PARTICULIER/FOURNISSEUR), raisonSociale (si ENTREPRISE),
// nom+prenom (si PARTICULIER), rccm, nif, contact, email, adresse, specialite, rib,
// typePieceIdentite, numeroPieceIdentite.
//
// ContratST : contrat d'un sous-traitant sur un chantier. Champs : chantierId,
// objetTravaux, montantHT, dateDebut, dateFin, conditions, statut.
package dto

import (
	"opuc/internal/domain/model"
)

// ── SousTraitant ───────────────────────────────────────────────

// CreateSousTraitantRequest — payload POST /api/v1/sous-traitants
// type ENTREPRISE → raisonSociale requis ; type PARTICULIER → nom+prenom requis.
type CreateSousTraitantRequest struct {
	Type                string  `json:"type"` // ENTREPRISE, PARTICULIER, FOURNISSEUR
	RaisonSociale       *string `json:"raisonSociale,omitempty"`
	Nom                 *string `json:"nom,omitempty"`
	Prenom              *string `json:"prenom,omitempty"`
	RCCM                *string `json:"rccm,omitempty"`
	NIF                 *string `json:"nif,omitempty"`
	TypePieceIdentite   *string `json:"typePieceIdentite,omitempty"`
	NumeroPieceIdentite *string `json:"numeroPieceIdentite,omitempty"`
	Contact             *string `json:"contact,omitempty"`
	Email               *string `json:"email,omitempty"`
	Adresse             *string `json:"adresse,omitempty"`
	Specialite          *string `json:"specialite,omitempty"`
	RIB                 *string `json:"rib,omitempty"`
}

// UpdateSousTraitantRequest — payload PUT /api/v1/sous-traitants/{id}
// Tous les champs optionnels (pointeurs).
type UpdateSousTraitantRequest struct {
	Type                *string `json:"type,omitempty"`
	RaisonSociale       *string `json:"raisonSociale,omitempty"`
	Nom                 *string `json:"nom,omitempty"`
	Prenom              *string `json:"prenom,omitempty"`
	RCCM                *string `json:"rccm,omitempty"`
	NIF                 *string `json:"nif,omitempty"`
	TypePieceIdentite   *string `json:"typePieceIdentite,omitempty"`
	NumeroPieceIdentite *string `json:"numeroPieceIdentite,omitempty"`
	Contact             *string `json:"contact,omitempty"`
	Email               *string `json:"email,omitempty"`
	Adresse             *string `json:"adresse,omitempty"`
	Specialite          *string `json:"specialite,omitempty"`
	RIB                 *string `json:"rib,omitempty"`
}

// SousTraitantListResponse — réponse GET /api/v1/sous-traitants
type SousTraitantListResponse struct {
	Data     []model.SousTraitant `json:"data"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// ── ContratST ──────────────────────────────────────────────────

// CreateContratSTRequest — payload POST /api/v1/sous-traitants/{id}/contrats
type CreateContratSTRequest struct {
	ChantierID   string  `json:"chantierId"`
	ObjetTravaux string  `json:"objetTravaux"`
	MontantHT    float64 `json:"montantHT"`
	DateDebut    *string `json:"dateDebut,omitempty"` // ISO 8601
	DateFin      *string `json:"dateFin,omitempty"`
	Conditions   *string `json:"conditions,omitempty"`
	Statut       *string `json:"statut,omitempty"` // default EN_COURS
}

// UpdateContratSTRequest — payload PUT /api/v1/sous-traitants/{id}/contrats/{contratId}
type UpdateContratSTRequest struct {
	ObjetTravaux *string  `json:"objetTravaux,omitempty"`
	MontantHT    *float64 `json:"montantHT,omitempty"`
	DateDebut    *string  `json:"dateDebut,omitempty"`
	DateFin      *string  `json:"dateFin,omitempty"`
	Conditions   *string  `json:"conditions,omitempty"`
	Statut       *string  `json:"statut,omitempty"`
}

// ContratSTListResponse — réponse GET /api/v1/sous-traitants/{id}/contrats
type ContratSTListResponse struct {
	Data     []model.ContratST `json:"data"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
}
