package model

import "time"

// Equipement — engin de chantier (propriétaire ou loué).
type Equipement struct {
	ID                   string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Designation          string    `gorm:"type:varchar(255);not null" json:"designation"`
	TypeEquipement       string    `gorm:"column:typeEquipement;type:varchar(50)" json:"typeEquipement"` // PELLE, CAMION, BULLDOZER...
	Marque               *string   `gorm:"type:varchar(100)" json:"marque,omitempty"`
	Modele               *string   `gorm:"type:varchar(100)" json:"modele,omitempty"`
	Immatriculation      *string   `gorm:"type:varchar(50)" json:"immatriculation,omitempty"`
	Etat                 string    `gorm:"type:varchar(30);default:ACTIF" json:"etat"` // ACTIF, MAINTENANCE, HORS_SERVICE
	TypeLocation         *string   `gorm:"column:typeLocation;type:varchar(30)" json:"typeLocation,omitempty"` // PROPRE, LOCATION
	EntrepriseID         *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CompteurHeuresActuel float64   `gorm:"column:compteurHeuresActuel;default:0" json:"compteurHeuresActuel"`
	CreatedAt            time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt            time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Equipement) TableName() string { return "Equipement" }

// StockCarburant — cuve de stockage carburant sur un chantier.
type StockCarburant struct {
	ID            string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	ChantierID    string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	TypeCarburant string    `gorm:"column:typeCarburant;type:varchar(20);default:GASOIL" json:"typeCarburant"` // GASOIL, ESSENCE
	Capacite      float64   `gorm:"default:5000" json:"capacite"`                                            // litres
	SeuilAlerte   float64   `gorm:"column:seuilAlerte;default:500" json:"seuilAlerte"`                      // litres
	CreatedAt     time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier *Chantier `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (StockCarburant) TableName() string { return "StockCarburant" }

// EntreeCarburant — entrée de carburant en cuve (approvisionnement).
type EntreeCarburant struct {
	ID             string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	StockCarburantID string  `gorm:"column:stockCarburantId;type:varchar(30);index;not null" json:"stockCarburantId"`
	ChantierID     string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	DateEntree     time.Time `gorm:"column:dateEntree;not null" json:"dateEntree"`
	Quantite       float64   `gorm:"not null" json:"quantite"`        // litres
	PrixUnitaire   float64   `gorm:"column:prixUnitaire;not null" json:"prixUnitaire"` // FCFA/litre
	PrixTotal      float64   `gorm:"column:prixTotal;not null" json:"prixTotal"`       // FCFA
	Fournisseur    *string   `gorm:"type:varchar(255)" json:"fournisseur,omitempty"`
	NumeroBL       *string   `gorm:"column:numeroBL;type:varchar(100)" json:"numeroBL,omitempty"`
	Observation    *string   `gorm:"type:text" json:"observation,omitempty"`
	CreatedAt      time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt      time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Stock    *StockCarburant `gorm:"foreignKey:StockCarburantID" json:"stock,omitempty"`
	Chantier *Chantier       `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (EntreeCarburant) TableName() string { return "EntreeCarburant" }

// SortieCarburant — sortie de carburant pour un équipement.
type SortieCarburant struct {
	ID                  string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	StockCarburantID    string     `gorm:"column:stockCarburantId;type:varchar(30);index;not null" json:"stockCarburantId"`
	ChantierID          string     `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	EquipementID        *string    `gorm:"column:equipementId;type:varchar(30)" json:"equipementId,omitempty"`
	DateSortie          time.Time  `gorm:"column:dateSortie;not null" json:"dateSortie"`
	Quantite            float64    `gorm:"not null" json:"quantite"` // litres
	Operateur           *string    `gorm:"type:varchar(255)" json:"operateur,omitempty"`
	CompteurHeuresAvant *float64   `gorm:"column:compteurHeuresAvant" json:"compteurHeuresAvant,omitempty"`
	CompteurHeuresApres *float64   `gorm:"column:compteurHeuresApres" json:"compteurHeuresApres,omitempty"`
	Observation         *string    `gorm:"type:text" json:"observation,omitempty"`
	CreatedAt           time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt           time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Stock      *StockCarburant `gorm:"foreignKey:StockCarburantID" json:"stock,omitempty"`
	Chantier   *Chantier       `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
	Equipement *Equipement     `gorm:"foreignKey:EquipementID" json:"equipement,omitempty"`
}

func (SortieCarburant) TableName() string { return "SortieCarburant" }

// BonAchatCarburant — bon d'achat carburant (achat direct, sans cuve).
type BonAchatCarburant struct {
	ID                  string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	ChantierID          string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	DateAchat           time.Time `gorm:"column:dateAchat;not null" json:"dateAchat"`
	TypeCarburant       string    `gorm:"column:typeCarburant;type:varchar(20);default:GASOIL" json:"typeCarburant"`
	Quantite            float64   `gorm:"not null" json:"quantite"` // litres
	PrixUnitaire        float64   `gorm:"column:prixUnitaire;not null" json:"prixUnitaire"`
	PrixTotal           float64   `gorm:"column:prixTotal;not null" json:"prixTotal"`
	StationService      *string   `gorm:"column:stationService;type:varchar(255)" json:"stationService,omitempty"`
	NumeroRecu          *string   `gorm:"column:numeroRecu;type:varchar(100)" json:"numeroRecu,omitempty"`
	EquipementID        *string   `gorm:"column:equipementId;type:varchar(30)" json:"equipementId,omitempty"`
	Operateur           *string   `gorm:"type:varchar(255)" json:"operateur,omitempty"`
	CompteurHeuresAvant *float64  `gorm:"column:compteurHeuresAvant" json:"compteurHeuresAvant,omitempty"`
	CompteurHeuresApres *float64  `gorm:"column:compteurHeuresApres" json:"compteurHeuresApres,omitempty"`
	Observation         *string   `gorm:"type:text" json:"observation,omitempty"`
	CreatedAt           time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Chantier   *Chantier   `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
	Equipement *Equipement `gorm:"foreignKey:EquipementID" json:"equipement,omitempty"`
}

func (BonAchatCarburant) TableName() string { return "BonAchatCarburant" }

// ReleveCompteurEngin — relevé du compteur horaire/km d'un engin.
type ReleveCompteurEngin struct {
	ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EquipementID string    `gorm:"column:equipementId;type:varchar(30);index;not null" json:"equipementId"`
	ChantierID   string    `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	DateReleve   time.Time `gorm:"column:dateReleve;not null" json:"dateReleve"`
	HeuresKm     float64   `gorm:"column:heuresKm;not null" json:"heuresKm"`
	Observation  *string   `gorm:"type:text" json:"observation,omitempty"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	Equipement *Equipement `gorm:"foreignKey:EquipementID" json:"equipement,omitempty"`
	Chantier   *Chantier  `gorm:"foreignKey:ChantierID" json:"chantier,omitempty"`
}

func (ReleveCompteurEngin) TableName() string { return "ReleveCompteurEngin" }
