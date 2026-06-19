// Package middleware — utils.go (uuid simple pour X-Request-ID)
package middleware

import (
	"crypto/rand"
	"encoding/hex"
)

// uuid génère un ID aléatoire hex (32 chars, suffisant pour X-Request-ID).
func uuid() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
