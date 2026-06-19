package model

import "time"

// TicketSupport — ticket de support client (technique, facturation, planning, autre).
type TicketSupport struct {
	ID           string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Titre        string     `gorm:"type:varchar(255);not null" json:"titre"`
	Description  string     `gorm:"type:text;not null" json:"description"`
	Priorite     string     `gorm:"type:varchar(30);default:MOYENNE" json:"priorite"` // BASSE, MOYENNE, HAUTE, URGENTE
	Statut       string     `gorm:"type:varchar(30);default:OUVERT" json:"statut"`    // OUVERT, EN_COURS, RESOLU, FERME
	ClientID     *string    `gorm:"column:clientId;type:varchar(30);index" json:"clientId,omitempty"`
	Categorie    *string    `gorm:"type:varchar(50)" json:"categorie,omitempty"` // TECHNIQUE, FACTURATION, PLANNING, AUTRE
	AssigneeAID  *string    `gorm:"column:assigneAId;type:varchar(30)" json:"assigneAId,omitempty"`
	EntrepriseID *string    `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	ResoluLe     *time.Time `gorm:"column:resoluLe" json:"resoluLe,omitempty"`
	ResoluParID  *string    `gorm:"column:resoluParId;type:varchar(30)" json:"resoluParId,omitempty"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Messages []TicketMessage `gorm:"foreignKey:TicketID" json:"messages,omitempty"`
}

func (TicketSupport) TableName() string { return "TicketSupport" }

// TicketMessage — message d'un ticket de support (conversation).
type TicketMessage struct {
	ID          string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	TicketID    string    `gorm:"column:ticketId;type:varchar(30);index;not null" json:"ticketId"`
	AuteurID    *string   `gorm:"column:auteurId;type:varchar(30)" json:"auteurId,omitempty"`
	Contenu     string    `gorm:"type:text;not null" json:"contenu"`
	PieceJointe *string   `gorm:"column:pieceJointe;type:varchar(500)" json:"pieceJointe,omitempty"`
	CreatedAt   time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (TicketMessage) TableName() string { return "TicketMessage" }
