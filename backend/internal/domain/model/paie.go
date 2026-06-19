package model

import "time"

// PaiementHebdo — paiement hebdomadaire d'un journalier (calculé depuis les pointages).
type PaiementHebdo struct {
	ID               string      `gorm:"primaryKey;type:varchar(30)" json:"id"`
	JournalierID     string      `gorm:"column:journalierId;type:varchar(30);index;not null" json:"journalierId"`
	ChantierID       string      `gorm:"column:chantierId;type:varchar(30);index;not null" json:"chantierId"`
	SemaineDebut     time.Time   `gorm:"column:semaineDebut;not null" json:"semaineDebut"`
	SemaineFin       time.Time   `gorm:"column:semaineFin;not null" json:"semaineFin"`
	MontantCalcule   float64     `gorm:"column:montantCalcule;not null" json:"montantCalcule"`
	MontantVerse     *float64    `gorm:"column:montantVerse" json:"montantVerse,omitempty"`
	ModePaiement     *string     `gorm:"column:modePaiement;type:varchar(30)" json:"modePaiement,omitempty"` // ESPECES, MOBILE_MONEY, VIREMENT
	DatePaiement     *time.Time  `gorm:"column:datePaiement" json:"datePaiement,omitempty"`
	Statut           string      `gorm:"type:varchar(30);default:EN_ATTENTE" json:"statut"` // EN_ATTENTE, VALIDÉ, PARTIELLEMENT_VERSE
	ValideParID      *string     `gorm:"column:valideParId;type:varchar(30)" json:"valideParId,omitempty"`
	DifferenceComment *string    `gorm:"column:differenceComment;type:text" json:"differenceComment,omitempty"`
	CreatedAt        time.Time   `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt        time.Time   `gorm:"column:updatedAt" json:"updatedAt"`
}

func (PaiementHebdo) TableName() string { return "PaiementHebdo" }

// SalaireMensuel — salaire mensuel d'un journalier (paie mensuelle).
type SalaireMensuel struct {
	ID                string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	JournalierID      string     `gorm:"column:journalierId;type:varchar(30);index;not null" json:"journalierId"`
	Mois              int        `gorm:"not null" json:"mois"` // 1-12
	Annee             int        `gorm:"not null" json:"annee"` // 2025, 2026...
	SalaireBase       float64    `gorm:"column:salaireBase;not null" json:"salaireBase"`
	Primes            float64    `gorm:"default:0" json:"primes"`
	HeuresSupp        float64    `gorm:"column:heuresSupp;default:0" json:"heuresSupp"`
	MontantHeuresSupp float64    `gorm:"column:montantHeuresSupp;default:0" json:"montantHeuresSupp"`
	RetenuesCNPS      float64    `gorm:"column:retenuesCNPS;default:0" json:"retenuesCNPS"`
	RetenuesIR        float64    `gorm:"column:retenuesIR;default:0" json:"retenuesIR"`
	Avances           float64    `gorm:"default:0" json:"avances"`
	Absences          int        `gorm:"default:0" json:"absences"`
	RetenueAbsences   float64    `gorm:"column:retenueAbsences;default:0" json:"retenueAbsences"`
	NetAPayer         float64    `gorm:"column:netAPayer;not null" json:"netAPayer"`
	Statut            string     `gorm:"type:varchar(30);default:EN_ATTENTE" json:"statut"` // EN_ATTENTE, PAYE, PARTIEL
	DatePaiement      *time.Time `gorm:"column:datePaiement" json:"datePaiement,omitempty"`
	ModePaiement      *string    `gorm:"column:modePaiement;type:varchar(30)" json:"modePaiement,omitempty"`
	Observation       *string    `gorm:"type:text" json:"observation,omitempty"`
	ValideParID       *string    `gorm:"column:valideParId;type:varchar(30)" json:"valideParId,omitempty"`
	CreatedAt         time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt         time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (SalaireMensuel) TableName() string { return "SalaireMensuel" }
