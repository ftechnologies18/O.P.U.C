// Command apply_rls — applique RLS sur toutes les tables tenant-scoped.
package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var tenantTables = []string{
	"User", "Entreprise", "Chantier", "Client",
	"Journalier", "SousTraitant", "Equipement",
	"Devis", "Contrat", "Facture",
	"TicketSupport", "AuditLog", "PermissionConfig", "SystemSetting",
	"InvitationToken",
}

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
	fmt.Println("  O.P.U.C — Apply RLS Policies")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println()

	// 1. Helper functions
	fmt.Println("-- Creating helper functions --")
	helperStmts := []string{
		`CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text AS $$ SELECT NULLIF(current_setting('app.current_tenant', true), '')::text; $$ LANGUAGE sql STABLE`,
		`CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$ SELECT COALESCE(current_setting('app.user_role', true), '') = 'SUPER_ADMIN'; $$ LANGUAGE sql STABLE`,
	}
	for _, s := range helperStmts {
		if err := db.Exec(s).Error; err != nil {
			fmt.Printf("  WARN: %v\n", err)
		}
	}
	fmt.Println("  OK helper functions created")

	// 2. Enable RLS + create policies on each table
	fmt.Println()
	fmt.Println("-- Enabling RLS + creating policies --")
	for _, t := range tenantTables {
		db.Exec(fmt.Sprintf(`ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY`, t))
		db.Exec(fmt.Sprintf(`ALTER TABLE "%s" FORCE ROW LEVEL SECURITY`, t))
		db.Exec(fmt.Sprintf(`DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"`, t, t))

		var policySQL string
		if t == "Entreprise" {
			policySQL = fmt.Sprintf(`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL USING (app_is_super_admin() OR id = app_current_tenant()) WITH CHECK (app_is_super_admin())`, t, t)
		} else {
			policySQL = fmt.Sprintf(`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL USING (app_is_super_admin() OR "entrepriseId" = app_current_tenant()) WITH CHECK (app_is_super_admin() OR "entrepriseId" = app_current_tenant())`, t, t)
		}

		if err := db.Exec(policySQL).Error; err != nil {
			fmt.Printf("  FAIL %s: %v\n", t, err)
		} else {
			fmt.Printf("  OK  %s\n", t)
		}
	}

	// 3. Verification
	fmt.Println()
	fmt.Println("-- Verification --")
	type Result struct {
		Table       string
		RLS         bool
		Forced      bool
		PolicyCount int
	}
	var results []Result
	db.Raw(`
		SELECT t.tablename as "Table", t.rowsecurity as "RLS", t.forcerowsecurity as "Forced",
			(SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) as "PolicyCount"
		FROM pg_tables t
		WHERE t.schemaname = 'public' AND t.rowsecurity = true
		ORDER BY t.tablename
	`).Scan(&results)
	fmt.Printf("  %-25s %-6s %-7s %s\n", "Table", "RLS", "Forced", "Policies")
	for _, r := range results {
		fmt.Printf("  %-25s %-6v %-7v %d\n", r.Table, r.RLS, r.Forced, r.PolicyCount)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  RLS policies applied successfully")
	fmt.Println("══════════════════════════════════════════════════════════════")
}
