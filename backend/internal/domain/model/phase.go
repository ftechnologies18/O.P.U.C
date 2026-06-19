package model

import "time"

// Phase — subdivision d'un chantier (lots/tranches)
// Colonnes Prisma camelCase.
type Phase struct {
	ID          string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	ChantierID  string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	Nom         string     `gorm:"type:varchar(255);not null" json:"nom"`
	Description *string    `gorm:"type:text" json:"description,omitempty"`
	Avancement  float64    `gorm:"default:0" json:"avancement"`
	Ordre       int        `gorm:"default:0" json:"ordre"`
	DateDebut   *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
	DateFin     *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	CreatedAt   time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier *Chantier `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
	Taches   []Tache   `gorm:"foreignKey:PhaseID" json:"taches,omitempty"`
}

func (Phase) TableName() string { return "Phase" } // Prisma PascalCase

// Tache — tâche d'une phase (avec statut, gantt-like)
type Tache struct {
	ID               string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	PhaseID          string     `gorm:"column:phaseId;type:varchar(30);index;not null" json:"phaseId"`
	Nom              string     `gorm:"type:varchar(255);not null" json:"nom"`
	Description      *string    `gorm:"type:text" json:"description,omitempty"`
	Ordre            int        `gorm:"default:0" json:"ordre"`
	Avancement       float64    `gorm:"default:0" json:"avancement"`
	Statut           string     `gorm:"type:varchar(30);default:EN_ATTENTE" json:"statut"` // EN_ATTENTE, EN_COURS, TERMINE, EN_RETARD
	DateDebut        *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
	DateFin          *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	ResponsableID    *string    `gorm:"column:responsableId;type:varchar(30)" json:"responsableId,omitempty"`
	TachePrecedenteID *string   `gorm:"column:tachePrecedenteId;type:varchar(30)" json:"tachePrecedenteId,omitempty"`
	CreatedAt        time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt        time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Tache) TableName() string { return "Tache" } // Prisma PascalCase
