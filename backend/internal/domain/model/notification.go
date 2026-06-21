package model

import "time"

// Notification — notification utilisateur (in-app, non lues/lues).
// Pas de relation entreprise (user-scoped), mais on garde RLS via userId.
type Notification struct {
	ID        string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	UserID    string    `gorm:"column:userId;type:varchar(30);index;not null" json:"userId"`
	Titre     string    `gorm:"type:varchar(255)" json:"titre"`
	Message   string    `gorm:"type:text" json:"message"`
	Type      string    `gorm:"type:varchar(50)" json:"type"` // info, success, warning, error
	Lu        bool      `gorm:"default:false" json:"lu"`
	Lien      *string   `gorm:"type:varchar(500)" json:"lien,omitempty"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (Notification) TableName() string { return "Notification" } // Prisma PascalCase

// NOTE: Les modèles Journalier + JournalierAffectation ont été déplacés vers
// personnel.go (module PHASE-B-PERSONNEL) afin de regrouper toutes les entités
// RH/journaliers au même endroit. Le modèle Journalier a été étendu pour
// matcher le schéma Prisma (specialite, typeContrat, tauxJournalier,
// salaireMensuel, dateDebutContrat, dateFinContrat, statutContrat,
// numeroCNPS, nbCongesRestants, poste, departement).

// Pointage — pointage journalier d'un journalier sur un chantier.
type Pointage struct {
	ID             string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	JournalierID   string    `gorm:"column:journalierId;type:varchar(30);index;not null" json:"journalierId"`
	ChantierID     string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	ChefChantierID *string   `gorm:"column:chefChantierId;type:varchar(30)" json:"chefChantierId,omitempty"`
	DateTravail    time.Time `gorm:"column:dateTravail;not null" json:"dateTravail"`
	TauxJournalier float64   `gorm:"column:tauxJournalier;default:0" json:"tauxJournalier"`
	Present        bool      `gorm:"default:false" json:"present"`
	Observation    *string   `gorm:"type:text" json:"observation,omitempty"`
	Valide         bool      `gorm:"default:false" json:"valide"`
	CreatedAt      time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt      time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Pointage) TableName() string { return "Pointage" } // Prisma PascalCase

// StockMateriel — stock de matériel sur un chantier.
type StockMateriel struct {
	ID          string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Reference   *string   `gorm:"type:varchar(100)" json:"reference,omitempty"`
	Designation string    `gorm:"type:varchar(255);not null" json:"designation"`
	Categorie   *string   `gorm:"type:varchar(100)" json:"categorie,omitempty"`
	Unite       *string   `gorm:"type:varchar(20)" json:"unite,omitempty"`
	SeuilAlerte float64   `gorm:"column:seuilAlerte;default:0" json:"seuilAlerte"`
	ChantierID  *string   `gorm:"column:chantierId;type:varchar(30);index" json:"chantierId,omitempty"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier *Chantier `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (StockMateriel) TableName() string { return "StockMateriel" } // Prisma PascalCase
