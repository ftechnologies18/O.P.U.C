// Command update_rls_saas — met à jour les policies RLS pour le support SaaS.
//
// Objectifs :
//   1. Créer la fonction app_has_support_access(tenant_id text) qui vérifie s'il
//      existe un SupportAccess AUTORISE non expiré pour le super_admin courant +
//      le tenant donné. Utilisée par les policies des tables tenant-scoped pour
//      autoriser l'accès SUPER_ADMIN via consentement explicite du GERANT.
//   2. Activer RLS + créer tenant_isolation policies sur SupportAccess et Subscription
//      (policy standard : app_is_super_admin() OR "entrepriseId" = app_current_tenant()).
//   3. RESTREINDRE SUPER_ADMIN sur les tables métier (Chantier, User, Client, etc.) :
//      remplacer `app_is_super_admin() OR` par `app_has_support_access("entrepriseId") OR`.
//      → SUPER_ADMIN ne peut accéder à un tenant QUE via un SupportAccess actif.
//   4. Garder `app_is_super_admin() OR` sur les tables plateforme :
//      Entreprise, SystemSetting, PermissionConfig, InvitationToken.
//
// IMPORTANT : pour que app_has_support_access fonctionne, le backend doit setter
// `app.user_id` dans chaque transaction WithTenant (cf. database/tenant.go).
//
// Usage :
//   export MIGRATIONS_URL="postgresql://postgres.xxx:..."
//   go run ./cmd/update_rls_saas
package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// tenantTablesRestricted — tables où SUPER_ADMIN doit passer par SupportAccess.
// (toutes les tables métier tenant-scoped SAUF les tables plateforme)
var tenantTablesRestricted = []string{
	"Chantier", "User", "Client", "Journalier", "SousTraitant", "Equipement",
	"Devis", "Contrat", "Facture", "TicketSupport", "AuditLog",
}

// platformTables — tables où SUPER_ADMIN garde un bypass direct (gestion plateforme).
var platformTables = []string{
	"Entreprise", "SystemSetting", "PermissionConfig", "InvitationToken",
}

// saasTables — nouvelles tables SaaS (SupportAccess + Subscription).
// Policy standard tenant_isolation : app_is_super_admin() OR entrepriseId = current_tenant.
var saasTables = []string{
	"SupportAccess", "Subscription",
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
	fmt.Println("  O.P.U.C — Update RLS for SaaS (SupportAccess)")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println()

	// ── 1. Helper functions ─────────────────────────────────────────
	fmt.Println("-- Creating/updating helper functions --")
	helperStmts := []string{
		// app_current_tenant() — retourne l'ID du tenant courant (NULL si non set)
		`CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text AS $$
	SELECT NULLIF(current_setting('app.current_tenant', true), '')::text;
$$ LANGUAGE sql STABLE`,

		// app_is_super_admin() — true si le user courant est SUPER_ADMIN
		`CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
	SELECT COALESCE(current_setting('app.user_role', true), '') = 'SUPER_ADMIN';
$$ LANGUAGE sql STABLE`,

		// app_current_user_id() — retourne l'ID du user courant (NULL si non set)
		// Nécessaire pour app_has_support_access (filtre par superAdminId).
		`CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text AS $$
	SELECT NULLIF(current_setting('app.user_id', true), '')::text;
$$ LANGUAGE sql STABLE`,

		// app_has_support_access(tenant_id text) — true si le super_admin courant
		// a un SupportAccess AUTORISE non expiré pour le tenant donné.
		//
		// Logique :
		//   - Si pas SUPER_ADMIN → false (les non-super-admin n'ont pas besoin de support access)
		//   - Si SUPER_ADMIN mais pas de user_id → false (config incomplète)
		//   - Sinon : EXISTS un SupportAccess où superAdminId = user_id AND
		//     entrepriseId = tenant_id AND statut = 'AUTORISE' AND (expireLe IS NULL OR expireLe > NOW())
		`CREATE OR REPLACE FUNCTION app_has_support_access(tenant_id text) RETURNS boolean AS $$
	SELECT
		CASE
			WHEN NOT app_is_super_admin() THEN false
			WHEN app_current_user_id() IS NULL THEN false
			ELSE EXISTS (
				SELECT 1 FROM "SupportAccess" sa
				WHERE sa."superAdminId" = app_current_user_id()
				  AND sa."entrepriseId" = tenant_id
				  AND sa.statut = 'AUTORISE'
				  AND (sa."expireLe" IS NULL OR sa."expireLe" > NOW())
			)
		END;
$$ LANGUAGE sql STABLE`,
	}
	for _, s := range helperStmts {
		if err := db.Exec(s).Error; err != nil {
			fmt.Printf("  WARN: %v\n", err)
		}
	}
	fmt.Println("  OK helper functions created (app_current_tenant, app_is_super_admin,")
	fmt.Println("     app_current_user_id, app_has_support_access)")

	// ── 2. RLS + policies sur SupportAccess et Subscription ─────────
	fmt.Println()
	fmt.Println("-- Enabling RLS + policies on SaaS tables (SupportAccess, Subscription) --")
	for _, t := range saasTables {
		db.Exec(fmt.Sprintf(`ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY`, t))
		db.Exec(fmt.Sprintf(`ALTER TABLE "%s" FORCE ROW LEVEL SECURITY`, t))
		db.Exec(fmt.Sprintf(`DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"`, t, t))
		// Policy standard tenant_isolation (SUPER_ADMIN bypass)
		policySQL := fmt.Sprintf(
			`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL `+
				`USING (app_is_super_admin() OR "entrepriseId" = app_current_tenant()) `+
				`WITH CHECK (app_is_super_admin() OR "entrepriseId" = app_current_tenant())`,
			t, t,
		)
		if err := db.Exec(policySQL).Error; err != nil {
			fmt.Printf("  FAIL %s: %v\n", t, err)
		} else {
			fmt.Printf("  OK   %s\n", t)
		}
	}

	// ── 3. RESTREINDRE SUPER_ADMIN sur les tables métier ────────────
	// Policy : USING (app_has_support_access("entrepriseId") OR "entrepriseId" = app_current_tenant())
	// → SUPER_ADMIN n'accède à un tenant QUE via SupportAccess actif
	fmt.Println()
	fmt.Println("-- Restricting SUPER_ADMIN on tenant-scoped tables (require SupportAccess) --")
	for _, t := range tenantTablesRestricted {
		db.Exec(fmt.Sprintf(`DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"`, t, t))
		policySQL := fmt.Sprintf(
			`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL `+
				`USING (app_has_support_access("entrepriseId") OR "entrepriseId" = app_current_tenant()) `+
				`WITH CHECK (app_has_support_access("entrepriseId") OR "entrepriseId" = app_current_tenant())`,
			t, t,
		)
		if err := db.Exec(policySQL).Error; err != nil {
			fmt.Printf("  FAIL %s: %v\n", t, err)
		} else {
			fmt.Printf("  OK   %s (SUPER_ADMIN requires SupportAccess)\n", t)
		}
	}

	// ── 4. Garder app_is_super_admin() sur les tables plateforme ───
	// (Entreprise, SystemSetting, PermissionConfig, InvitationToken)
	fmt.Println()
	fmt.Println("-- Keeping app_is_super_admin() bypass on platform tables --")
	for _, t := range platformTables {
		db.Exec(fmt.Sprintf(`DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"`, t, t))
		var policySQL string
		if t == "Entreprise" {
			// Entreprise : filtre par id (le tenant EST l'entreprise)
			policySQL = fmt.Sprintf(
				`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL `+
					`USING (app_is_super_admin() OR id = app_current_tenant()) `+
					`WITH CHECK (app_is_super_admin())`,
				t, t,
			)
		} else {
			// SystemSetting, PermissionConfig, InvitationToken : tenant_isolation standard
			policySQL = fmt.Sprintf(
				`CREATE POLICY "%s_tenant_isolation" ON "%s" FOR ALL `+
					`USING (app_is_super_admin() OR "entrepriseId" = app_current_tenant()) `+
					`WITH CHECK (app_is_super_admin() OR "entrepriseId" = app_current_tenant())`,
				t, t,
			)
		}
		if err := db.Exec(policySQL).Error; err != nil {
			fmt.Printf("  FAIL %s: %v\n", t, err)
		} else {
			fmt.Printf("  OK   %s (SUPER_ADMIN bypass kept)\n", t)
		}
	}

	// ── 5. Vérification ─────────────────────────────────────────────
	fmt.Println()
	fmt.Println("-- Verification (RLS-enabled tables + policies) --")
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
	fmt.Println("  RLS update for SaaS completed")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("IMPORTANT : pour que app_has_support_access fonctionne, le backend")
	fmt.Println("doit setter 'app.user_id' dans chaque transaction WithTenant.")
	fmt.Println("Voir internal/infrastructure/database/tenant.go (set_config 'app.user_id').")
}
