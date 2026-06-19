// Package gorm — dashboard_repo.go
// Repository pour les KPIs du dashboard (Phase 2).
//
// Toutes les méthodes utilisent WithTenant pour le filtrage RLS.
// Tables sans RLS direct (JournalierAffectation, Pointage, Tache, StockMateriel) :
// on filtre via JOIN sur Chantier (qui est RLS-protected).
//
// Note : CountUnreadNotifications utilise la connexion Migrations (bypass RLS)
// car les notifications sont user-scoped (pas d'entrepriseId). Le repo accepte
// aussi la connexion Runtime pour les autres méthodes.
package gorm

import (
        "context"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/dashboard"

        "gorm.io/gorm"
)

// DashboardRepository — repository tenant-scoped pour les KPIs dashboard.
//
// Champs :
//   - db       : Runtime (app_user, RLS enforced) — pour toutes les méthodes tenant-scoped
//   - notifDB  : Migrations (postgres, bypass RLS) — pour CountUnreadNotifications (user-scoped)
type DashboardRepository struct {
        db      *gorm.DB
        notifDB *gorm.DB
}

// NewDashboardRepository constructeur.
// runtimeDB = dbm.Runtime (RLS)
// Pour CountUnreadNotifications, le repo utilise la connexion Migrations.
// On l'attache via WithMigrations() (cf. main.go).
func NewDashboardRepository(runtimeDB *gorm.DB) *DashboardRepository {
        return &DashboardRepository{db: runtimeDB}
}

// WithMigrations attache la connexion Migrations (bypass RLS) pour les
// notifications (user-scoped). Retourne le receiver pour chaînage.
func (r *DashboardRepository) WithMigrations(migDB *gorm.DB) *DashboardRepository {
        r.notifDB = migDB
        return r
}

// compile-time check : DashboardRepository implémente dashboard.Repo.
var _ dashboard.Repo = (*DashboardRepository)(nil)

// CountChantiersByStatut — agrège les chantiers par statut.
// Mêmes clés que ChantierRepository.CountByStatut (total, EN_COURS, etc.).
func (r *DashboardRepository) CountChantiersByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error) {
        type row struct {
                Statut string
                Count  int64
        }
        var rows []row
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Chantier{}).
                        Select("statut, COUNT(*) as count").
                        Group("statut").
                        Scan(&rows).Error
        })
        if err != nil {
                return nil, err
        }

        out := map[string]int64{
                "total":          0,
                "EN_COURS":       0,
                "EN_PREPARATION": 0,
                "TERMINE":        0,
        }
        for _, r := range rows {
                out["total"] += r.Count
                switch r.Statut {
                case "EN_COURS":
                        out["EN_COURS"] += r.Count
                case "EN_PREPARATION":
                        out["EN_PREPARATION"] += r.Count
                case "TERMINE", "RECEPTIONNE":
                        out["TERMINE"] += r.Count
                }
        }
        return out, nil
}

// CountJournaliersActive — count JournalierAffectation où actif=true.
// RLS via JOIN sur Chantier.
func (r *DashboardRepository) CountJournaliersActive(ctx context.Context, auth *database.AuthUser) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.JournalierAffectation{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
                        Where(`"JournalierAffectation".actif = true`).
                        Count(&n).Error
        })
        return n, err
}

// CountPointagesToday — count Pointage où dateTravail = aujourd'hui (UTC, début de journée).
// RLS via JOIN sur Chantier.
func (r *DashboardRepository) CountPointagesToday(ctx context.Context, auth *database.AuthUser) (int64, error) {
        now := time.Now().UTC()
        startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Pointage{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
                        Where(`"Pointage"."dateTravail" = ?`, startOfDay).
                        Count(&n).Error
        })
        return n, err
}

// CountTachesEnRetard — count Tache où statut='EN_RETARD'.
// RLS via JOIN sur Phase → Chantier.
func (r *DashboardRepository) CountTachesEnRetard(ctx context.Context, auth *database.AuthUser) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Tache{}).
                        Joins(`JOIN "Phase" ON "Phase".id = "Tache"."phaseId"`).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Tache".statut = ?`, "EN_RETARD").
                        Count(&n).Error
        })
        return n, err
}

// CountUnreadNotifications — count Notification où userId=? AND lu=false.
// User-scoped (pas de tenant). Utilise la connexion Migrations (bypass RLS).
//
// Note : cette méthode n'utilise PAS WithTenant car les notifications sont
// user-scoped. Si notifDB est nil (WithMigrations non appelé), on fallback
// sur db (Runtime) — ça peut échouer si RLS est activé sur Notification.
func (r *DashboardRepository) CountUnreadNotifications(ctx context.Context, auth *database.AuthUser, userID string) (int64, error) {
        conn := r.notifDB
        if conn == nil {
                conn = r.db
        }
        var n int64
        err := conn.WithContext(ctx).
                Model(&model.Notification{}).
                Where(`"userId" = ? AND lu = false`, userID).
                Count(&n).Error
        return n, err
}

// CountStockAlerts — count StockMateriel où seuilAlerte > 0 (simplifié Phase 2).
// Le calcul complet (sum entrees - sum sorties <= seuilAlerte) est prévu en Phase 3.
// RLS via JOIN sur Chantier (INNER JOIN : exclut stock sans chantierId).
func (r *DashboardRepository) CountStockAlerts(ctx context.Context, auth *database.AuthUser) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.StockMateriel{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "StockMateriel"."chantierId"`).
                        Where(`"StockMateriel"."seuilAlerte" > 0`).
                        Count(&n).Error
        })
        return n, err
}

// GetBudgetData — pour chaque chantier : id, nom, budgetPrevisionnel, statut, coutReel=0.
// Phase 2 simplifié : coutReel = 0 (le calcul complet avec Pointage est prévu en Phase 3).
// RLS automatique via Chantier (RLS-protected).
//
// On query model.Chantier (qui a les tags gorm column: camelCase corrects) puis
// on convertit vers dashboard.BudgetItem, car BudgetItem n'a pas de tags gorm
// (le usecase ne doit pas dépendre de l'ORM). Sans ça, GORM mapperait
// BudgetPrevisionnel → "budget_previsionnel" (snake_case) au lieu de
// "budgetPrevisionnel" (camelCase Prisma), et le Scan échouerait silencieusement.
func (r *DashboardRepository) GetBudgetData(ctx context.Context, auth *database.AuthUser) ([]dashboard.BudgetItem, error) {
        var chantiers []model.Chantier
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                if err := tx.Model(&model.Chantier{}).
                        Select(`id, nom, "budgetPrevisionnel", statut`).
                        Find(&chantiers).Error; err != nil {
                        return fmt.Errorf("get budget data: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, err
        }

        // Conversion model.Chantier → dashboard.BudgetItem
        // coutReel = 0 (Phase 2 simplifié)
        items := make([]dashboard.BudgetItem, 0, len(chantiers))
        for i := range chantiers {
                c := &chantiers[i]
                items = append(items, dashboard.BudgetItem{
                        ID:                 c.ID,
                        Nom:                c.Nom,
                        BudgetPrevisionnel: c.BudgetPrevisionnel,
                        CoutReel:           0,
                        Statut:             c.Statut,
                })
        }
        return items, nil
}
