// Package jwt — signer.go
// Émet et valide les JWT pour l'authentification stateless.
package jwt

import (
        "errors"
        "fmt"
        "time"

        jwtlib "github.com/golang-jwt/jwt/v5"
)

// Claims — payload du JWT (court, pas de données sensibles).
type Claims struct {
        UserID        string `json:"uid"`
        Email         string `json:"email"`
        Role          string `json:"role"`
        EntrepriseID  string `json:"tid"` // tenant id
        TwoFAVerified bool   `json:"2fa"`
        IsCoGerant    bool   `json:"cg"` // true si co-gérant (mêmes droits que GERANT sauf promote/demote)
        jwtlib.RegisteredClaims
}

// Signer émet et vérifie les JWT.
type Signer struct {
        secret       []byte
        expirationH  int
}

// New crée un signer.
func New(secret string, expirationHours int) *Signer {
        return &Signer{
                secret:      []byte(secret),
                expirationH: expirationHours,
        }
}

// Sign émet un JWT signé.
func (s *Signer) Sign(c Claims) (string, error) {
        now := time.Now()
        c.IssuedAt = jwtlib.NewNumericDate(now)
        c.ExpiresAt = jwtlib.NewNumericDate(now.Add(time.Duration(s.expirationH) * time.Hour))
        c.NotBefore = jwtlib.NewNumericDate(now)

        token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, c)
        return token.SignedString(s.secret)
}

// Verify valide un JWT et retourne les claims.
func (s *Signer) Verify(tokenString string) (*Claims, error) {
        token, err := jwtlib.ParseWithClaims(tokenString, &Claims{}, func(t *jwtlib.Token) (interface{}, error) {
                if _, ok := t.Method.(*jwtlib.SigningMethodHMAC); !ok {
                        return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
                }
                return s.secret, nil
        })
        if err != nil {
                return nil, err
        }

        claims, ok := token.Claims.(*Claims)
        if !ok || !token.Valid {
                return nil, errors.New("invalid token")
        }
        return claims, nil
}

// Expiration retourne la durée d'expiration (pour set cookie MaxAge).
func (s *Signer) Expiration() time.Duration {
        return time.Duration(s.expirationH) * time.Hour
}
