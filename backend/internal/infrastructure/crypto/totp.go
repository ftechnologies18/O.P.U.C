// Package crypto — totp.go
// 2FA TOTP (Time-based One-Time Password) — équivalent à src/lib/two-factor.ts.
// Utilisé pour la 2FA des users O.P.U.C.
package crypto

import (
	"fmt"

	"github.com/pquerna/otp/totp"
)

// GenerateTOTPSecret génère un secret TOTP + URL otpauth pour QR code.
// issuer = "O.P.U.C", account = email user.
func GenerateTOTPSecret(issuer, account string) (secret string, url string, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: account,
	})
	if err != nil {
		return "", "", fmt.Errorf("generate totp: %w", err)
	}
	return key.Secret(), key.URL(), nil
}

// ValidateTOTP valide un code TOTP (6 chiffres) contre un secret.
func ValidateTOTP(code, secret string) bool {
	return totp.Validate(code, secret)
}
