// O.P.U.C — Backend API Go (Phase 0)
//
// Point d'entrée. Wire les couches (Clean Architecture) :
//
//      config → database (pgx/GORM) → repositories → usecases → handlers → router
//
// Démarrage : go run . (port 8080 par défaut)
package main

import (
        "context"
        "fmt"
        "log/slog"
        "net/http"
        "os"
        "os/signal"
        "syscall"
        "time"

        "opuc/internal/config"
        apphttp "opuc/internal/delivery/http"
        "opuc/internal/delivery/http/handler"
        "opuc/internal/infrastructure/crypto"
        "opuc/internal/infrastructure/database"
        appjwt "opuc/internal/infrastructure/jwt"
        "opuc/internal/infrastructure/storage"
        "opuc/internal/repository/gorm"
        "opuc/internal/usecase/admin"
        "opuc/internal/usecase/auth"
        "opuc/internal/usecase/carburant"
        "opuc/internal/usecase/chantier"
        "opuc/internal/usecase/client"
        "opuc/internal/usecase/contrat"
        "opuc/internal/usecase/dashboard"
        "opuc/internal/usecase/delegation"
        "opuc/internal/usecase/devis"
        "opuc/internal/usecase/document"
        "opuc/internal/usecase/facturation"
        "opuc/internal/usecase/iam"
        "opuc/internal/usecase/notification"
        "opuc/internal/usecase/paie"
        "opuc/internal/usecase/phase"
        "opuc/internal/usecase/pointage"
        "opuc/internal/usecase/soustraitant"
        "opuc/internal/usecase/stock"
        "opuc/internal/usecase/support"
        "opuc/internal/usecase/sync"
)

const version = "0.1.0"

func main() {
        // ── 1. Config ───────────────────────────────────────────────
        cfg, err := config.Load()
        if err != nil {
                fmt.Fprintf(os.Stderr, "[FATAL] config: %v\n", err)
                os.Exit(1)
        }

        // ── 2. Logger structuré (slog) ──────────────────────────────
        log := newLogger(cfg)
        log.Info("starting O.P.U.C API",
                "version", version,
                "env", cfg.Env,
                "port", cfg.Port,
        )

        // ── 3. Database (GORM + pgx, 2 connexions : runtime + migrations)
        dbm, err := database.New(cfg.DatabaseURL, cfg.MigrationsURL, log)
        if err != nil {
                log.Error("database init failed", "err", err)
                os.Exit(1)
        }
        defer dbm.Close()

        // AutoMigrate DÉSACTIVÉ : les tables Prisma (PascalCase) existent déjà.
        // GORM AutoMigrate créerait des tables snake_case vides qui écraseraient les données.
        // En Phase 6 (bascule complète Go), on migrera le schéma vers golang-migrate.
        // if cfg.Env != "production" {
        //      if err := dbm.AutoMigrate(log); err != nil {
        //              log.Error("automigrate failed", "err", err)
        //              os.Exit(1)
        //      }
        // }

        // ── 4. Infrastructure ───────────────────────────────────────
        signer := appjwt.New(cfg.JWTSecret, cfg.JWTExpirationHours)
        _ = crypto.HashPassword // garde l'import pour usage futur

        // ── 5. Repositories ─────────────────────────────────────────
        // UserRepository utilise DEUX connexions :
        //   - Migrations (postgres, bypass RLS) : pour login flow (FindByEmail, FindByID,
        //     UpdateLastLogin, Update2FASettings) → login se fait avant contexte tenant.
        //   - Runtime (app_user, RLS enforced) : pour IAM CRUD (List, Create, Update…).
        //     Attachée via WithRuntime(dbm.Runtime).
        userRepo := gorm.NewUserRepository(dbm.Migrations).WithRuntime(dbm.Runtime)

        // Phase 2 — repositories lecture métier
        //   - ChantierRepository      : Runtime (RLS) — chantiers tenant-scoped
        //   - DashboardRepository     : Runtime (RLS) + Migrations (bypass RLS) pour notifications
        //   - NotificationRepository  : Migrations (bypass RLS) — notifications user-scoped
        //   - PermissionConfigRepository : Runtime (RLS) — permissions tenant-scoped
        //   - AuditLogRepository      : Runtime (RLS) — audit logs tenant-scoped
        chantierRepo := gorm.NewChantierRepository(dbm.Runtime)
        dashboardRepo := gorm.NewDashboardRepository(dbm.Runtime).WithMigrations(dbm.Migrations)
        notificationRepo := gorm.NewNotificationRepository(dbm.Migrations)
        permissionRepo := gorm.NewPermissionConfigRepository(dbm.Runtime)
        auditRepo := gorm.NewAuditLogRepository(dbm.Runtime)

        // Phase 3 — repositories write métier (tous Runtime, RLS enforced)
        //   - PointageRepository : pointages (filtrage tenant via JOIN Chantier)
        //   - PaieRepository     : PaiementHebdo (JOIN Chantier) + SalaireMensuel (JOIN Journalier)
        //   - StockRepository    : StockMateriel + EntreeStock + SortieStock (JOIN Chantier)
        //   - CarburantRepository: StockCarburant + EntreeCarburant + SortieCarburant +
        //                          BonAchatCarburant + ReleveCompteurEngin (JOIN Chantier)
        pointageRepo := gorm.NewPointageRepository(dbm.Runtime)
        paieRepo := gorm.NewPaieRepository(dbm.Runtime)
        stockRepo := gorm.NewStockRepository(dbm.Runtime)
        carburantRepo := gorm.NewCarburantRepository(dbm.Runtime)

        // Phase 4 — repositories commercial (tous Runtime, RLS enforced)
        //   - ClientRepository      : Client (RLS direct) + compteurs (chantiers/devis/factures)
        //   - DevisRepository       : Devis (RLS direct) + LigneDevis (JOIN Devis)
        //   - ContratRepository     : Contrat (RLS direct)
        //   - FacturationRepository : Facture (RLS direct) + PaiementFacture (JOIN Facture)
        clientRepo := gorm.NewClientRepository(dbm.Runtime)
        devisRepo := gorm.NewDevisRepository(dbm.Runtime)
        contratRepo := gorm.NewContratRepository(dbm.Runtime)
        facturationRepo := gorm.NewFacturationRepository(dbm.Runtime)

        // Phase 5 — repositories peripheral (tous Runtime, RLS enforced)
        //   - SousTraitantRepository : SousTraitant (RLS direct) + ContratST (JOIN SousTraitant)
        //   - DocumentRepository     : DocumentChantier/Photo/RapportJournalier (JOIN Chantier)
        //   - SupportRepository      : TicketSupport (RLS direct) + TicketMessage (JOIN TicketSupport)
        soustraitantRepo := gorm.NewSousTraitantRepository(dbm.Runtime)
        documentRepo := gorm.NewDocumentRepository(dbm.Runtime)
        supportRepo := gorm.NewSupportRepository(dbm.Runtime)

        // Phase 6 — repositories SaaS (tous Migrations, bypass RLS — usecase fait l'autorisation)
        //   - SupportAccessRepo    : demandes d'accès SUPER_ADMIN ↔ GERANT (cross-tenant)
        //   - SubscriptionRepo     : abonnements STARTER/PRO/ENTERPRISE (cross-tenant)
        //   - AdminEntrepriseRepo  : CRUD admin des tenants (SUPER_ADMIN only)
        supportAccessRepo := gorm.NewSupportAccessRepo(dbm.Migrations)
        subscriptionRepo := gorm.NewSubscriptionRepo(dbm.Migrations)
        adminEntrepriseRepo := gorm.NewAdminEntrepriseRepo(dbm.Migrations)

        // Phase 7 — repository délégation (Runtime + Migrations)
        //   - CRUD tenant-scoped via Runtime+WithTenant (Create, List, Get, Update, Revoke…)
        //   - Cross-tenant via Migrations pour GetActive (middleware), ExpireOld (cron),
        //     CountCoGerants / PromoteCoGerant / DemoteCoGerant / GetCoGerants / GetUserByID
        delegationRepo := gorm.NewDelegationRepository(dbm.Runtime, dbm.Migrations)

        // Phase 3 — repository Phase/Tache (Runtime, RLS enforced via JOIN Chantier)
        //   - Phase : pas de RLS direct, filtrage tenant via JOIN "Chantier"
        //   - Tache : filtrage tenant via JOIN "Phase" → JOIN "Chantier"
        phaseRepo := gorm.NewPhaseRepository(dbm.Runtime)

        // ── 6. Usecases ─────────────────────────────────────────────
        authUC := auth.NewUsecase(userRepo, signer, log)
        usersUC := iam.NewUsersUsecase(userRepo, log)
        chantierUC := chantier.NewUsecase(chantierRepo, log)
        dashboardUC := dashboard.NewUsecase(dashboardRepo, log)
        notificationUC := notification.NewUsecase(notificationRepo, log)
        permissionsUC := iam.NewPermissionsUsecase(permissionRepo, log)
        auditUC := iam.NewAuditLogUsecase(auditRepo, log)
        pointageUC := pointage.NewUsecase(pointageRepo, log)
        paieUC := paie.NewUsecase(paieRepo, log)
        stockUC := stock.NewUsecase(stockRepo, log)
        carburantUC := carburant.NewUsecase(carburantRepo, log)

        // Phase 4 — usecases commercial
        clientUC := client.NewUsecase(clientRepo, log)
        devisUC := devis.NewUsecase(devisRepo, log)
        contratUC := contrat.NewUsecase(contratRepo, log)
        facturationUC := facturation.NewUsecase(facturationRepo, log)

        // Phase 5 — usecases peripheral
        soustraitantUC := soustraitant.NewUsecase(soustraitantRepo, log)
        documentUC := document.NewUsecase(documentRepo, log)
        supportUC := support.NewUsecase(supportRepo, log)
        // syncUC injecte pointage/stock/carburant usecases pour dispatcher les mutations offline
        syncUC := sync.NewUsecase(pointageUC, stockUC, carburantUC, log)

        // Phase 6 — usecase SaaS (SupportAccess + Subscriptions + Admin Dashboard)
        saasUC := admin.NewUsecase(admin.SaaSRepos{
                SupportAccess:   supportAccessRepo,
                Subscription:    subscriptionRepo,
                AdminEntreprise: adminEntrepriseRepo,
        }, log)

        // Phase 7 — usecase délégation (delegations + co-gerants)
        delegationUC := delegation.NewUsecase(delegationRepo, log)

        // Phase 3 — usecase Phase/Tache (CRUD Phase/Tache + mes-taches)
        // Phase 4 : on injecte notificationUC pour les notifications d'assignation
        phaseUC := phase.NewUsecase(phaseRepo, log, notificationUC)

        // ── 7. Handlers ─────────────────────────────────────────────
        authHandler := handler.NewAuthHandler(authUC, signer, log)
        userHandler := handler.NewUserHandler(usersUC, log)
        twofaHandler := handler.NewTwoFAHandler(authUC, log)
        healthHandler := handler.NewHealthHandler()
        chantierHandler := handler.NewChantierHandler(chantierUC, log)
        dashboardHandler := handler.NewDashboardHandler(dashboardUC, log)
        notificationHandler := handler.NewNotificationHandler(notificationUC, log)
        permissionHandler := handler.NewPermissionHandler(permissionsUC, log)
        auditHandler := handler.NewAuditLogHandler(auditUC, log)
        pointageHandler := handler.NewPointageHandler(pointageUC, log)
        paieHandler := handler.NewPaieHandler(paieUC, log)
        stockHandler := handler.NewStockHandler(stockUC, log)
        carburantHandler := handler.NewCarburantHandler(carburantUC, log)

        // Phase 4 — handlers commercial
        clientHandler := handler.NewClientHandler(clientUC, log)
        devisHandler := handler.NewDevisHandler(devisUC, log)
        contratHandler := handler.NewContratHandler(contratUC, log)
        facturationHandler := handler.NewFacturationHandler(facturationUC, log)

        // Phase 5 — handlers peripheral
        soustraitantHandler := handler.NewSousTraitantHandler(soustraitantUC, log)
        documentHandler := handler.NewDocumentHandler(documentUC, log)
        supportHandler := handler.NewSupportHandler(supportUC, log)
        syncHandler := handler.NewSyncHandler(syncUC, log)

        // Phase 6 — handler SaaS (admin + support-access approval flow)
        saasHandler := handler.NewSaaSHandler(saasUC, log)

        // Phase 7 — handler délégation
        delegationHandler := handler.NewDelegationHandler(delegationUC, log)

        // Phase 3 — handler Phase/Tache (CRUD Phase/Tache + mes-taches)
        phaseHandler := handler.NewPhaseHandler(phaseUC, log)

        // ── R2 Storage (Cloudflare) ─────────────────────────────────
        var storageHandler *handler.StorageHandler
        if cfg.R2APIToken != "" && cfg.R2AccountID != "" {
                r2Client := storage.NewR2Client(cfg.R2APIToken, cfg.R2AccountID, cfg.R2Bucket)
                storageHandler = handler.NewStorageHandler(r2Client, log)
                log.Info("R2 storage initialized", "bucket", cfg.R2Bucket, "account", cfg.R2AccountID[:8]+"...")
        } else {
                log.Warn("R2 storage NOT configured (R2_API_TOKEN or R2_ACCOUNT_ID missing) — upload endpoints disabled")
        }

        // ── 8. Router + HTTP Server ─────────────────────────────────
        router := apphttp.NewRouter(apphttp.Deps{
                Auth:         authHandler,
                User:         userHandler,
                TwoFA:        twofaHandler,
                Health:       healthHandler,
                Chantier:     chantierHandler,
                Dashboard:    dashboardHandler,
                Notification: notificationHandler,
                Permission:   permissionHandler,
                AuditLog:     auditHandler,
                Pointage:     pointageHandler,
                Paie:         paieHandler,
                Stock:        stockHandler,
                Carburant:    carburantHandler,
                Client:       clientHandler,
                Devis:        devisHandler,
                Contrat:      contratHandler,
                Facturation:  facturationHandler,
                // Phase 5 — peripheral handlers
                SousTraitant: soustraitantHandler,
                Document:     documentHandler,
                Support:      supportHandler,
                Sync:         syncHandler,
                // R2 storage
                Storage: storageHandler,
                // Phase 6 — SaaS handler
                SaaS: saasHandler,
                // Phase 7 — Delegation handler + repo (pour middleware.RequireAccess futur)
                Delegation:     delegationHandler,
                DelegationRepo: delegationRepo,
                // Phase 3 — Phase/Tache handler (CRUD Phase/Tache + mes-taches)
                Phase:  phaseHandler,
                Signer: signer,
                Log:    log,
        })

        srv := &http.Server{
                Addr:         ":" + cfg.Port,
                Handler:      router,
                ReadTimeout:  15 * time.Second,
                WriteTimeout: 30 * time.Second,
                IdleTimeout:  60 * time.Second,
        }

        // ── 9. Démarrage graceful ───────────────────────────────────
        go func() {
                log.Info("HTTP server listening", "addr", srv.Addr)
                if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                        log.Error("server error", "err", err)
                        os.Exit(1)
                }
        }()

        // ── 10. Shutdown propre (SIGINT/SIGTERM) ────────────────────
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        <-quit
        log.Info("shutdown signal received, draining...")

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        if err := srv.Shutdown(ctx); err != nil {
                log.Error("forced shutdown", "err", err)
        }
        log.Info("server stopped cleanly, bye!")
}

// newLogger configure le slog handler (JSON en prod, text en dev).
func newLogger(cfg *config.Config) *slog.Logger {
        var handler slog.Handler
        if cfg.IsProduction() {
                handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevelVar()})
        } else {
                handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevelVar()})
        }
        return slog.New(handler)
}
