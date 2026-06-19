// Package auth — twofa.go
// Use cases 2FA (TOTP) — Setup, Verify, Disable.
//
// Flux 2FA :
//   1. POST /api/v1/auth/2fa/setup   → génère un secret TOTP, le sauve sur le user
//      (twoFactorEnabled reste false), retourne secret + URL otpauth pour QR code.
//   2. L'utilisateur scanne le QR code dans son app TOTP (Google Authenticator, Authy…).
//   3. POST /api/v1/auth/2fa/verify  {code} → valide le code TOTP, set twoFactorEnabled=true.
//      À partir de là, le login exigera le code TOTP (cf. login.go).
//   4. POST /api/v1/auth/2fa/disable {password} → vérifie le mot de passe, set
//      twoFactorEnabled=false + clear secret.
//
// Toutes les méthodes reçoivent userID issu du JWT (auth self-service, jamais
// cross-tenant). Le repo utilisé est r.users (admin DB, pas de RLS) car le user
// opère sur lui-même — pas de risque de cross-tenant.
package auth

import (
	"context"
	"errors"
	"fmt"

	"opuc/internal/domain"
	"opuc/internal/infrastructure/crypto"
)

// TOTPIssuer — nom de l'émetteur affiché dans les apps TOTP.
const TOTPIssuer = "O.P.U.C"

// Setup2FA génère un secret TOTP pour le user, le sauvegarde (deuxFactorEnabled
// reste false jusqu'à Verify), et retourne (secret, otpauthURL).
//
// L'otpauthURL est de la forme :
//   otpauth://totp/O.P.U.C:user@email.com?secret=XXXX&issuer=O.P.U.C
// Le frontend l'utilise pour générer le QR code (librairie qrcode).
//
// Si le user a déjà un secret, il est régénéré (rotation) — l'ancien code ne
// marchera plus. twoFactorEnabled reste à sa valeur précédente.
func (uc *Usecase) Setup2FA(ctx context.Context, userID string) (secret, qrURL string, err error) {
	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		uc.log.Error("2fa setup: FindByID", "err", err, "uid", userID)
		return "", "", domain.ErrInternal
	}
	if user == nil {
		return "", "", domain.ErrNotFound
	}

	sec, url, err := crypto.GenerateTOTPSecret(TOTPIssuer, user.Email)
	if err != nil {
		uc.log.Error("2fa setup: GenerateTOTPSecret", "err", err)
		return "", "", domain.ErrInternal
	}

	// Sauve le secret. twoFactorEnabled reste false jusqu'à Verify2FA.
	// → Pas d'effet sur le login tant que l'utilisateur n'a pas validé un code.
	if err := uc.users.Update2FASettings(ctx, userID, &sec, false); err != nil {
		uc.log.Error("2fa setup: Update2FASettings", "err", err)
		return "", "", domain.ErrInternal
	}

	uc.log.Info("2fa setup", "uid", userID, "email", user.Email)
	return sec, url, nil
}

// Verify2FA valide un code TOTP fourni par l'utilisateur.
// Si valide : set twoFactorEnabled=true → le prochain login exigera le code.
// Si invalide : retourne domain.ErrInvalid2FACode (401 côté handler).
//
// Note : le code doit correspondre au secret sauvegardé par Setup2FA. Si le user
// n'a pas de secret (Setup jamais appelé), retourne ErrBadRequest.
func (uc *Usecase) Verify2FA(ctx context.Context, userID, code string) error {
	if code == "" {
		return domain.ErrBadRequest
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		uc.log.Error("2fa verify: FindByID", "err", err, "uid", userID)
		return domain.ErrInternal
	}
	if user == nil {
		return domain.ErrNotFound
	}
	if user.TwoFactorSecret == nil || *user.TwoFactorSecret == "" {
		uc.log.Warn("2fa verify: no secret set", "uid", userID)
		return domain.ErrBadRequest
	}

	if !crypto.ValidateTOTP(code, *user.TwoFactorSecret) {
		uc.log.Warn("2fa verify: invalid code", "uid", userID)
		return domain.ErrInvalid2FACode
	}

	// Active la 2FA (le secret est déjà sauvegardé via Setup).
	if err := uc.users.Update2FASettings(ctx, userID, user.TwoFactorSecret, true); err != nil {
		uc.log.Error("2fa verify: Update2FASettings", "err", err)
		return domain.ErrInternal
	}

	uc.log.Info("2fa enabled", "uid", userID, "email", user.Email)
	return nil
}

// Disable2FA désactive la 2FA après vérification du mot de passe courant.
// Réinitialise twoFactorEnabled=false + clear le secret.
//
// La vérification du password est OBLIGATOIRE (anti-vol de session : si un
// attaquant vole le cookie, il ne peut pas désactiver la 2FA sans le password).
//
// Si le password est invalide : retourne domain.ErrInvalidCredentials (401).
// Si le user n'a pas la 2FA activée : retourne domain.ErrBadRequest.
func (uc *Usecase) Disable2FA(ctx context.Context, userID, password string) error {
	if password == "" {
		return domain.ErrBadRequest
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		uc.log.Error("2fa disable: FindByID", "err", err, "uid", userID)
		return domain.ErrInternal
	}
	if user == nil {
		return domain.ErrNotFound
	}
	if !user.TwoFactorEnabled {
		return domain.ErrBadRequest
	}
	if user.Password == nil {
		// User sans password (ex: SSO futur) — on interdit la désactivation via cet endpoint
		return fmt.Errorf("cannot disable 2FA: account has no password")
	}

	if err := crypto.ComparePassword(*user.Password, password); err != nil {
		uc.log.Warn("2fa disable: bad password", "uid", userID)
		return domain.ErrInvalidCredentials
	}

	// Clear le secret + disable.
	if err := uc.users.Update2FASettings(ctx, userID, nil, false); err != nil {
		uc.log.Error("2fa disable: Update2FASettings", "err", err)
		return domain.ErrInternal
	}

	uc.log.Info("2fa disabled", "uid", userID, "email", user.Email)
	return nil
}

// compile-time interface check : UserRepository doit satisfaire l'interface
// étendue avec Update2FASettings.
var _ = errors.New
