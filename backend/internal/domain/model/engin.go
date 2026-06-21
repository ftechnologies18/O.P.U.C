// Package model — engin.go
// Modèle LocationEngin — contrat de location d'un engin (parc engins loués).
//
// Une location associe un Equipement à un fournisseur (SousTraitant de type
// FOURNISSEUR) ou à un fournisseur "libre" (fournisseurNom + fournisseurTel),
// avec un coût journalier, une date de début/fin, un statut (EN_COURS, TERMINE,
// ANNULE), et optionnellement un chantier qui utilise l'engin.
//
// Colonnes = camelCase exact de Prisma (cf. frontend/prisma/schema.prisma).
//
// Tables liées :
//   - Equipement   (RLS direct via entrepriseId)
//   - SousTraitant (RLS direct via entrepriseId) — pour fournisseurId
//   - Chantier     (RLS direct via entrepriseId) — pour chantierId
//
// LocationEngin elle-même n'a pas de RLS direct : filtrage tenant via JOIN
// sur "Equipement" (qui est RLS-protected). On vérifie aussi l'existence de
// l'equipement côté usecase pour renvoyer un 404/400 clair.
package model

import "time"

// LocationEngin — contrat de location d'un équipement (parc loué).
type LocationEngin struct {
	ID             string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EquipementID   string     `gorm:"column:equipementId;type:varchar(30);index;not null" json:"equipementId"`
	FournisseurID  *string    `gorm:"column:fournisseurId;type:varchar(30);index" json:"fournisseurId,omitempty"`
	FournisseurNom *string    `gorm:"column:fournisseurNom;type:varchar(255)" json:"fournisseurNom,omitempty"`
	FournisseurTel *string    `gorm:"column:fournisseurTel;type:varchar(100)" json:"fournisseurTel,omitempty"`
	NumeroContrat  *string    `gorm:"column:numeroContrat;type:varchar(100)" json:"numeroContrat,omitempty"`
	ChantierID     *string    `gorm:"column:chantierId;type:varchar(30);index" json:"chantierId,omitempty"`
	CoutJournalier float64    `gorm:"column:coutJournalier;not null" json:"coutJournalier"`
	CoutTransport  float64    `gorm:"column:coutTransport;default:0" json:"coutTransport"`
	CoutOperateur  float64    `gorm:"column:coutOperateur;default:0" json:"coutOperateur"`
	Caution        float64    `gorm:"column:caution;default:0" json:"caution"`
	DateDebut      time.Time  `gorm:"column:dateDebut;not null" json:"dateDebut"`
	DateFin        *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	Statut         string     `gorm:"type:varchar(30);default:EN_COURS" json:"statut"` // EN_COURS, TERMINE, ANNULE
	Conditions     *string    `gorm:"type:text" json:"conditions,omitempty"`
	CreatedAt      time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Equipement  *Equipement   `gorm:"foreignKey:EquipementID" json:"equipement,omitempty"`
	Fournisseur *SousTraitant `gorm:"foreignKey:FournisseurID" json:"fournisseur,omitempty"`
	Chantier    *Chantier     `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (LocationEngin) TableName() string { return "LocationEngin" }
