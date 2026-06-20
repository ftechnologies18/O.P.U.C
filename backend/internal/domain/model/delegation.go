package model

import "time"

// Delegation — Délégation de domaine fonctionnel par le GERANT à un user.
// Le GERANT peut déléguer un domaine (FINANCE, RH, etc.) avec un niveau
// de permission (LECTURE, ECRITURE, GESTION). Expiration optionnelle.
type Delegation struct {
	ID           string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EntrepriseID string     `gorm:"column:entrepriseId;type:varchar(30);index;not null" json:"entrepriseId"`
	FromUserID   string     `gorm:"column:fromUserId;type:varchar(30);not null" json:"fromUserId"`
	ToUserID     string     `gorm:"column:toUserId;type:varchar(30);index;not null" json:"toUserId"`
	Domain       string     `gorm:"type:varchar(30);not null" json:"domain"`   // FINANCE, RH, LOGISTIQUE, COMMERCIAL, CHANTIER, DOCUMENTS
	Permissions  string     `gorm:"type:varchar(20);default:LECTURE" json:"permissions"` // LECTURE, ECRITURE, GESTION
	Statut       string     `gorm:"type:varchar(20);default:ACTIF;index" json:"statut"`   // ACTIF, REVOCQUE, EXPIRE
	ExpiresLe    *time.Time `gorm:"column:expiresLe" json:"expiresLe,omitempty"`
	Raison       *string    `gorm:"type:varchar(500)" json:"raison,omitempty"`
	CreatedAt    time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Delegation) TableName() string { return "Delegation" }

// Domaines fonctionnels (6)
const (
	DomainFinance    = "FINANCE"
	DomainRH         = "RH"
	DomainLogistique = "LOGISTIQUE"
	DomainCommercial = "COMMERCIAL"
	DomainChantier   = "CHANTIER"
	DomainDocuments  = "DOCUMENTS"
)

// Niveaux de permission
const (
	PermLecture  = "LECTURE"
	PermEcriture = "ECRITURE"
	PermGestion  = "GESTION"
)

// PermLevel retourne le niveau numérique d'une permission (pour comparaison).
func PermLevel(perm string) int {
	switch perm {
	case PermGestion:
		return 3
	case PermEcriture:
		return 2
	case PermLecture:
		return 1
	default:
		return 0
	}
}

// DomainModules — mapping domaine → modules concernés (pour le frontend)
var DomainModules = map[string][]string{
	DomainFinance:    {"facturation", "contrats", "paie", "budget"},
	DomainRH:         {"personnel", "pointage", "paie"},
	DomainLogistique: {"stocks", "carburant", "engins", "sous-traitants"},
	DomainCommercial: {"clients", "devis", "contrats"},
	DomainChantier:   {"chantiers", "planning"},
	DomainDocuments:  {"documents", "photos", "rapports"},
}

// DomainLabels — labels français pour le frontend
var DomainLabels = map[string]string{
	DomainFinance:    "Gestion Financière",
	DomainRH:         "Gestion RH",
	DomainLogistique: "Gestion Logistique",
	DomainCommercial: "Gestion Commercial",
	DomainChantier:   "Gestion Chantiers",
	DomainDocuments:  "Gestion Documents",
}

// MaxCoGerants — nombre maximum de co-gérants par entreprise
const MaxCoGerants = 2

// EndpointDomain — mapping endpoint prefix → domaine (pour le middleware RequireAccess)
var EndpointDomain = map[string]string{
	"facturation":      DomainFinance,
	"paie":             DomainRH,
	"personnel":        DomainRH,
	"pointage":         DomainRH,
	"stocks":           DomainLogistique,
	"carburant":        DomainLogistique,
	"engins":           DomainLogistique,
	"sous-traitants":   DomainLogistique,
	"clients":          DomainCommercial,
	"devis":            DomainCommercial,
	"contrats":         DomainCommercial,
	"chantiers":        DomainChantier,
	"planning":         DomainChantier,
	"documents":        DomainDocuments,
	"photos":           DomainDocuments,
	"rapports":         DomainDocuments,
	"budget":           DomainFinance,
}

// Delegation statuts
const (
	DelegationStatutActif    = "ACTIF"
	DelegationStatutRevoque  = "REVOCQUE"
	DelegationStatutExpire   = "EXPIRE"
)
