package model

import "time"

// DocumentChantier — document attaché à un chantier (plan, permis, contrat, PV, etc.).
type DocumentChantier struct {
	ID              string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Titre           string     `gorm:"type:varchar(255);not null" json:"titre"`
	Type            string     `gorm:"type:varchar(50);default:autre" json:"type"` // plan, permis, contrat, pv_reception, facture, technique, rapport, autre
	Categorie       *string    `gorm:"type:varchar(100)" json:"categorie,omitempty"`
	NumeroReference *string    `gorm:"column:numeroReference;type:varchar(100)" json:"numeroReference,omitempty"`
	FichierNom      string     `gorm:"column:fichierNom;type:varchar(255);not null" json:"fichierNom"`
	FichierUrl      string     `gorm:"column:fichierUrl;type:varchar(500);not null" json:"fichierUrl"`
	FichierTaille   int        `gorm:"column:fichierTaille;default:0" json:"fichierTaille"` // bytes
	FichierType     *string    `gorm:"column:fichierType;type:varchar(100)" json:"fichierType,omitempty"` // MIME
	Version         int        `gorm:"default:1" json:"version"`
	Description     *string    `gorm:"type:text" json:"description,omitempty"`
	Statut          string     `gorm:"type:varchar(30);default:brouillon" json:"statut"` // brouillon, valide, archive
	Tags            *string    `gorm:"type:text" json:"tags,omitempty"` // comma-separated
	ChantierID      string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	PhaseID         *string    `gorm:"column:phaseId;type:varchar(30)" json:"phaseId,omitempty"`
	AuteurID        string     `gorm:"column:auteurId;type:varchar(30);not null" json:"auteurId"`
	DateDocument    *time.Time `gorm:"column:dateDocument" json:"dateDocument,omitempty"`
	CreatedAt       time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier *Chantier `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (DocumentChantier) TableName() string { return "DocumentChantier" }

// Photo — photo de chantier (avancement, incident, réception, etc.).
type Photo struct {
	ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	ChantierID   string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	PhaseID      *string   `gorm:"column:phaseId;type:varchar(30)" json:"phaseId,omitempty"`
	TacheID      *string   `gorm:"column:tacheId;type:varchar(30)" json:"tacheId,omitempty"`
	RapportID    *string   `gorm:"column:rapportId;type:varchar(30)" json:"rapportId,omitempty"`
	PriseParID   string    `gorm:"column:priseParId;type:varchar(30);not null" json:"priseParId"`
	DatePrise    time.Time `gorm:"column:datePrise;not null" json:"datePrise"`
	Legende      *string   `gorm:"type:varchar(500)" json:"legende,omitempty"`
	Categorie    string    `gorm:"type:varchar(50);default:avancement" json:"categorie"` // avancement, incident, reception, materiau, document
	UrlOriginale string    `gorm:"column:urlOriginale;type:varchar(500);not null" json:"urlOriginale"`
	UrlThumbnail *string   `gorm:"column:urlThumbnail;type:varchar(500)" json:"urlThumbnail,omitempty"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Photo) TableName() string { return "Photo" }

// RapportJournalier — rapport quotidien de chantier.
type RapportJournalier struct {
	ID             string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	ChantierID     string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	AuteurID       string    `gorm:"column:auteurId;type:varchar(30);not null" json:"auteurId"`
	DateRapport    time.Time `gorm:"column:dateRapport;not null" json:"dateRapport"`
	Meteo          *string   `gorm:"type:varchar(50)" json:"meteo,omitempty"` // ensoleillé, nuageux, pluie, arret_intemperie
	EffectifPresent *int     `gorm:"column:effectifPresent" json:"effectifPresent,omitempty"`
	TravauxRealises string   `gorm:"column:travauxRealises;type:text;not null" json:"travauxRealises"`
	Incidents      *string   `gorm:"type:text" json:"incidents,omitempty"`
	Observations   *string   `gorm:"type:text" json:"observations,omitempty"`
	CreatedAt      time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt      time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Photos []Photo `gorm:"foreignKey:RapportID" json:"photos,omitempty"`
}

func (RapportJournalier) TableName() string { return "RapportJournalier" }
