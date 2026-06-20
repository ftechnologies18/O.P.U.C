package model

import "time"

// SupportAccess — Autorisation temporaire d'accès SUPER_ADMIN à une entreprise.
// Le GERANT doit obligatoirement autoriser (consentement explicite).
// Durée max: 4h, auto-expiration, traçabilité complète.
type SupportAccess struct {
	ID            string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	SuperAdminID  string     `gorm:"column:superAdminId;type:varchar(30);index;not null" json:"superAdminId"`
	EntrepriseID  string     `gorm:"column:entrepriseId;type:varchar(30);index;not null" json:"entrepriseId"`
	Raison        string     `gorm:"type:varchar(500);not null" json:"raison"`
	Statut        string     `gorm:"type:varchar(30);default:DEMANDE;index" json:"statut"` // DEMANDE, AUTORISE, REFUSE, EXPIRE, REVOQUE
	DemandeLe     time.Time  `gorm:"column:demandeLe;not null" json:"demandeLe"`
	AutoriseLe    *time.Time `gorm:"column:autoriseLe" json:"autoriseLe,omitempty"`
	AutoriseParID *string    `gorm:"column:autoriseParId;type:varchar(30)" json:"autoriseParId,omitempty"`
	ExpireLe      *time.Time `gorm:"column:expireLe" json:"expireLe,omitempty"`
	RevoqueLe     *time.Time `gorm:"column:revoqueLe" json:"revoqueLe,omitempty"`
	RevoqueParID  *string    `gorm:"column:revoqueParId;type:varchar(30)" json:"revoqueParId,omitempty"`
	ActionsLog    *string    `gorm:"column:actionsLog;type:text" json:"actionsLog,omitempty"`
	CreatedAt     time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (SupportAccess) TableName() string { return "SupportAccess" }

// Subscription — Abonnement SaaS d'une entreprise.
type Subscription struct {
	ID                 string     `gorm:"primaryKey;type:varchar(30)" json:"id"`
	EntrepriseID       string     `gorm:"column:entrepriseId;type:varchar(30);uniqueIndex;not null" json:"entrepriseId"`
	Plan               string     `gorm:"type:varchar(30);default:STARTER;index" json:"plan"` // STARTER, PRO, ENTERPRISE
	Statut             string     `gorm:"type:varchar(30);default:TRIAL;index" json:"statut"`  // TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED
	TrialEndsAt        *time.Time `gorm:"column:trialEndsAt" json:"trialEndsAt,omitempty"`
	CurrentPeriodStart *time.Time `gorm:"column:currentPeriodStart" json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time `gorm:"column:currentPeriodEnd" json:"currentPeriodEnd,omitempty"`
	Amount             float64    `gorm:"default:0" json:"amount"` // FCFA/mois
	Currency           string     `gorm:"type:varchar(10);default:XOF" json:"currency"`
	MaxUsers           int        `gorm:"default:5" json:"maxUsers"`
	MaxChantiers       int        `gorm:"default:3" json:"maxChantiers"`
	MaxStorageMB       int        `gorm:"default:500" json:"maxStorageMB"`
	CreatedAt          time.Time  `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"column:updatedAt" json:"updatedAt"`
}

func (Subscription) TableName() string { return "Subscription" }

// Plans SaaS — constantes
const (
	PlanStarter    = "STARTER"
	PlanPro        = "PRO"
	PlanEnterprise = "ENTERPRISE"
)

// PlanConfigs — configurations des plans SaaS
var PlanConfigs = map[string]struct {
	Amount       float64
	MaxUsers     int
	MaxChantiers int
	MaxStorageMB int
}{
	PlanStarter:    {Amount: 0, MaxUsers: 5, MaxChantiers: 3, MaxStorageMB: 500},
	PlanPro:        {Amount: 25000, MaxUsers: 25, MaxChantiers: 15, MaxStorageMB: 5120},
	PlanEnterprise: {Amount: 75000, MaxUsers: 999, MaxChantiers: 999, MaxStorageMB: 51200},
}

// SupportAccess statuts
const (
	SupportStatutDemande  = "DEMANDE"
	SupportStatutAutorise = "AUTORISE"
	SupportStatutRefuse   = "REFUSE"
	SupportStatutExpire   = "EXPIRE"
	SupportStatutRevoque  = "REVOQUE"
)

// Subscription statuts
const (
	SubStatutTrial    = "TRIAL"
	SubStatutActive   = "ACTIVE"
	SubStatutPastDue  = "PAST_DUE"
	SubStatutCanceled = "CANCELED"
	SubStatutExpired  = "EXPIRED"
)

// MaxSupportAccessDuration — durée max d'un accès support (4 heures)
const MaxSupportAccessDuration = 4 * time.Hour
