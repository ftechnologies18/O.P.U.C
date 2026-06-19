// Package model contient les entités GORM (structs + tags JSON).
// RÈGLE CRITIQUE : les noms de colonnes GORM correspondent EXACTEMENT aux
// colonnes Prisma existantes (camelCase). Ne PAS utiliser snake_case.
package model

import "time"

// Entreprise — tenant racine (multi-tenant SaaS BTP)
type Entreprise struct {
	ID        string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Nom       string    `gorm:"type:varchar(255);not null" json:"nom"`
	Adresse   *string   `gorm:"type:varchar(500)" json:"adresse,omitempty"`
	Telephone *string   `gorm:"type:varchar(30)" json:"telephone,omitempty"`
	Email     *string   `gorm:"type:varchar(255)" json:"email,omitempty"`
	Status    string    `gorm:"type:varchar(20);default:active" json:"status"`
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// Relations (lazy par défaut, preload explicite côté usecase)
	Users []User `gorm:"foreignKey:EntrepriseID" json:"users,omitempty"`
}

func (Entreprise) TableName() string { return "Entreprise" } // Prisma PascalCase
