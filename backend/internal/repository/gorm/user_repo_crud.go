// Package gorm — user_repo_crud.go
// Méthodes CRUD IAM pour UserRepository (Phase 1).
//
// Ces méthodes utilisent la connexion Runtime (app_user) avec WithTenant pour
// appliquer le Row-Level Security (RLS) — contrairement à FindByEmail/FindByID
// qui utilisent la connexion Migrations (postgres, bypass RLS) car le login se
// fait avant que le contexte tenant soit connu.
//
// Toutes les méthodes acceptent un *database.AuthUser (extrait du JWT dans le
// handler) pour :
//   - SUPER_ADMIN : RLS bypass → voit tous les users toutes entreprises confondues
//   - Autres rôles : RLS filtre par entrepriseId → ne voit que sa propre entreprise
package gorm

import (
        "context"
        "crypto/rand"
        "encoding/hex"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/iam"

        "gorm.io/gorm"
)

// WithRuntime attache la connexion runtime (app_user, RLS enforced) au repo.
// Sans cet appel, les méthodes CRUD renvoient une erreur ErrRuntimeRequired.
// Retourne le receiver pour chaînage : `gorm.NewUserRepository(mig).WithRuntime(rt)`.
func (r *UserRepository) WithRuntime(runtimeDB *gorm.DB) *UserRepository {
        r.runtimeDB = runtimeDB
        return r
}

// ErrRuntimeRequired est retourné si une méthode CRUD est appelée sans avoir
// attaché la connexion runtime via WithRuntime.
var ErrRuntimeRequired = errors.New("user repository: runtime DB required (call WithRuntime)")

// NOTE : ListFilter est défini côté usecase (iam.ListFilter). Le repo l'import
// pour satisfaire l'interface iam.UsersRepo sans redéfinir le type (ce qui
// casserait l'implémentation d'interface — Go est strict sur les types).

// List — retourne une page de users filtrés par RLS (tenant-scoped).
// Le total retourné est le compte après filtrage RLS (donc le nombre de users
// visibles par l'authUser courant).
func (r *UserRepository) List(ctx context.Context, auth *database.AuthUser, filter iam.ListFilter) ([]model.User, int64, error) {
        if r.runtimeDB == nil {
                return nil, 0, ErrRuntimeRequired
        }

        page := filter.Page
        if page < 1 {
                page = 1
        }
        pageSize := filter.PageSize
        if pageSize < 1 {
                pageSize = 50
        }
        offset := (page - 1) * pageSize

        var (
                users []model.User
                total int64
        )

        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.User{})
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where("email ILIKE ? OR name ILIKE ?", like, like)
                }
                if filter.Role != "" {
                        q = q.Where("role = ?", filter.Role)
                }
                if filter.Active != nil {
                        q = q.Where("active = ?", *filter.Active)
                }

                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count users: %w", err)
                }
                if err := q.
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&users).Error; err != nil {
                        return fmt.Errorf("list users: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return users, total, nil
}

// GetByID — retourne un user par ID (RLS-filtered).
// Renvoie (nil, nil) si non trouvé (pas une erreur 500).
func (r *UserRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }

        var u model.User
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                err := tx.Where("id = ?", id).First(&u).Error
                if err != nil {
                        if errors.Is(err, gorm.ErrRecordNotFound) {
                                return nil // pas trouvé → (nil, nil)
                        }
                        return err
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        if u.ID == "" {
                return nil, nil // non trouvé
        }
        return &u, nil
}

// Create — insère un nouveau user (RLS-filtered).
// L'ID est généré si vide (cuid-like : "c" + 24 hex chars = 25 chars, varchar(30) OK).
// Les champs createdAt/updatedAt/passwordChangedAt sont définis explicitement
// pour éviter les zéros Go (0001-01-01) qui écraseraient les defaults DB.
func (r *UserRepository) Create(ctx context.Context, auth *database.AuthUser, user model.User) (*model.User, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }

        if user.ID == "" {
                user.ID = newCuidLikeID()
        }

        now := time.Now().UTC()
        if user.CreatedAt.IsZero() {
                user.CreatedAt = now
        }
        if user.UpdatedAt.IsZero() {
                user.UpdatedAt = now
        }
        if user.PasswordChangedAt.IsZero() {
                user.PasswordChangedAt = now
        }

        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                return tx.Create(&user).Error
        })
        if err != nil {
                return nil, err
        }
        return &user, nil
}

// Update — met à jour un user par ID avec un map d'updates (RLS-filtered).
// Met à jour updatedAt automatiquement. Renvoie le user mis à jour.
// Renvoie (nil, nil) si l'ID n'existe pas (ou n'est pas visible par RLS).
func (r *UserRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.User, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if len(updates) == 0 {
                // Pas d'updates → on renvoie juste le user courant
                return r.GetByID(ctx, auth, id)
        }

        updates["updatedAt"] = time.Now().UTC()

        var updated model.User
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                res := tx.Model(&model.User{}).Where("id = ?", id).Updates(updates)
                if res.Error != nil {
                        return res.Error
                }
                if res.RowsAffected == 0 {
                        return nil // non trouvé / non visible → (nil, nil)
                }
                // Re-fetch le user à jour
                if err := tx.Where("id = ?", id).First(&updated).Error; err != nil {
                        if errors.Is(err, gorm.ErrRecordNotFound) {
                                return nil
                        }
                        return err
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        if updated.ID == "" {
                return nil, nil
        }
        return &updated, nil
}

// Delete — soft delete : met active=false (RLS-filtered).
// Ne supprime jamais physiquement la ligne (audit + réactivation possibles).
// Renvoie nil si l'ID n'existe pas / n'est pas visible (idempotent).
func (r *UserRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if r.runtimeDB == nil {
                return ErrRuntimeRequired
        }

        return database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                res := tx.Model(&model.User{}).
                        Where("id = ?", id).
                        Update("active", false)
                if res.Error != nil {
                        return res.Error
                }
                return nil // idempotent : pas d'erreur si RowsAffected == 0
        })
}

// ToggleActive — bascule active entre true/false (RLS-filtered).
// Renvoie le user mis à jour. (nil, nil) si non trouvé / non visible.
func (r *UserRepository) ToggleActive(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }

        var current model.User
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                err := tx.Where("id = ?", id).First(&current).Error
                if err != nil {
                        if errors.Is(err, gorm.ErrRecordNotFound) {
                                return nil // (nil, nil)
                        }
                        return err
                }
                newVal := !current.Active
                if err := tx.Model(&model.User{}).
                        Where("id = ?", id).
                        Updates(map[string]any{
                                "active":    newVal,
                                "updatedAt": time.Now().UTC(),
                        }).Error; err != nil {
                        return err
                }
                current.Active = newVal
                return nil
        })
        if err != nil {
                return nil, err
        }
        if current.ID == "" {
                return nil, nil
        }
        return &current, nil
}

// ResetPassword — met à jour le hash du mot de passe (RLS-filtered).
// Le hash doit être déjà bcrypt-hashed par le usecase (le repo ne hashe pas).
// Met à jour passwordChangedAt et force premiereConnexion=true.
// Renvoie nil si l'ID n'existe pas / n'est pas visible (idempotent).
func (r *UserRepository) ResetPassword(ctx context.Context, auth *database.AuthUser, id, hashedPassword string) error {
        if r.runtimeDB == nil {
                return ErrRuntimeRequired
        }

        now := time.Now().UTC()
        return database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                res := tx.Model(&model.User{}).Where("id = ?", id).Updates(map[string]any{
                        "password":           hashedPassword,
                        "passwordChangedAt":  now,
                        "premiereConnexion":  true,
                        "loginAttempts":      0,
                        "lockedUntil":        nil,
                        "updatedAt":          now,
                })
                if res.Error != nil {
                        return res.Error
                }
                return nil
        })
}

// Update2FASettings — met à jour le secret TOTP + flag twoFactorEnabled.
// Utilisé par le usecase 2FA (Setup/Verify/Disable).
// Cette méthode est appelée par l'utilisateur sur LUI-MÊME (userID issu du JWT),
// donc l'absence de RLS est acceptable (pas de cross-tenant possible).
// Pas de WithTenant → utilise r.db (admin) pour cohérence avec UpdateLastLogin.
func (r *UserRepository) Update2FASettings(ctx context.Context, userID string, secret *string, enabled bool) error {
        return r.db.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", userID).
                Updates(map[string]any{
                        "twoFactorSecret":  secret,
                        "twoFactorEnabled": enabled,
                        "updatedAt":        time.Now().UTC(),
                }).Error
}

// ── helpers ────────────────────────────────────────────────────

// newCuidLikeID génère un ID cuid-like : "c" + 24 hex chars = 25 chars.
// Compatible avec varchar(30) Prisma. Pas cryptographiquement parfait mais
// suffisant pour éviter les collisions en Phase 1 (la PK DB rejette les doublons).
func newCuidLikeID() string {
        b := make([]byte, 12) // 12 bytes → 24 hex chars
        if _, err := rand.Read(b); err != nil {
                // Fallback extrêmement improbable : on retourne un ID basé sur le timestamp
                return fmt.Sprintf("c%d", time.Now().UnixNano())
        }
        return "c" + hex.EncodeToString(b)
}
