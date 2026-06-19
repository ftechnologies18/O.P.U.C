// Package crypto — bcrypt.go
// Hashage de mots de passe (bcrypt) — équivalent à src/lib/password.ts côté Next.js.
package crypto

import "golang.org/x/crypto/bcrypt"

// HashPassword hashe un mot de passe en clair (cost 10 = équivalent bcryptjs).
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// ComparePassword compare un hash bcrypt avec un mot de passe en clair.
// Retourne nil si match, une erreur sinon.
func ComparePassword(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
