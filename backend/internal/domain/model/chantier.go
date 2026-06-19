package model

import "time"

// Chantier — projet de construction BTP (multi-tenant via EntrepriseID)
// Colonnes = camelCase exact de Prisma (ne pas snake_case).
type Chantier struct {
        ID                 string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
        Nom                string     `gorm:"type:varchar(255);not null" json:"nom"`
        Adresse            *string    `gorm:"type:varchar(500)" json:"adresse,omitempty"`
        MaitreOuvrage      *string    `gorm:"column:maitreOuvrage;type:varchar(255)" json:"maitreOuvrage,omitempty"`
        DateDebut          *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
        DateFinPrevue      *time.Time `gorm:"column:dateFinPrevue" json:"dateFinPrevue,omitempty"`
        BudgetPrevisionnel float64    `gorm:"column:budgetPrevisionnel;default:0" json:"budgetPrevisionnel"`
        Statut             string     `gorm:"type:varchar(30);default:EN_PREPARATION" json:"statut"`
        Description        *string    `gorm:"type:text" json:"description,omitempty"`
        ModeCarburant      string     `gorm:"column:modeCarburant;type:varchar(30);default:STOCK_PHYSIQUE" json:"modeCarburant"`

        // ── Multi-tenant (RLS enforced) ─────────────────────────────
        EntrepriseID *string `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`

        // ── Client (optionnel) ──────────────────────────────────────
        ClientID *string `gorm:"column:clientId;type:varchar(30);index" json:"clientId,omitempty"`

        // ── Relations (lazy) ────────────────────────────────────────
        Entreprise *Entreprise `gorm:"foreignKey:EntrepriseID" json:"entreprise,omitempty"`
        Client     *Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
        Phases     []Phase     `gorm:"foreignKey:ChantierID" json:"phases,omitempty"`

        // ── Audit ───────────────────────────────────────────────────
        CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
        UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Chantier) TableName() string { return "Chantier" } // Prisma PascalCase

// IsEditable retourne true si le chantier peut encore être modifié.
func (c *Chantier) IsEditable() bool {
        return c.Statut != "TERMINE" && c.Statut != "RECEPTIONNE"
}

// NOTE: Le modèle Client a été déplacé vers commercial.go (Phase 4)
// car il contient plus de champs (raisonSociale, nomContact, rccm, nif, type, statut, notes)
