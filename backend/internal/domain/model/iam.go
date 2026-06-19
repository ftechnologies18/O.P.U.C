package model

import "time"

// PermissionConfig — configuration des permissions par rôle (JSON agrégat).
// Schéma Prisma : un row par (role, entrepriseId) avec permissions en JSON text.
type PermissionConfig struct {
        ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
        Role         string    `gorm:"type:varchar(30);not null" json:"role"`
        Permissions  *string   `gorm:"type:text" json:"permissions,omitempty"` // JSON: {"module":"LEVEL", ...}
        EntrepriseID *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
        CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
        UpdatedAt    time.Time `gorm:"column:updatedAt" json:"updatedAt"`
}

func (PermissionConfig) TableName() string { return "PermissionConfig" }

// AuditLog — journal d'audit des actions utilisateur.
// Schéma Prisma : colonnes module, entityType, adresseIp (camelCase).
type AuditLog struct {
        ID           string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
        UserID       *string   `gorm:"column:userId;type:varchar(30);index" json:"userId,omitempty"`
        EntrepriseID *string   `gorm:"column:entrepriseId;type:varchar(30);index" json:"entrepriseId,omitempty"`
        Action       string    `gorm:"type:varchar(100);not null" json:"action"` // LOGIN, LOGOUT, CREATE, UPDATE, DELETE
        Module       *string   `gorm:"type:varchar(50)" json:"module,omitempty"`
        EntityID     *string   `gorm:"column:entityId;type:varchar(30)" json:"entityId,omitempty"`
        EntityType   *string   `gorm:"column:entityType;type:varchar(50)" json:"entityType,omitempty"`
        Details      *string   `gorm:"type:text" json:"details,omitempty"` // JSON details
        AdresseIP    *string   `gorm:"column:adresseIp;type:varchar(45)" json:"adresseIp,omitempty"`
        CreatedAt    time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (AuditLog) TableName() string { return "AuditLog" }

// LoginAttemptLog — journal des tentatives de connexion (succès + échec).
type LoginAttemptLog struct {
        ID        string    `gorm:"primaryKey;type:varchar(30)" json:"id"`
        Email     string    `gorm:"type:varchar(255);index" json:"email"`
        Success   bool      `gorm:"default:false" json:"success"`
        IPAddress *string   `gorm:"column:ipAddress;type:varchar(45)" json:"ipAddress,omitempty"`
        UserAgent *string   `gorm:"column:userAgent;type:varchar(500)" json:"userAgent,omitempty"`
        Reason    *string   `gorm:"type:varchar(100)" json:"reason,omitempty"` // bad_password, not_found, locked, success
        CreatedAt time.Time `gorm:"column:createdAt" json:"createdAt"`
}

func (LoginAttemptLog) TableName() string { return "LoginAttemptLog" }
