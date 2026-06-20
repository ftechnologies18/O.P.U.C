// Package iam — users.go
// Use cases IAM (Identity & Access Management) pour les users.
//
// Opérations CRUD sur les users, tenant-scoped via RLS (Row-Level Security).
// Le repo utilisé est l'interface UsersRepo (inversion de dépendance), implémentée
// par repository/gorm.UserRepository (avec WithRuntime(dbm.Runtime) attaché).
//
// Hiérarchie des permissions (cf. rbac.ts) :
//   - SUPER_ADMIN : peut créer/modifier/supprimer n'importe quel user, toute entreprise
//   - GERANT      : peut créer/modifier/supprimer les users de SON entreprise uniquement
//                   (RLS enforced → ne peut pas voir/éditer les autres entreprises)
//   - CHEF_PROJET, SOUS_TRAITANT : peuvent uniquement consulter (selon routes)
//
// Le usecase applique la logique métier (hash password, règles tenant, validation
// des rôles). Le repo ne fait que la persistance.
package iam

import (
        "context"
        "errors"
        "fmt"
        "log/slog"
        "strings"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/crypto"
        "opuc/internal/infrastructure/database"
)

// UsersRepo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.UserRepository (méthodes CRUD de user_repo_crud.go).
//
// Toutes les méthodes acceptent un *database.AuthUser pour activer le RLS :
//   - SUPER_ADMIN → voit toutes les entreprises
//   - autres rôles → ne voit que son entrepriseId
type UsersRepo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListFilter) ([]model.User, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error)
        Create(ctx context.Context, auth *database.AuthUser, user model.User) (*model.User, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.User, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string) error
        ToggleActive(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error)
        ResetPassword(ctx context.Context, auth *database.AuthUser, id, hashedPassword string) error
}

// ListFilter — critères de filtrage pour List.
// Défini ici (côté usecase) pour éviter que le repo ne dépende du dto HTTP.
type ListFilter struct {
        Page     int    // 1-based, défaut 1
        PageSize int    // défaut 50
        Search   string // ILIKE sur email OU name
        Role     string // filtre par rôle
        Active   *bool  // filtre par statut
}

// CreateUserInput — payload pour Create.
type CreateUserInput struct {
        Email        string  `json:"email"`
        Name         string  `json:"name"`
        Role         string  `json:"role"`
        Password     string  `json:"password"`
        Fonction     string  `json:"fonction,omitempty"` // Phase 1 : fonction BTP (uniquement pour EMPLOYE)
        Telephone    *string `json:"telephone,omitempty"`
        EntrepriseID *string `json:"entrepriseId,omitempty"` // ignoré pour non-SUPER_ADMIN (RLS)
}

// UpdateUserInput — payload pour Update. Tous les champs sont optionnels (pointeurs).
type UpdateUserInput struct {
        Name      *string `json:"name,omitempty"`
        Telephone *string `json:"telephone,omitempty"`
        Role      *string `json:"role,omitempty"`
        Fonction  *string `json:"fonction,omitempty"` // Phase 1 : fonction BTP (nullable)
        Active    *bool   `json:"active,omitempty"`
}

// UsersUsecase — cas d'usage IAM pour les users.
type UsersUsecase struct {
        repo UsersRepo
        log  *slog.Logger
}

// NewUsersUsecase constructeur.
func NewUsersUsecase(repo UsersRepo, log *slog.Logger) *UsersUsecase {
        return &UsersUsecase{repo: repo, log: log}
}

// validRoles — ensemble des rôles valides (cf. enums.go).
// Phase 1 : EMPLOYE remplace SOUS_TRAITANT. On garde SOUS_TRAITANT dans la map
// pour la compat le temps de la migration des données legacy (un user existant
// avec role="SOUS_TRAITANT" doit pouvoir être lu/édité sans casser).
var validRoles = map[string]struct{}{
        "SUPER_ADMIN":   {},
        "GERANT":        {},
        "CHEF_PROJET":   {},
        "EMPLOYE":       {},
        "SOUS_TRAITANT": {}, // legacy — à retirer après migration
}

// isValidRole vérifie qu'un rôle est dans la liste des rôles RBAC valides.
func isValidRole(r string) bool {
        _, ok := validRoles[r]
        return ok
}

// isLegacyRole retourne true si le rôle est SOUS_TRAITANT (legacy, à migrer en EMPLOYE).
// Utilisé pour logger un warning lorsqu'un user legacy est édité sans migration.
func isLegacyRole(r string) bool { return r == "SOUS_TRAITANT" }

// List — retourne une page de users + total (RLS-filtered).
func (uc *UsersUsecase) List(ctx context.Context, auth *database.AuthUser, filter ListFilter) ([]model.User, int64, error) {
        if auth == nil {
                return nil, 0, domain.ErrUnauthorized
        }
        users, total, err := uc.repo.List(ctx, auth, filter)
        if err != nil {
                uc.log.Error("iam.List", "err", err, "auth_uid", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return users, total, nil
}

// Get — retourne un user par ID (RLS-filtered).
// (nil, nil) si non trouvé ou non visible par RLS.
func (uc *UsersUsecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        user, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("iam.Get", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if user == nil {
                return nil, domain.ErrNotFound
        }
        return user, nil
}

// Create — crée un user après hash du password + validation.
//
// Règles tenant :
//   - SUPER_ADMIN peut créer dans n'importe quelle entreprise (EntrepriseID du payload).
//   - Autres rôles : l'EntrepriseID est forcé à auth.EntrepriseID (RLS rejette sinon).
//   - SUPER_ADMIN sans EntrepriseID → user sans entreprise (plateforme admin).
//
// Règles de validation :
//   - email non vide + format basique (contient @)
//   - name non vide
//   - password ≥ 6 chars
//   - role ∈ {SUPER_ADMIN, GERANT, CHEF_PROJET, EMPLOYE} (SOUS_TRAITANT legacy accepté)
//   - seul SUPER_ADMIN peut créer un user SUPER_ADMIN
//   - fonction (si fournie) doit être dans la liste fixe BTP (cf. domain.Fonction*)
//   - fonction n'est pertinente que pour EMPLOYE (ignorée sinon, avec log warning)
func (uc *UsersUsecase) Create(ctx context.Context, auth *database.AuthUser, in CreateUserInput) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }

        // ── Validation ─────────────────────────────────────────────
        in.Email = strings.TrimSpace(in.Email)
        in.Name = strings.TrimSpace(in.Name)
        if in.Email == "" || !strings.Contains(in.Email, "@") {
                return nil, fmt.Errorf("%w: email is required and must contain @", domain.ErrBadRequest)
        }
        if in.Name == "" {
                return nil, fmt.Errorf("%w: name is required", domain.ErrBadRequest)
        }
        if len(in.Password) < 6 {
                return nil, fmt.Errorf("%w: password must be at least 6 characters", domain.ErrBadRequest)
        }
        if !isValidRole(in.Role) {
                return nil, fmt.Errorf("%w: invalid role %q", domain.ErrBadRequest, in.Role)
        }
        // Seul SUPER_ADMIN peut créer un SUPER_ADMIN
        if in.Role == "SUPER_ADMIN" && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        // Migration douce : si on reçoit "SOUS_TRAITANT" on le convertit en "EMPLOYE"
        if in.Role == "SOUS_TRAITANT" {
                uc.log.Info("iam.Create: migrating legacy role SOUS_TRAITANT → EMPLOYE", "email", in.Email)
                in.Role = "EMPLOYE"
        }
        // Validation fonction (Phase 1)
        fonction := strings.TrimSpace(in.Fonction)
        if fonction != "" {
                if !domain.IsValidFonctionString(fonction) {
                        return nil, fmt.Errorf("%w: invalid fonction %q", domain.ErrBadRequest, fonction)
                }
                if in.Role != "EMPLOYE" {
                        // La fonction n'est pertinente que pour EMPLOYE — on l'ignore pour les autres rôles
                        uc.log.Info("iam.Create: fonction ignored for non-EMPLOYE role",
                                "email", in.Email, "role", in.Role, "fonction", fonction)
                        fonction = ""
                }
        }

        // ── Résolution entrepriseId ────────────────────────────────
        var entrepriseID *string
        if auth.Role == "SUPER_ADMIN" {
                // SUPER_ADMIN : respecte le payload (peut être nil pour un admin plateforme)
                entrepriseID = in.EntrepriseID
        } else {
                // Non-SUPER_ADMIN : force son propre entrepriseId (RLS enforced)
                if auth.EntrepriseID == "" {
                        return nil, fmt.Errorf("%w: non-admin user has no entrepriseId", domain.ErrBadRequest)
                }
                eid := auth.EntrepriseID
                entrepriseID = &eid
        }

        // ── Hash password ──────────────────────────────────────────
        hashed, err := crypto.HashPassword(in.Password)
        if err != nil {
                uc.log.Error("iam.Create: HashPassword", "err", err)
                return nil, domain.ErrInternal
        }

        // ── Construction du model.User ─────────────────────────────
        user := model.User{
                Email:        in.Email,
                Name:         in.Name,
                Role:         in.Role,
                Fonction:     fonction,
                Password:     &hashed,
                Telephone:    in.Telephone,
                Active:       true,
                EntrepriseID: entrepriseID,
        }

        created, err := uc.repo.Create(ctx, auth, user)
        if err != nil {
                // GORM renvoie une erreur sur unique constraint (email dupliqué)
                if isUniqueViolation(err) {
                        return nil, domain.ErrConflict
                }
                uc.log.Error("iam.Create: repo.Create", "err", err, "email", in.Email)
                return nil, domain.ErrInternal
        }

        uc.log.Info("user created",
                "id", created.ID,
                "email", created.Email,
                "role", created.Role,
                "fonction", created.Fonction,
                "by", auth.UserID,
        )
        return created, nil
}

// Update — met à jour un user (RLS-filtered).
// Seuls les champs non-nil du payload sont mis à jour.
// Renvoie ErrNotFound si l'ID n'existe pas ou n'est pas visible.
//
// Note : seul SUPER_ADMIN peut promouvoir un user à SUPER_ADMIN (check côté usecase).
func (uc *UsersUsecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateUserInput) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }

        updates := map[string]any{}
        if in.Name != nil {
                v := strings.TrimSpace(*in.Name)
                if v == "" {
                        return nil, fmt.Errorf("%w: name cannot be empty", domain.ErrBadRequest)
                }
                updates["name"] = v
        }
        if in.Telephone != nil {
                updates["telephone"] = *in.Telephone
        }
        if in.Role != nil {
                if !isValidRole(*in.Role) {
                        return nil, fmt.Errorf("%w: invalid role %q", domain.ErrBadRequest, *in.Role)
                }
                // Seul SUPER_ADMIN peut définir le rôle SUPER_ADMIN
                if *in.Role == "SUPER_ADMIN" && auth.Role != "SUPER_ADMIN" {
                        return nil, domain.ErrForbidden
                }
                // Migration douce : SOUS_TRAITANT → EMPLOYE
                roleVal := *in.Role
                if roleVal == "SOUS_TRAITANT" {
                        uc.log.Info("iam.Update: migrating legacy role SOUS_TRAITANT → EMPLOYE", "id", id)
                        roleVal = "EMPLOYE"
                }
                updates["role"] = roleVal
        }
        if in.Fonction != nil {
                fonction := strings.TrimSpace(*in.Fonction)
                if fonction != "" && !domain.IsValidFonctionString(fonction) {
                        return nil, fmt.Errorf("%w: invalid fonction %q", domain.ErrBadRequest, fonction)
                }
                updates["fonction"] = fonction
        }
        if in.Active != nil {
                updates["active"] = *in.Active
        }

        if len(updates) == 0 {
                // Pas d'updates → on renvoie le user courant
                return uc.Get(ctx, auth, id)
        }

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("iam.Update: repo.Update", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }

        uc.log.Info("user updated", "id", id, "by", auth.UserID, "fields", keysOf(updates))
        return updated, nil
}

// Delete — soft delete (active=false), idempotent.
// Renvoie ErrNotFound si l'ID n'existe pas ou n'est pas visible.
func (uc *UsersUsecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }

        // Vérifie d'abord que le user existe (pour renvoyer 404 correctement)
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("iam.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        // Auto-protection : ne pas se supprimer soi-même
        if existing.ID == auth.UserID {
                return fmt.Errorf("%w: cannot delete yourself", domain.ErrBadRequest)
        }

        if err := uc.repo.Delete(ctx, auth, id); err != nil {
                uc.log.Error("iam.Delete: repo.Delete", "err", err, "id", id)
                return domain.ErrInternal
        }

        uc.log.Info("user soft-deleted", "id", id, "by", auth.UserID)
        return nil
}

// ToggleActive — bascule active true/false.
// Renvoie le user mis à jour. ErrNotFound si non trouvé.
// Auto-protection : ne pas se désactiver soi-même.
func (uc *UsersUsecase) ToggleActive(ctx context.Context, auth *database.AuthUser, id string) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }

        if id == auth.UserID {
                return nil, fmt.Errorf("%w: cannot toggle your own active status", domain.ErrBadRequest)
        }

        user, err := uc.repo.ToggleActive(ctx, auth, id)
        if err != nil {
                uc.log.Error("iam.ToggleActive: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if user == nil {
                return nil, domain.ErrNotFound
        }

        uc.log.Info("user active toggled", "id", id, "active", user.Active, "by", auth.UserID)
        return user, nil
}

// ResetPassword — hashe le nouveau password + met à jour le user.
// Met aussi à jour passwordChangedAt + premiereConnexion=true + reset loginAttempts.
// Renvoie ErrNotFound si l'ID n'existe pas ou n'est pas visible.
func (uc *UsersUsecase) ResetPassword(ctx context.Context, auth *database.AuthUser, id, newPassword string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if len(newPassword) < 6 {
                return fmt.Errorf("%w: password must be at least 6 characters", domain.ErrBadRequest)
        }

        // Vérifie que le user existe (pour 404)
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("iam.ResetPassword: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        hashed, err := crypto.HashPassword(newPassword)
        if err != nil {
                uc.log.Error("iam.ResetPassword: HashPassword", "err", err)
                return domain.ErrInternal
        }

        if err := uc.repo.ResetPassword(ctx, auth, id, hashed); err != nil {
                uc.log.Error("iam.ResetPassword: repo", "err", err, "id", id)
                return domain.ErrInternal
        }

        uc.log.Info("user password reset", "id", id, "by", auth.UserID)
        return nil
}

// ── helpers ────────────────────────────────────────────────────

// isUniqueViolation détecte une violation de contrainte unique (email dupliqué).
// GORM/pgx renvoient une erreur dont le message contient "unique constraint" ou
// "duplicate key". On évite d'importer pgx directement pour garder le usecase
// indépendant de l'infra.
func isUniqueViolation(err error) bool {
        if err == nil {
                return false
        }
        msg := err.Error()
        return strings.Contains(msg, "unique constraint") ||
                strings.Contains(msg, "duplicate key") ||
                strings.Contains(msg, "23505") // code SQLSTATE PostgreSQL
}

// keysOf retourne les clés d'un map (pour logging).
func keysOf(m map[string]any) []string {
        keys := make([]string, 0, len(m))
        for k := range m {
                keys = append(keys, k)
        }
        return keys
}

// compile-time interface check
var _ = errors.New
