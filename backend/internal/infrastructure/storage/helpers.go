// Package storage — helpers (génération d'IDs aléatoires).
package storage

import (
	"crypto/rand"
	"encoding/hex"
)

// randHex génère une chaîne hexadécimale aléatoire de n bytes (2n chars).
func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
