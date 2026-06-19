package model

import "time"

// User — utilisateur avec RBAC (4 rôles) + 2FA + sécurité.
//
// IMPORTANT : les noms de colonnes GORM correspondent EXACTEMENT aux colonnes
// Prisma existantes (camelCase : entrepriseId, twoFactorEnabled, loginAttempts...).
// Ne PAS utiliser snake_case (login_attempts) — ça casserait les requêtes.
type User struct {
	ID    string `gorm:"primaryKey;type:varchar(30)" json:"id"`
	Email string `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	// Password : hash bcrypt (jamais retourné en JSON — json:"-")
	Password  *string `gorm:"type:varchar(255)" json:"-"`
	Name      string  `gorm:"type:varchar(255);not null" json:"name"`
	Role      string  `gorm:"type:varchar(30);default:CHEF_PROJET" json:"role"`
	Telephone *string `gorm:"type:varchar(30)" json:"telephone,omitempty"`
	Active    bool    `gorm:"default:true" json:"active"`

	// ── Multi-tenant ────────────────────────────────────────────
	// EntrepriseID nullable : SUPER_ADMIN n'appartient à aucune entreprise
	EntrepriseID *string `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`

	// ── 2FA ─────────────────────────────────────────────────────
	TwoFactorEnabled     bool    `gorm:"column:twoFactorEnabled;default:false" json:"twoFactorEnabled"`
	TwoFactorSecret      *string `gorm:"column:twoFactorSecret;type:varchar(255)" json:"-"`
	TwoFactorBackupCodes *string `gorm:"column:twoFactorBackupCodes;type:text" json:"-"`

	// ── Sécurité ────────────────────────────────────────────────
	LoginAttempts     int        `gorm:"column:loginAttempts;default:0" json:"-"`
	LockedUntil       *time.Time `gorm:"column:lockedUntil" json:"-"`
	LastLoginAt       *time.Time `gorm:"column:lastLoginAt" json:"lastLoginAt,omitempty"`
	LastLoginIP       *string    `gorm:"column:lastLoginIp;type:varchar(45)" json:"-"`
	PasswordChangedAt time.Time  `gorm:"column:passwordChangedAt" json:"passwordChangedAt"`
	PremiereConnexion bool       `gorm:"column:premiereConnexion;default:true" json:"premiereConnexion"`

	// ── Invitation ──────────────────────────────────────────────
	InvitedByID          *string    `gorm:"column:invitedById;type:varchar(30)" json:"invitedById,omitempty"`
	InvitationAcceptedAt *time.Time `gorm:"column:invitationAcceptedAt" json:"invitationAcceptedAt,omitempty"`

	// ── Audit ───────────────────────────────────────────────────
	CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updatedAt" json:"updatedAt"`

	// ── Relations ───────────────────────────────────────────────
	Entreprise *Entreprise `gorm:"foreignKey:EntrepriseID" json:"entreprise,omitempty"`
}

func (User) TableName() string { return "User" } // Prisma-style PascalCase

// Is2FAEnabled retourne true si le user a activé la 2FA.
func (u *User) Is2FAEnabled() bool { return u.TwoFactorEnabled && u.TwoFactorSecret != nil }

// IsLocked retourne true si le compte est temporairement verrouillé.
func (u *User) IsLocked() bool {
	return u.LockedUntil != nil && u.LockedUntil.After(time.Now())
}

// IsSuperAdmin retourne true si le user est SUPER_ADMIN (bypass tenant).
func (u *User) IsSuperAdmin() bool { return u.Role == "SUPER_ADMIN" }
