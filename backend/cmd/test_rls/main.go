// Command test_rls — teste l'isolation Row-Level Security.
package main

import (
	"fmt"
	"log"
	"gorm.io/gorm/logger"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {

	postgresURL := os.Getenv("MIGRATIONS_URL")
	appUserURL := "postgresql://app_user.oiruwlbvfmlvhbarjnlr:opuc_app_user_dev_2025@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  O.P.U.C — RLS Isolation Test")
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println()

	// Test 1
	fmt.Println("── Test 1: app_user connection ──")
	appDB, err := gorm.Open(postgres.Open(appUserURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatalf("❌ app_user connection failed: %v", err)
	}
	fmt.Println("✅ app_user connected successfully")

	// Test 2
	fmt.Println()
	fmt.Println("── Test 2: app_user WITHOUT set_config (should see 0 rows) ──")
	var count int64
	appDB.Raw(`SELECT COUNT(*) FROM "User"`).Scan(&count)
	fmt.Printf("   Users visible without tenant context: %d (expected 0)\n", count)
	if count == 0 {
		fmt.Println("   ✅ RLS blocks all rows when no tenant set")
	} else {
		fmt.Printf("   ❌ FAIL: expected 0, got %d\n", count)
	}

	// Test 3
	pgDB, _ := gorm.Open(postgres.Open(postgresURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	var gerantEntID string
	pgDB.Raw(`SELECT "entrepriseId" FROM "User" WHERE email='gerant@opuc.demo'`).Scan(&gerantEntID)
	fmt.Println()
	fmt.Printf("── Test 3: app_user WITH set_config(gerant tenant=%s) ──\n", gerantEntID)

	var tenantCount int64
	appDB.Transaction(func(tx *gorm.DB) error {
		tx.Exec("SELECT set_config('app.current_tenant', ?, true)", gerantEntID)
		tx.Exec("SELECT set_config('app.user_role', 'GERANT', true)")
		tx.Raw(`SELECT COUNT(*) FROM "User"`).Scan(&tenantCount)
		type U struct{ Email, Role string }
		var users []U
		tx.Raw(`SELECT email, role FROM "User"`).Scan(&users)
		fmt.Printf("   Users visible with tenant context: %d\n", tenantCount)
		for _, u := range users {
			fmt.Printf("     → %s (%s)\n", u.Email, u.Role)
		}
		return nil
	})
	if tenantCount > 0 && tenantCount < 4 {
		fmt.Println("   ✅ RLS correctly isolates tenant data")
	} else {
		fmt.Printf("   ❌ FAIL: expected 1-3 (tenant only), got %d\n", tenantCount)
	}

	// Test 4
	fmt.Println()
	fmt.Println("── Test 4: app_user WITH role=SUPER_ADMIN (should see all) ──")
	var adminCount int64
	appDB.Transaction(func(tx *gorm.DB) error {
		tx.Exec("SELECT set_config('app.user_role', 'SUPER_ADMIN', true)")
		tx.Raw(`SELECT COUNT(*) FROM "User"`).Scan(&adminCount)
		return nil
	})
	fmt.Printf("   Users visible as SUPER_ADMIN: %d (expected 4)\n", adminCount)
	if adminCount == 4 {
		fmt.Println("   ✅ SUPER_ADMIN bypass works correctly")
	} else {
		fmt.Printf("   ❌ FAIL: expected 4, got %d\n", adminCount)
	}

	// Test 5
	fmt.Println()
	fmt.Println("── Test 5: postgres superuser (native bypass) ──")
	var pgCount int64
	pgDB.Raw(`SELECT COUNT(*) FROM "User"`).Scan(&pgCount)
	fmt.Printf("   Users visible as postgres: %d (expected 4)\n", pgCount)
	if pgCount == 4 {
		fmt.Println("   ✅ postgres superuser bypass works")
	} else {
		fmt.Printf("   ❌ FAIL: expected 4, got %d\n", pgCount)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════════════════")
	fmt.Println("  RLS isolation test complete")
	fmt.Println("══════════════════════════════════════════════════════════════")
}
