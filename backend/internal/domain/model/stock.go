package model

import "time"

// EntreeStock — entrée de matériel en stock (bon de livraison).
type EntreeStock struct {
	ID           string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	StockID      string     `gorm:"column:stockId;type:varchar(30);index;not null" json:"stockId"`
	ChantierID   string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	Quantite     float64    `gorm:"not null" json:"quantite"`
	PrixUnitaire float64    `gorm:"column:prixUnitaire;not null" json:"prixUnitaire"`
	Fournisseur  *string    `gorm:"type:varchar(255)" json:"fournisseur,omitempty"`
	NumeroBL     *string    `gorm:"column:numeroBL;type:varchar(100)" json:"numeroBL,omitempty"`
	DateEntree   time.Time  `gorm:"column:dateEntree;not null" json:"dateEntree"`
	PhotoBLUrl   *string    `gorm:"column:photoBLUrl;type:varchar(500)" json:"photoBLUrl,omitempty"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Stock    *StockMateriel `gorm:"foreignKey:StockID" json:"stock,omitempty"`
	Chantier *Chantier      `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (EntreeStock) TableName() string { return "EntreeStock" }

// SortieStock — sortie de matériel du stock (consommation sur tâche).
type SortieStock struct {
	ID         string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	StockID    string     `gorm:"column:stockId;type:varchar(30);index;not null" json:"stockId"`
	ChantierID string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	Quantite   float64    `gorm:"not null" json:"quantite"`
	TacheID    *string    `gorm:"column:tacheId;type:varchar(30)" json:"tacheId,omitempty"`
	Operateur  *string    `gorm:"type:varchar(255)" json:"operateur,omitempty"`
	Motif      *string    `gorm:"type:text" json:"motif,omitempty"`
	DateSortie time.Time  `gorm:"column:dateSortie;not null" json:"dateSortie"`
	CreatedAt  time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt  time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Stock    *StockMateriel `gorm:"foreignKey:StockID" json:"stock,omitempty"`
	Chantier *Chantier      `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (SortieStock) TableName() string { return "SortieStock" }
