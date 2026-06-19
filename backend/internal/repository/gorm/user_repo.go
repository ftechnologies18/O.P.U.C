// Package gorm — repository implementations using GORM.
// Implémente les interfaces définies côté usecase (inversion de dépendance).
package gorm

import (
        "context"
        "errors"

        "opuc/internal/domain/model"
        "gorm.io/gorm"
)

// UserRepository implémente les interfaces auth.UserRepo et iam.UsersRepo.
//
// Deux connexions GORM :
//   - db        : Migrations (postgres, bypass RLS) — pour login flow (FindByEmail,
//                 FindByID, UpdateLastLogin, IncrementLoginAttempts, Update2FASettings).
//                 Le login se fait AVANT que le contexte tenant soit connu.
//   - runtimeDB : Runtime (app_user, RLS enforced) — pour IAM CRUD (List, GetByID,
//                 Create, Update, Delete, ToggleActive, ResetPassword). Attacher via
//                 WithRuntime(dbm.Runtime).
type UserRepository struct {
        db        *gorm.DB
        runtimeDB *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
        return &UserRepository{db: db}
}

// FindByEmail retourne un user par son email (login flow).
// Utilise la connexion admin (Migrations) car le login se fait AVANT
// que le contexte tenant soit connu (user pas encore authentifié).
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
        var u model.User
        err := r.db.WithContext(ctx).Where("email = ? AND active = true", email).First(&u).Error
        if err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, nil // pas d'erreur 500, juste pas trouvé
                }
                return nil, err
        }
        return &u, nil
}

// FindByID retourne un user par son ID (pour /auth/me).
func (r *UserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
        var u model.User
        err := r.db.WithContext(ctx).Where("id = ?", id).First(&u).Error
        if err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, nil
                }
                return nil, err
        }
        return &u, nil
}

// UpdateLastLogin met à jour la date de dernière connexion + IP.
// Colonnes Prisma camelCase : lastLoginAt, lastLoginIp.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id, ip string) error {
        return r.db.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", id).
                Updates(map[string]any{
                        "lastLoginAt": gorm.Expr("NOW()"),
                        "lastLoginIp": ip,
                }).Error
}

// IncrementLoginAttempts incrémente le compteur de tentatives échouées.
// Colonne Prisma : loginAttempts.
func (r *UserRepository) IncrementLoginAttempts(ctx context.Context, id string) error {
        return r.db.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", id).
                UpdateColumn("loginAttempts", gorm.Expr("loginAttempts + 1")).Error
}

// ResetLoginAttempts remet à zéro le compteur après login réussi.
func (r *UserRepository) ResetLoginAttempts(ctx context.Context, id string) error {
        return r.db.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", id).
                Update("loginAttempts", 0).Error
}
