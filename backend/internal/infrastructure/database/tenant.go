// Package database — tenant.go
// Implémente le Row-Level Security (RLS) PostgreSQL.
//
// Pattern Supabase-compatible :
//   - Connexion en tant que postgres (bypassRLS=true, reconnu par le pooler Supavisor)
//   - Dans chaque transaction : SET LOCAL ROLE app_user (active RLS)
//   - set_config('app.current_tenant', tenantID) pour le filtrage tenant
//   - set_config('app.user_role', role) pour le bypass SUPER_ADMIN
//
// Note : `SET LOCAL ROLE` change current_user pour la transaction.
// Les policies RLS s'appliquent à current_user (app_user, sans BYPASSRLS).
package database

import (
        "context"

        "gorm.io/gorm"
)

// ctxKey est la clé typée pour stocker l'auth user dans le context.
type ctxKey string

const (
        CtxUserKey ctxKey = "auth_user"
)

// AuthUser représente l'utilisateur authentifié extrait du JWT.
type AuthUser struct {
        UserID        string
        Email         string
        Role          string
        EntrepriseID  string // "" pour SUPER_ADMIN
        TwoFAVerified bool
        IsCoGerant    bool // true si co-gérant (mêmes droits que GERANT sauf promote/demote)
}

// FromContext extrait l'AuthUser du context (ou nil).
func FromContext(ctx context.Context) *AuthUser {
        if v, ok := ctx.Value(CtxUserKey).(*AuthUser); ok {
                return v
        }
        return nil
}

// WithTenant exécute fn dans une transaction avec RLS activée.
//
// Comportement :
//   - SUPER_ADMIN : SET LOCAL ROLE app_user + role=SUPER_ADMIN → RLS bypass (voit tout)
//   - Autres rôles : SET LOCAL ROLE app_user + tenant=entrepriseID → RLS filtre par tenant
//
// Le SET LOCAL ROLE app_user active RLS car app_user n'a pas l'attribut BYPASSRLS.
// Les policies utilisent app_current_tenant() et app_is_super_admin() pour le filtrage.
//
// Depuis Phase 6 (SaaS), on set aussi `app.user_id` pour permettre à la fonction
// app_has_support_access(tenant_id) de vérifier qu'un SUPER_ADMIN a bien un
// SupportAccess actif pour le tenant qu'il tente de consulter.
func WithTenant(ctx context.Context, db *gorm.DB, auth *AuthUser, fn func(tx *gorm.DB) error) error {
        // Si pas d'auth user (ex: login, qui se fait avant auth), on bypass RLS
        if auth == nil {
                return fn(db.WithContext(ctx))
        }

        return db.Transaction(func(tx *gorm.DB) error {
                // 1. Changer le rôle courant vers app_user (active RLS)
                if err := tx.Exec("SET LOCAL ROLE app_user").Error; err != nil {
                        return err
                }

                // 2. Setter le contexte tenant (pour le filtrage RLS)
                if auth.EntrepriseID != "" {
                        if err := tx.Exec(
                                "SELECT set_config('app.current_tenant', ?, true)",
                                auth.EntrepriseID,
                        ).Error; err != nil {
                                return err
                        }
                }

                // 3. Setter le rôle applicatif (pour le bypass SUPER_ADMIN dans les policies)
                if err := tx.Exec(
                        "SELECT set_config('app.user_role', ?, true)",
                        auth.Role,
                ).Error; err != nil {
                        return err
                }

                // 4. Setter le user_id (Phase 6 — requis par app_has_support_access)
                if auth.UserID != "" {
                        if err := tx.Exec(
                                "SELECT set_config('app.user_id', ?, true)",
                                auth.UserID,
                        ).Error; err != nil {
                                return err
                        }
                }

                // 5. Exécuter la fonction métier dans ce contexte RLS
                return fn(tx.WithContext(ctx))
        })
}
