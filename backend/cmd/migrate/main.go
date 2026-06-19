// Command migrate — applique les migrations SQL RLS sur Supabase.
//
// Usage :
//   export MIGRATIONS_URL="postgresql://postgres.oiruwlbvfmlvhbarjnlr:..."
//   go run ./cmd/migrate
package main

import (
	"fmt"
	"log"
	"log/slog"
	"os"
	"path/filepath"

	"opuc/internal/infrastructure/database"
)

func main() {
	migrationsURL := os.Getenv("MIGRATIONS_URL")
	if migrationsURL == "" {
		log.Fatal("MIGRATIONS_URL not set")
	}

	slogLog := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))

	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  O.P.U.C — SQL Migrations Runner")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Printf("  Connection: %s\n", maskURL(migrationsURL))
	fmt.Println()

	dbm, err := database.New(migrationsURL, migrationsURL, slogLog)
	if err != nil {
		log.Fatalf("database init: %v", err)
	}
	defer dbm.Close()

	migrationsDir := filepath.Join(".", "migrations")
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		log.Fatalf("migrations dir not found: %s", migrationsDir)
	}

	if err := dbm.RunSQLMigrations(migrationsDir, slogLog); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  ✅ Migrations appliquées avec succès")
	fmt.Println("══════════════════════════════════════════════════════════════")
}

func maskURL(url string) string {
	atIdx := -1
	for i := 0; i < len(url); i++ {
		if url[i] == '@' {
			atIdx = i
			break
		}
	}
	if atIdx < 0 {
		return url
	}
	protoEnd := -1
	for i := 0; i < len(url)-2; i++ {
		if url[i] == ':' && url[i+1] == '/' && url[i+2] == '/' {
			protoEnd = i + 3
			break
		}
	}
	if protoEnd < 0 {
		return url
	}
	return url[:protoEnd] + "***:***@" + url[atIdx+1:]
}
