package model

import "time"

// SousTraitant — sous-traitant ou fournisseur (entreprise ou particulier).
type SousTraitant struct {
	ID                  string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Type                string    `gorm:"type:varchar(30);default:ENTREPRISE" json:"type"` // ENTREPRISE, PARTICULIER, FOURNISSEUR
	RaisonSociale       *string   `gorm:"column:raisonSociale;type:varchar(255)" json:"raisonSociale,omitempty"`
	Nom                 *string   `gorm:"type:varchar(255)" json:"nom,omitempty"`            // Pour particuliers
	Prenom              *string   `gorm:"type:varchar(255)" json:"prenom,omitempty"`
	RCCM                *string   `gorm:"column:rccm;type:varchar(100)" json:"rccm,omitempty"`
	NIF                 *string   `gorm:"column:nif;type:varchar(50)" json:"nif,omitempty"`
	TypePieceIdentite   *string   `gorm:"column:typePieceIdentite;type:varchar(50)" json:"typePieceIdentite,omitempty"`
	NumeroPieceIdentite *string   `gorm:"column:numeroPieceIdentite;type:varchar(100)" json:"numeroPieceIdentite,omitempty"`
	Contact             *string   `gorm:"type:varchar(100)" json:"contact,omitempty"`
	Email               *string   `gorm:"type:varchar(255)" json:"email,omitempty"`
	Adresse             *string   `gorm:"type:varchar(500)" json:"adresse,omitempty"`
	Specialite          *string   `gorm:"type:varchar(255)" json:"specialite,omitempty"`
	RIB                 *string   `gorm:"column:rib;type:varchar(100)" json:"rib,omitempty"`
	EntrepriseID        *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CreatedAt           time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Contrats []ContratST `gorm:"foreignKey:SousTraitantID" json:"contrats,omitempty"`
}

func (SousTraitant) TableName() string { return "SousTraitant" }

// ContratST — contrat avec un sous-traitant sur un chantier.
type ContratST struct {
	ID            string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	SousTraitantID string    `gorm:"column:sousTraitantId;type:varchar(30);index;not null" json:"sousTraitantId"`
	ChantierID    string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	ObjetTravaux  string     `gorm:"column:objetTravaux;type:varchar(500);not null" json:"objetTravaux"`
	MontantHT     float64    `gorm:"column:montantHT;not null" json:"montantHT"`
	DateDebut     *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
	DateFin       *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	Conditions    *string    `gorm:"type:text" json:"conditions,omitempty"`
	Statut        string     `gorm:"type:varchar(30);default:EN_COURS" json:"statut"` // EN_COURS, RECEPTIONNE, SOLDE, ANNULE
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	SousTraitant *SousTraitant `gorm:"foreignKey:SousTraitantID" json:"sousTraitant,omitempty"`
	Chantier     *Chantier     `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (ContratST) TableName() string { return "ContratST" }
