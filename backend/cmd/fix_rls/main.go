// Command fix_rls — désactive RLS sur les tables qui n'ont pas de policy.
package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dsn := os.Getenv("MIGRATIONS_URL")
	if dsn == "" {
		log.Fatal("MIGRATIONS_URL not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  O.P.U.C — Fix RLS (disable on tables without policy)")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println()

	type Row struct{ Table string }
	var noPolicy []Row
	db.Raw(`
		SELECT t.tablename as "Table" FROM pg_tables t
		WHERE t.schemaname='public' AND t.rowsecurity=true
		AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename=t.tablename)
		ORDER BY t.tablename
	`).Scan(&noPolicy)

	fmt.Printf("Tables with RLS but NO policy (%d) — disabling RLS:\n", len(noPolicy))
	for _, r := range noPolicy {
		if err := db.Exec(fmt.Sprintf(`ALTER TABLE "%s" DISABLE ROW LEVEL SECURITY`, r.Table)).Error; err != nil {
			fmt.Printf("  FAIL %s: %v\n", r.Table, err)
		} else {
			fmt.Printf("  OK   %s\n", r.Table)
		}
	}

	var stillRLS []Row
	db.Raw(`SELECT tablename as "Table" FROM pg_tables WHERE schemaname='public' AND rowsecurity=true ORDER BY tablename`).Scan(&stillRLS)
	fmt.Println()
	fmt.Printf("Tables still with RLS (have policies): %d\n", len(stillRLS))
	for _, r := range stillRLS {
		fmt.Printf("  %s\n", r.Table)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  RLS fix completed")
	fmt.Println("══════════════════════════════════════════════════════════════")
}
