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

// Journalier — ouvrier journalier d'une entreprise.
type Journalier struct {
	ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EntrepriseID *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	Nom          string    `gorm:"type:varchar(255);not null" json:"nom"`
	Prenom       *string   `gorm:"type:varchar(255)" json:"prenom,omitempty"`
	Telephone    *string   `gorm:"type:varchar(30)" json:"telephone,omitempty"`
	Statut       string    `gorm:"type:varchar(20);default:ACTIF" json:"statut"` // ACTIF, INACTIF
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Journalier) TableName() string { return "Journalier" } // Prisma PascalCase

// JournalierAffectation — affectation d'un journalier à un chantier.
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

// Pointage — pointage journalier d'un journalier sur un chantier.
type Pointage struct {
	ID            string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	JournalierID  string    `gorm:"column:journalierId;type:varchar(30);index;not null" json:"journalierId"`
	ChantierID    string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	ChefChantierID *string  `gorm:"column:chefChantierId;type:varchar(30)" json:"chefChantierId,omitempty"`
	DateTravail   time.Time `gorm:"column:dateTravail;not null" json:"dateTravail"`
	TauxJournalier float64  `gorm:"column:tauxJournalier;default:0" json:"tauxJournalier"`
	Present       bool      `gorm:"default:false" json:"present"`
	Observation   *string   `gorm:"type:text" json:"observation,omitempty"`
	Valide        bool      `gorm:"default:false" json:"valide"`
	CreatedAt     time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Pointage) TableName() string { return "Pointage" } // Prisma PascalCase

// StockMateriel — stock de matériel sur un chantier.
type StockMateriel struct {
	ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Reference    *string   `gorm:"type:varchar(100)" json:"reference,omitempty"`
	Designation  string    `gorm:"type:varchar(255);not null" json:"designation"`
	Categorie    *string   `gorm:"type:varchar(100)" json:"categorie,omitempty"`
	Unite        *string   `gorm:"type:varchar(20)" json:"unite,omitempty"`
	SeuilAlerte  float64   `gorm:"column:seuilAlerte;default:0" json:"seuilAlerte"`
	ChantierID   *string   `gorm:"column:chantierId;type:varchar(30);index" json:"chantierId,omitempty"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier *Chantier `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (StockMateriel) TableName() string { return "StockMateriel" } // Prisma PascalCase
