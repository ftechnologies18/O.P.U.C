// Package model — personnel.go
// Modèles RH pour la gestion du personnel (journaliers + affectations).
//
// Déplacé depuis notification.go (module PHASE-B-PERSONNEL) et étendu pour
// matcher le schéma Prisma (frontend/prisma/schema.prisma) :
//
//   - specialite, photo, typeContrat, tauxJournalier, salaireMensuel,
//     dateDebutContrat, dateFinContrat, statutContrat, numeroCNPS,
//     nbCongesRestants, poste, departement
//
// Le champ `Statut` du modèle original a été renommé en `StatutContrat`
// (aligné sur Prisma : valeurs ACTIF, ESSAI, TERMINE, SUSPENDU).
//
// Tables :
//   - Journalier             (RLS-protected, policy tenant_isolation sur entrepriseId)
//   - JournalierAffectation  (PAS de RLS direct, filtrage via JOIN sur Chantier
//     ou Journalier — les deux sont RLS-protected)
package model

import "time"

// Journalier — ouvrier/employé d'une entreprise BTP.
// Le typeContrat détermine quels champs sont pertinents :
//   - JOURNALIER → tauxJournalier
//   - CDD/CDI    → salaireMensuel + dateDebutContrat + dateFinContrat (CDD seulement)
//   - STAGIAIRE  → salaireMensuel (indemnité) + dateDebutContrat + dateFinContrat
type Journalier struct {
	ID               string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EntrepriseID     *string    `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	Nom              string     `gorm:"type:varchar(255);not null" json:"nom"`
	Prenom           string     `gorm:"type:varchar(255);not null" json:"prenom"`
	Telephone        *string    `gorm:"type:varchar(30)" json:"telephone,omitempty"`
	Specialite       *string    `gorm:"type:varchar(100)" json:"specialite,omitempty"`
	Photo            *string    `gorm:"type:varchar(500)" json:"photo,omitempty"`
	TypeContrat      string     `gorm:"column:typeContrat;type:varchar(20);default:JOURNALIER" json:"typeContrat"`
	TauxJournalier   *float64   `gorm:"column:tauxJournalier" json:"tauxJournalier,omitempty"`
	SalaireMensuel   *float64   `gorm:"column:salaireMensuel" json:"salaireMensuel,omitempty"`
	DateDebutContrat *time.Time `gorm:"column:dateDebutContrat" json:"dateDebutContrat,omitempty"`
	DateFinContrat   *time.Time `gorm:"column:dateFinContrat" json:"dateFinContrat,omitempty"`
	StatutContrat    string     `gorm:"column:statutContrat;type:varchar(20);default:ACTIF" json:"statutContrat"` // ACTIF, ESSAI, TERMINE, SUSPENDU
	NumeroCNPS       *string    `gorm:"column:numeroCNPS;type:varchar(50)" json:"numeroCNPS,omitempty"`
	NbCongesRestants int        `gorm:"column:nbCongesRestants;default:0" json:"nbCongesRestants"`
	Poste            *string    `gorm:"type:varchar(255)" json:"poste,omitempty"`
	Departement      *string    `gorm:"type:varchar(100)" json:"departement,omitempty"`
	CreatedAt        time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt        time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	// ── Relations (lazy) ───────────────────────────────────────────
	Affectations []JournalierAffectation `gorm:"foreignKey:JournalierID" json:"affectations,omitempty"`
}

func (Journalier) TableName() string { return "Journalier" } // Prisma PascalCase

// JournalierAffectation — affectation d'un journalier à un chantier.
// (table sans RLS direct : filtrage tenant via JOIN sur Chantier ou Journalier)
type JournalierAffectation struct {
	ID           string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	JournalierID string     `gorm:"column:journalierId;type:varchar(30);index;not null" json:"journalierId"`
	ChantierID   string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	DateDebut    *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
	DateFin      *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	Actif        bool       `gorm:"default:true" json:"actif"`

	Journalier *Journalier `gorm:"foreignKey:JournalierID" json:"journalier,omitempty"`
	Chantier   *Chantier   `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (JournalierAffectation) TableName() string { return "JournalierAffectation" } // Prisma PascalCase
