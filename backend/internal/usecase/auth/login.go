// Package auth — usecase login
// Logique métier d'authentification : vérifie credentials, génère JWT.
package auth

import (
        "context"
        "errors"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/crypto"
        "opuc/internal/infrastructure/jwt"
)

// UserRepo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.UserRepository.
type UserRepo interface {
        FindByEmail(ctx context.Context, email string) (*model.User, error)
        FindByID(ctx context.Context, id string) (*model.User, error)
        UpdateLastLogin(ctx context.Context, id, ip string) error
        IncrementLoginAttempts(ctx context.Context, id string) error
        ResetLoginAttempts(ctx context.Context, id string) error
        // Update2FASettings — met à jour twoFactorSecret + twoFactorEnabled.
        // Utilisé par Setup2FA/Verify2FA/Disable2FA (self-service, userID issu du JWT).
        Update2FASettings(ctx context.Context, userID string, secret *string, enabled bool) error
}

// Usecase — cas d'usage d'authentification.
type Usecase struct {
        users  UserRepo
        signer *jwt.Signer
        log    *slog.Logger
}

func NewUsecase(users UserRepo, signer *jwt.Signer, log *slog.Logger) *Usecase {
        return &Usecase{users: users, signer: signer, log: log}
}

// LoginInput — paramètres d'entrée du login.
type LoginInput struct {
        Email    string `json:"email"`
        Password string `json:"password"`
}

// LoginOutput — résultat du login.
// Si TwoFARequired=true, le JWT émis a TwoFAVerified=false et le frontend
// doit appeler POST /auth/2fa/verify avant d'accéder aux autres endpoints.
type LoginOutput struct {
        User           *model.User `json:"user"`
        Token          string      `json:"-"`           // set via cookie, pas dans le body
        TwoFARequired  bool        `json:"twoFARequired"`
        TwoFAVerified  bool        `json:"twoFAVerified"`
        ExpiresIn      int         `json:"expiresIn"` // secondes
}

// Login vérifie email/password et émet un JWT.
// Flux :
//   1. Trouve le user par email (actif uniquement)
//   2. Vérifie le hash bcrypt
//   3. Si 2FA activée → émet JWT avec 2fa=false (pending), frontend demande le code TOTP
//   4. Sinon → émet JWT avec 2fa=true, login complet
//   5. Reset login_attempts, update lastLoginAt
func (uc *Usecase) Login(ctx context.Context, in LoginInput, clientIP string) (*LoginOutput, error) {
        uc.log.Info("login attempt", "email", in.Email, "ip", clientIP)

        user, err := uc.users.FindByEmail(ctx, in.Email)
        if err != nil {
                uc.log.Error("FindByEmail failed", "err", err)
                return nil, domain.ErrInternal
        }
        if user == nil {
                uc.log.Warn("login: user not found", "email", in.Email)
                return nil, domain.ErrInvalidCredentials
        }

        // Compte verrouillé ?
        if user.IsLocked() {
                uc.log.Warn("login: account locked", "email", in.Email)
                return nil, domain.ErrAccountLocked
        }

        // Vérification bcrypt
        if user.Password == nil {
                uc.log.Warn("login: no password set", "email", in.Email)
                return nil, domain.ErrInvalidCredentials
        }
        if err := crypto.ComparePassword(*user.Password, in.Password); err != nil {
                _ = uc.users.IncrementLoginAttempts(ctx, user.ID)
                uc.log.Warn("login: bad password", "email", in.Email)
                return nil, domain.ErrInvalidCredentials
        }

        // 2FA ?
        if user.Is2FAEnabled() {
                token, err := uc.signer.Sign(jwt.Claims{
                        UserID:        user.ID,
                        Email:         user.Email,
                        Role:          user.Role,
                        EntrepriseID:  derefString(user.EntrepriseID),
                        TwoFAVerified: false,
                })
                if err != nil {
                        uc.log.Error("sign jwt (2fa pending)", "err", err)
                        return nil, domain.ErrInternal
                }
                return &LoginOutput{
                        User:          user,
                        Token:         token,
                        TwoFARequired: true,
                        ExpiresIn:     int(uc.signer.Expiration().Seconds()),
                }, nil
        }

        // Login complet (sans 2FA)
        token, err := uc.signer.Sign(jwt.Claims{
                UserID:        user.ID,
                Email:         user.Email,
                Role:          user.Role,
                EntrepriseID:  derefString(user.EntrepriseID),
                TwoFAVerified: true,
        })
        if err != nil {
                uc.log.Error("sign jwt", "err", err)
                return nil, domain.ErrInternal
        }

        _ = uc.users.ResetLoginAttempts(ctx, user.ID)
        _ = uc.users.UpdateLastLogin(ctx, user.ID, clientIP)

        uc.log.Info("login success", "email", in.Email, "role", user.Role)
        return &LoginOutput{
                User:          user,
                Token:         token,
                TwoFAVerified: true,
                ExpiresIn:     int(uc.signer.Expiration().Seconds()),
        }, nil
}

// GetCurrentUser retourne le user à partir du JWT validé (pour /auth/me).
func (uc *Usecase) GetCurrentUser(ctx context.Context, userID string) (*model.User, error) {
        user, err := uc.users.FindByID(ctx, userID)
        if err != nil {
                return nil, domain.ErrInternal
        }
        if user == nil {
                return nil, errors.New("user not found")
        }
        return user, nil
}

// Logout — stateless JWT, le serveur ne track rien. Le frontend supprime le cookie.
// (Pour invalidation immédiate côté serveur : blacklist Redis — Phase ultérieure.)
func (uc *Usecase) Logout() error {
        return nil
}

// ── helpers ────────────────────────────────────────────────────

func derefString(s *string) string {
        if s == nil {
                return ""
        }
        return *s
}

// compile-time interface check
var _ = time.Now
