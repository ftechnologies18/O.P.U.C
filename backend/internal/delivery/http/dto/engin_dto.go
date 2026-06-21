// Package dto — engin_dto.go
// DTOs pour les routes /api/v1/engins + /api/v1/locations (Phase B-ENGINS).
//
// Format wire (JSON) aligné sur le frontend Next.js :
//
//   GET /api/v1/engins :
//     {
//       "engins": [
//         {
//           "id": "...",
//           "designation": "...",
//           "typeEquipement": "..." | null,
//           "marque": "..." | null,
//           "modele": "..." | null,
//           "immatriculation": "..." | null,
//           "etat": "BON" | "EN_REPARATION" | "HORS_SERVICE",
//           "typeLocation": "PROPRE" | "LOCATION" | null,
//           "createdAt": "RFC3339",
//           "_count": { "locations": N }
//         }
//       ],
//       "kpi": { "totalEngins": N, "enginsPropres": N, "enginsLoues": N }
//     }
//
//   GET /api/v1/locations :
//     {
//       "locations": [
//         {
//           "id": "...",
//           "equipementId": "...",
//           "fournisseurId": "..." | null,
//           "fournisseurNom": "..." | null,
//           "fournisseurTel": "..." | null,
//           "numeroContrat": "..." | null,
//           "chantierId": "..." | null,
//           "coutJournalier": N,
//           "coutTransport": N,
//           "coutOperateur": N,
//           "caution": N,
//           "dateDebut": "RFC3339",
//           "dateFin": "RFC3339" | null,
//           "statut": "EN_COURS" | "TERMINE" | "ANNULE",
//           "conditions": "..." | null,
//           "createdAt": "RFC3339",
//           "equipement": { "id": "...", "designation": "...", "typeEquipement": "..." | null },
//           "fournisseur": { "id": "...", "raisonSociale": "...", "nom": "...", "prenom": "...", "contact": "..." } | null,
//           "chantier": { "id": "...", "nom": "...", "statut": "..." } | null
//         }
//       ],
//       "kpi": { "locationsEnCours": N, "coutTotalEnCours": N, "coutJournalierMoyen": N, "locationsCeMois": N }
//     }
package dto

import (
	"time"

	"opuc/internal/domain/model"
)

// ── Engin (Equipement) ────────────────────────────────────────────

// EnginCountMeta — sous-objet _count pour matcher le format Next.js.
type EnginCountMeta struct {
	Locations int64 `json:"locations"`
}

// EnginWithCount — Equipement + _count { locations }.
// Embeds model.Equipement (les champs JSON sont flattés par Go).
type EnginWithCount struct {
	model.Equipement
	Count EnginCountMeta `json:"_count"`
}

// EnginKPIResponse — KPIs agrégés sur le parc engins.
type EnginKPIResponse struct {
	TotalEngins   int64 `json:"totalEngins"`
	EnginsPropres int64 `json:"enginsPropres"`
	EnginsLoues   int64 `json:"enginsLoues"`
}

// EnginListResponse — réponse GET /api/v1/engins.
type EnginListResponse struct {
	Engins []EnginWithCount `json:"engins"`
	KPI    EnginKPIResponse `json:"kpi"`
}

// ── Location (LocationEngin) ─────────────────────────────────────

// LocationEquipement — vue réduite de l'équipement dans la location
// (le frontend n'a besoin que de id, designation, typeEquipement).
type LocationEquipement struct {
	ID             string  `json:"id"`
	Designation    string  `json:"designation"`
	TypeEquipement *string `json:"typeEquipement"`
}

// LocationFournisseur — vue réduite du fournisseur (SousTraitant).
type LocationFournisseur struct {
	ID            string  `json:"id"`
	RaisonSociale *string `json:"raisonSociale"`
	Nom           *string `json:"nom"`
	Prenom        *string `json:"prenom"`
	Contact       *string `json:"contact"`
}

// LocationChantier — vue réduite du chantier.
type LocationChantier struct {
	ID     string `json:"id"`
	Nom    string `json:"nom"`
	Statut string `json:"statut"`
}

// LocationItem — DTO complet pour une location (avec relations flattées).
type LocationItem struct {
	ID             string     `json:"id"`
	EquipementID   string     `json:"equipementId"`
	FournisseurID  *string    `json:"fournisseurId"`
	FournisseurNom *string    `json:"fournisseurNom"`
	FournisseurTel *string    `json:"fournisseurTel"`
	NumeroContrat  *string    `json:"numeroContrat"`
	ChantierID     *string    `json:"chantierId"`
	CoutJournalier float64    `json:"coutJournalier"`
	CoutTransport  float64    `json:"coutTransport"`
	CoutOperateur  float64    `json:"coutOperateur"`
	Caution        float64    `json:"caution"`
	DateDebut      time.Time  `json:"dateDebut"`
	DateFin        *time.Time `json:"dateFin"`
	Statut         string     `json:"statut"`
	Conditions     *string    `json:"conditions"`
	CreatedAt      time.Time  `json:"createdAt"`
	Equipement     LocationEquipement  `json:"equipement"`
	Fournisseur    *LocationFournisseur `json:"fournisseur"`
	Chantier       *LocationChantier    `json:"chantier"`
}

// LocationKPIResponse — KPIs agrégés sur les locations.
type LocationKPIResponse struct {
	LocationsEnCours    int64   `json:"locationsEnCours"`
	CoutTotalEnCours    float64 `json:"coutTotalEnCours"`
	CoutJournalierMoyen float64 `json:"coutJournalierMoyen"`
	LocationsCeMois     int64   `json:"locationsCeMois"`
}

// LocationListResponse — réponse GET /api/v1/locations.
type LocationListResponse struct {
	Locations []LocationItem      `json:"locations"`
	KPI       LocationKPIResponse `json:"kpi"`
}

// ToLocationItem convertit un model.LocationEngin (avec relations préloadées)
// en LocationItem DTO.
func ToLocationItem(l *model.LocationEngin) LocationItem {
	out := LocationItem{
		ID:             l.ID,
		EquipementID:   l.EquipementID,
		FournisseurID:  l.FournisseurID,
		FournisseurNom: l.FournisseurNom,
		FournisseurTel: l.FournisseurTel,
		NumeroContrat:  l.NumeroContrat,
		ChantierID:     l.ChantierID,
		CoutJournalier: l.CoutJournalier,
		CoutTransport:  l.CoutTransport,
		CoutOperateur:  l.CoutOperateur,
		Caution:        l.Caution,
		DateDebut:      l.DateDebut,
		DateFin:        l.DateFin,
		Statut:         l.Statut,
		Conditions:     l.Conditions,
		CreatedAt:      l.CreatedAt,
	}
	if l.Equipement != nil {
		out.Equipement = LocationEquipement{
			ID:             l.Equipement.ID,
			Designation:    l.Equipement.Designation,
			TypeEquipement: l.Equipement.TypeEquipement,
		}
	}
	if l.Fournisseur != nil {
		out.Fournisseur = &LocationFournisseur{
			ID:            l.Fournisseur.ID,
			RaisonSociale: l.Fournisseur.RaisonSociale,
			Nom:           l.Fournisseur.Nom,
			Prenom:        l.Fournisseur.Prenom,
			Contact:       l.Fournisseur.Contact,
		}
	}
	if l.Chantier != nil {
		out.Chantier = &LocationChantier{
			ID:     l.Chantier.ID,
			Nom:    l.Chantier.Nom,
			Statut: l.Chantier.Statut,
		}
	}
	return out
}
