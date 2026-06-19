// Package database gère les connexions PostgreSQL via GORM + pgx.
// Deux connexions distinctes :
//   - RuntimeDB  : rôle app_user (RLS APPLIQUÉE) — pour les requêtes métier
//   - MigrateDB  : rôle postgres  (RLS BYPASSÉE) — pour migrations/seeds
package database

import (
	"fmt"
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Manager contient les deux pools de connexion.
type Manager struct {
	Runtime   *gorm.DB // app_user — RLS enforced
	Migrations *gorm.DB // postgres — bypass RLS
	log       *slog.Logger
}

// New crée les deux connexions GORM.
// databaseURL     = connexion runtime (app_user, RLS)
// migrationsURL   = connexion admin (postgres, bypass RLS)
func New(databaseURL, migrationsURL string, log *slog.Logger) (*Manager, error) {
	runtimeDB, err := newGORM(databaseURL, log, true)
	if err != nil {
		return nil, fmt.Errorf("runtime db: %w", err)
	}

	migrateDB, err := newGORM(migrationsURL, log, false)
	if err != nil {
		return nil, fmt.Errorf("migrations db: %w", err)
	}

	// Vérification rapide : ping les deux
	if err := ping(runtimeDB); err != nil {
		return nil, fmt.Errorf("runtime ping: %w", err)
	}
	log.Info("database connected (runtime/app_user)")
	if err := ping(migrateDB); err != nil {
		return nil, fmt.Errorf("migrations ping: %w", err)
	}
	log.Info("database connected (migrations/postgres)")

	return &Manager{Runtime: runtimeDB, Migrations: migrateDB, log: log}, nil
}

// newGORM configure une connexion GORM avec pgx.
// isRuntime=true : log plus verbeux (utile en dev)
func newGORM(dsn string, log *slog.Logger, isRuntime bool) (*gorm.DB, error) {
	gormCfg := &gorm.Config{
		Logger: logger.New(
			slog.NewLogLogger(log.Handler(), slog.LevelWarn),
			logger.Config{
				SlowThreshold:             500 * time.Millisecond,
				LogLevel:                  logger.Warn,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
		// PreferString : évite les conversions uint/int inattendues
		PrepareStmt: true,
	}

	db, err := gorm.Open(postgres.Open(dsn), gormCfg)
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	// Pool settings adaptés à pgbouncer (Supabase pooler)
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db, nil
}

// ping vérifie que la DB répond.
func ping(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

// Close ferme les deux pools.
func (m *Manager) Close() error {
	var errs []error
	if sqlDB, err := m.Runtime.DB(); err == nil {
		errs = append(errs, sqlDB.Close())
	}
	if sqlDB, err := m.Migrations.DB(); err == nil {
		errs = append(errs, sqlDB.Close())
	}
	for _, e := range errs {
		if e != nil {
			m.log.Error("db close error", "err", e)
		}
	}
	return nil
}
