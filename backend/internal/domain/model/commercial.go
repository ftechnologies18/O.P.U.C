package model

import "time"

// Client — client d'une entreprise (pour devis/contrats/factures).
// Schéma complet Prisma : raisonSociale, nomContact, rccm, nif, type, statut, notes.
type Client struct {
	ID            string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	RaisonSociale string    `gorm:"column:raisonSociale;type:varchar(255);not null" json:"raisonSociale"`
	NomContact    *string   `gorm:"column:nomContact;type:varchar(255)" json:"nomContact,omitempty"`
	Telephone     *string   `gorm:"type:varchar(30)" json:"telephone,omitempty"`
	Email         *string   `gorm:"type:varchar(255)" json:"email,omitempty"`
	Adresse       *string   `gorm:"type:varchar(500)" json:"adresse,omitempty"`
	RCCM          *string   `gorm:"column:rccm;type:varchar(100)" json:"rccm,omitempty"` // Registre Commerce
	NIF           *string   `gorm:"column:nif;type:varchar(50)" json:"nif,omitempty"`    // Numéro Identification Fiscale
	Type          string    `gorm:"type:varchar(30);default:ENTREPRISE" json:"type"`     // ENTREPRISE, PARTICULIER, INSTITUTION
	Statut        string    `gorm:"type:varchar(30);default:ACTIF" json:"statut"`        // ACTIF, INACTIF, PROSPECT
	Notes         *string   `gorm:"type:text" json:"notes,omitempty"`
	EntrepriseID  *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CreatedAt     time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Client) TableName() string { return "Client" }

// Devis — devis commercial (avec lignes, TVA, remise).
type Devis struct {
	ID            string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Numero        string     `gorm:"type:varchar(100);not null" json:"numero"`
	ClientID      string     `gorm:"column:clientId;type:varchar(30);index;not null" json:"clientId"`
	Statut        string     `gorm:"type:varchar(30);default:BROUILLON" json:"statut"` // BROUILLON, ENVOYE, ACCEPTE, REFUSE, EXPIRE
	DateEmission  time.Time  `gorm:"column:dateEmission;not null" json:"dateEmission"`
	DateValidite  *time.Time `gorm:"column:dateValidite" json:"dateValidite,omitempty"`
	Conditions    *string    `gorm:"type:text" json:"conditions,omitempty"`
	RemiseGlobale float64    `gorm:"column:remiseGlobale;default:0" json:"remiseGlobale"` // %
	TotalHT       float64    `gorm:"column:totalHT;default:0" json:"totalHT"`
	TauxTVA       float64    `gorm:"column:tauxTVA;default:18" json:"tauxTVA"` // 18% Côte d'Ivoire
	MontantTVA    float64    `gorm:"column:montantTVA;default:0" json:"montantTVA"`
	TotalTTC      float64    `gorm:"column:totalTTC;default:0" json:"totalTTC"`
	Notes         *string    `gorm:"type:text" json:"notes,omitempty"`
	EntrepriseID  *string    `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Client  *Client     `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Lignes  []LigneDevis `gorm:"foreignKey:DevisID" json:"lignes,omitempty"`
}

func (Devis) TableName() string { return "Devis" }

// LigneDevis — ligne d'un devis (désignation, quantité, prix unitaire, total HT).
type LigneDevis struct {
	ID           string  `gorm:"primaryKey;type:varchar(30)" json:"id"`
	DevisID      string  `gorm:"column:devisId;type:varchar(30);index;not null" json:"devisId"`
	Designation  string  `gorm:"type:varchar(255);not null" json:"designation"`
	Description  *string `gorm:"type:text" json:"description,omitempty"`
	Quantite     float64 `gorm:"not null" json:"quantite"`
	Unite        string  `gorm:"type:varchar(20)" json:"unite"`
	PrixUnitaire float64 `gorm:"column:prixUnitaire;not null" json:"prixUnitaire"`
	TotalHT      float64 `gorm:"column:totalHT;not null" json:"totalHT"` // = quantite × prixUnitaire
	Ordre        int     `gorm:"default:0" json:"ordre"`
}

func (LigneDevis) TableName() string { return "LigneDevis" }

// Contrat — contrat commercial (travaux, fourniture, service).
type Contrat struct {
	ID            string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Numero        string     `gorm:"type:varchar(100);not null" json:"numero"`
	ClientID      string     `gorm:"column:clientId;type:varchar(30);index;not null" json:"clientId"`
	Objet         string     `gorm:"type:varchar(500);not null" json:"objet"`
	TypeContrat   string     `gorm:"column:typeContrat;type:varchar(30);default:TRAVAUX" json:"typeContrat"` // TRAVAUX, FOURNITURE, SERVICE, MIXTE
	MontantHT     float64    `gorm:"column:montantHT;default:0" json:"montantHT"`
	TauxTVA       float64    `gorm:"column:tauxTVA;default:18" json:"tauxTVA"`
	MontantTTC    float64    `gorm:"column:montantTTC;default:0" json:"montantTTC"`
	DateDebut     *time.Time `gorm:"column:dateDebut" json:"dateDebut,omitempty"`
	DateFin       *time.Time `gorm:"column:dateFin" json:"dateFin,omitempty"`
	Conditions    *string    `gorm:"type:text" json:"conditions,omitempty"`
	Statut        string     `gorm:"type:varchar(30);default:EN_PREPARATION" json:"statut"` // EN_PREPARATION, ACTIF, EXPIRE, RESILIE, TERMINE
	PenaltyRetard float64    `gorm:"column:penaltyRetard;default:0" json:"penaltyRetard"`   // % par jour de retard
	EntrepriseID  *string    `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Client   *Client    `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Factures []Facture  `gorm:"foreignKey:ContratID" json:"factures,omitempty"`
}

func (Contrat) TableName() string { return "Contrat" }

// Facture — facture commerciale (avec paiements multiples).
type Facture struct {
	ID           string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Numero       string     `gorm:"type:varchar(100);not null" json:"numero"`
	ClientID     string     `gorm:"column:clientId;type:varchar(30);index;not null" json:"clientId"`
	ContratID    *string    `gorm:"column:contratId;type:varchar(30);index" json:"contratId,omitempty"`
	DevisID      *string    `gorm:"column:devisId;type:varchar(30)" json:"devisId,omitempty"`
	TypeFacture  string     `gorm:"column:typeFacture;type:varchar(30);default:FACTURE" json:"typeFacture"` // FACTURE, ACOMPTE, SITUATION, SOLDE
	Statut       string     `gorm:"type:varchar(30);default:BROUILLON" json:"statut"` // BROUILLON, ENVOYE, PAYEE, PARTIELLEMENT_PAYEE, ANNULEE, EN_RETARD
	DateEmission time.Time  `gorm:"column:dateEmission;not null" json:"dateEmission"`
	DateEcheance *time.Time `gorm:"column:dateEcheance" json:"dateEcheance,omitempty"`
	DatePaiement *time.Time `gorm:"column:datePaiement" json:"datePaiement,omitempty"`
	MontantHT    float64    `gorm:"column:montantHT;default:0" json:"montantHT"`
	TauxTVA      float64    `gorm:"column:tauxTVA;default:18" json:"tauxTVA"`
	MontantTVA   float64    `gorm:"column:montantTVA;default:0" json:"montantTVA"`
	TotalTTC     float64    `gorm:"column:totalTTC;default:0" json:"totalTTC"`
	MontantPaye  float64    `gorm:"column:montantPaye;default:0" json:"montantPaye"`
	ModePaiement *string    `gorm:"column:modePaiement;type:varchar(30)" json:"modePaiement,omitempty"` // ESPECES, VIREMENT, MOBILE_MONEY, CHEQUE
	Notes        *string    `gorm:"type:text" json:"notes,omitempty"`
	EntrepriseID *string    `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`

	Client    *Client          `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Contrat   *Contrat         `gorm:"foreignKey:ContratID" json:"contrat,omitempty"`
	Paiements []PaiementFacture `gorm:"foreignKey:FactureID" json:"paiements,omitempty"`
}

func (Facture) TableName() string { return "Facture" }

// PaiementFacture — paiement d'une facture (plusieurs paiements possibles).
type PaiementFacture struct {
	ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
	FactureID    string    `gorm:"column:factureId;type:varchar(30);index;not null" json:"factureId"`
	Montant      float64   `gorm:"not null" json:"montant"`
	DatePaiement time.Time `gorm:"column:datePaiement;not null" json:"datePaiement"`
	ModePaiement string    `gorm:"column:modePaiement;type:varchar(30);not null" json:"modePaiement"` // ESPECES, VIREMENT, MOBILE_MONEY, CHEQUE
	Reference    *string   `gorm:"type:varchar(100)" json:"reference,omitempty"`
	Notes        *string   `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`

	Facture *Facture `gorm:"foreignKey:FactureID" json:"facture,omitempty"`
}

func (PaiementFacture) TableName() string { return "PaiementFacture" }
