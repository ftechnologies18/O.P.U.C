// Package database — migrate.go
// AutoMigrate (GORM) + exécution des scripts SQL RLS.
//
// Note : en production, on préfère golang-migrate (fichiers SQL versionnés).
// Pour la Phase 0 (dev), AutoMigrate est suffisant et plus rapide.
package database

import (
	"fmt"
	"log/slog"

	"opuc/internal/domain/model"
)

// AutoMigrate crée/met à jour les tables GORM (via le rôle postgres, bypass RLS).
// À n'appeler qu'au démarrage en dev (IsProduction=false).
func (m *Manager) AutoMigrate(log *slog.Logger) error {
	models := []interface{}{
		&model.Entreprise{},
		&model.User{},
		&model.Client{},
		&model.Chantier{},
		&model.Phase{},
		&model.Tache{},
	}

	log.Info("running GORM AutoMigrate", "models", len(models))
	if err := m.Migrations.AutoMigrate(models...); err != nil {
		return fmt.Errorf("automigrate: %w", err)
	}
	log.Info("AutoMigrate completed successfully")
	return nil
}
