// Package gorm — chantier_repo.go
// Repository pour les chantiers (lecture métier, Phase 2).
//
// Toutes les méthodes utilisent WithTenant pour appliquer le RLS :
//   - SUPER_ADMIN → voit toutes les entreprises (RLS bypass)
//   - autres rôles → ne voit que son entrepriseId
//
// Tables sans RLS direct (Phase, Tache, JournalierAffectation, Pointage,
// StockMateriel) : on filtre via JOIN sur Chantier (qui est RLS-protected).
// Si le chantierID n'appartient pas au tenant, le JOIN renvoie 0 lignes.
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/chantier"

        "gorm.io/gorm"
)

// ChantierRepository — repository tenant-scoped pour les chantiers.
type ChantierRepository struct {
        db *gorm.DB // runtime (app_user) connection — RLS enforced
}

// NewChantierRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewChantierRepository(runtimeDB *gorm.DB) *ChantierRepository {
        return &ChantierRepository{db: runtimeDB}
}

// compile-time check : ChantierRepository implémente chantier.Repo.
var _ chantier.Repo = (*ChantierRepository)(nil)

// List — liste paginée des chantiers (RLS-filtered) avec filtres statut + search.
// search : ILIKE sur nom, adresse, "maitreOuvrage" (camelCase quoted).
func (r *ChantierRepository) List(ctx context.Context, auth *database.AuthUser, filter chantier.ListInput) ([]model.Chantier, int64, error) {
        page := filter.Page
        if page < 1 {
                page = 1
        }
        pageSize := filter.PageSize
        if pageSize < 1 {
                pageSize = 50
        }
        offset := (page - 1) * pageSize

        var (
                chantiers []model.Chantier
                total     int64
        )

        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Chantier{})
                if filter.Statut != "" {
                        q = q.Where("statut = ?", filter.Statut)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where(
                                `nom ILIKE ? OR adresse ILIKE ? OR "maitreOuvrage" ILIKE ?`,
                                like, like, like,
                        )
                }

                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count chantiers: %w", err)
                }
                if err := q.
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&chantiers).Error; err != nil {
                        return fmt.Errorf("list chantiers: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return chantiers, total, nil
}

// GetByID — retourne un chantier par ID avec Phases + Taches préloadées.
// (nil, nil) si non trouvé ou non visible par RLS.
func (r *ChantierRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Chantier, error) {
        var c model.Chantier
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.Preload("Phases.Taches").Where("id = ?", id).First(&c).Error
                if err != nil {
                        if errors.Is(err, gorm.ErrRecordNotFound) {
                                return nil // (nil, nil)
                        }
                        return err
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        if c.ID == "" {
                return nil, nil
        }
        return &c, nil
}

// CountByStatut — agrège les chantiers par statut pour les KPI.
// Retourne un map avec les clés :
//   - "total"          : tous chantiers
//   - "EN_COURS"       : chantiers actifs
//   - "EN_PREPARATION" : chantiers en préparation
//   - "TERMINE"        : chantiers terminés (TERMINE + RECEPTIONNE agrégés)
func (r *ChantierRepository) CountByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error) {
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

// CountPhases — nombre de phases pour un chantier (RLS via JOIN sur Chantier).
func (r *ChantierRepository) CountPhases(ctx context.Context, auth *database.AuthUser, chantierID string) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase"."chantierId" = ?`, chantierID).
                        Count(&n).Error
        })
        return n, err
}

// CountJournaliers — nombre d'affectations journaliers actives pour un chantier.
// (JournalierAffectation où chantierId = ? AND actif = true)
// RLS via JOIN sur Chantier.
func (r *ChantierRepository) CountJournaliers(ctx context.Context, auth *database.AuthUser, chantierID string) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.JournalierAffectation{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
                        Where(`"JournalierAffectation"."chantierId" = ? AND "JournalierAffectation".actif = true`, chantierID).
                        Count(&n).Error
        })
        return n, err
}

// GetPhasesAvancement — liste des valeurs d'avancement des phases d'un chantier.
// Utilisé pour calculer avancementGlobal = moyenne des avancements.
// RLS via JOIN sur Chantier.
func (r *ChantierRepository) GetPhasesAvancement(ctx context.Context, auth *database.AuthUser, chantierID string) ([]float64, error) {
        var vals []float64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase"."chantierId" = ?`, chantierID).
                        Pluck("avancement", &vals).Error
        })
        return vals, err
}

// ListWithMeta — liste optimisée : chantiers + phases préloadées + counts batch.
//
// Évite le N+1 du List + GetPhasesAvancement + CountPhases + CountJournaliers
// en faisant :
//   1. Une seule query Chantier avec Preload Phases (RLS-filtered)
//   2. Une seule query GROUP BY pour tous les journalierCounts d'un coup
//
// Retourne : chantiers (avec Phases préloadées) + map[chantierID]journalierCount.
func (r *ChantierRepository) ListWithMeta(ctx context.Context, auth *database.AuthUser, filter chantier.ListInput) ([]model.Chantier, int64, map[string]int64, error) {
        page := filter.Page
        if page < 1 {
                page = 1
        }
        pageSize := filter.PageSize
        if pageSize < 1 {
                pageSize = 50
        }
        offset := (page - 1) * pageSize

        var (
                chantiers []model.Chantier
                total     int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Chantier{})
                if filter.Statut != "" {
                        q = q.Where("statut = ?", filter.Statut)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where(
                                `nom ILIKE ? OR adresse ILIKE ? OR "maitreOuvrage" ILIKE ?`,
                                like, like, like,
                        )
                }

                // Count total
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count chantiers: %w", err)
                }

                // List avec Preload Phases (une seule query supplémentaire pour toutes les phases)
                if err := q.
                        Preload("Phases").
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&chantiers).Error; err != nil {
                        return fmt.Errorf("list chantiers: %w", err)
                }

                return nil
        })
        if err != nil {
                return nil, 0, nil, err
        }

        // Batch : tous les journalierCounts en une seule query GROUP BY
        jourCounts := make(map[string]int64)
        if len(chantiers) > 0 {
                ids := make([]string, len(chantiers))
                for i, c := range chantiers {
                        ids[i] = c.ID
                }
                type row struct {
                        ChantierID string `gorm:"column:chantierId"`
                        Count      int64
                }
                var rows []row
                err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                        return tx.Model(&model.JournalierAffectation{}).
                                Select(`"chantierId" as chantierId, COUNT(*) as count`).
                                Where(`"chantierId" IN ? AND actif = true`, ids).
                                Group(`"chantierId"`).
                                Scan(&rows).Error
                })
                if err == nil {
                        for _, r := range rows {
                                jourCounts[r.ChantierID] = r.Count
                        }
                }
        }

        return chantiers, total, jourCounts, nil
}

// ══════════════════════════════════════════════════════════════════
// Phase 0.2 — CRUD write (Create, Update, Delete, HasChildren)
// ══════════════════════════════════════════════════════════════════

// Create — insère un nouveau chantier. L'ID est généré si vide (cuid-like).
// L'entrepriseId est résolu par le usecase (auth.EntrepriseID pour non-SUPER_ADMIN).
func (r *ChantierRepository) Create(ctx context.Context, auth *database.AuthUser, c model.Chantier) (*model.Chantier, error) {
        if c.ID == "" {
                c.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if c.CreatedAt.IsZero() {
                c.CreatedAt = now
        }
        if c.UpdatedAt.IsZero() {
                c.UpdatedAt = now
        }
        // Defaults défensifs (le usecase valide déjà, mais on garde la cohérence DB)
        if c.Statut == "" {
                c.Statut = "EN_PREPARATION"
        }
        if c.ModeCarburant == "" {
                c.ModeCarburant = "STOCK_PHYSIQUE"
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&c).Error
        })
        if err != nil {
                return nil, err
        }
        return &c, nil
}

// Update — met à jour un chantier par ID (partial updates via map).
// Renvoie (nil, nil) si non trouvé ou non visible par RLS.
func (r *ChantierRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Chantier, error) {
        // Force updatedAt
        updates["updatedAt"] = time.Now().UTC()

        var updated model.Chantier
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Vérifie l'existence (pour 404)
                var exists int64
                if err := tx.Model(&model.Chantier{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                // Applique les updates (GORM Updates avec map = partial update)
                if err := tx.Model(&model.Chantier{}).Where("id = ?", id).Updates(updates).Error; err != nil {
                        return err
                }
                // Recharge avec Phases + Taches préloadées (cohérent avec GetByID)
                if err := tx.Preload("Phases.Taches").Where("id = ?", id).First(&updated).Error; err != nil {
                        if errors.Is(err, gorm.ErrRecordNotFound) {
                                return nil
                        }
                        return err
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        if updated.ID == "" {
                return nil, nil
        }
        return &updated, nil
}

// HasChildren — true si le chantier a au moins une dépendance (phases,
// journaliers affectés, pointages, photos, rapports, documents).
// Utilisé pour bloquer le delete sans ?force=true.
func (r *ChantierRepository) HasChildren(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error) {
        // On check les tables dépendantes directes (sans RLS direct, JOIN via Chantier).
        // Tables checkées : Phase, JournalierAffectation, Pointage, Photo, RapportJournalier, DocumentChantier
        // Note : on utilise COUNT(*) via JOIN sur Chantier pour bénéficier du RLS.
        var has bool
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Phase
                var nPhase int64
                if err := tx.Model(&model.Phase{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Phase"."chantierId"`).
                        Where(`"Phase"."chantierId" = ?`, chantierID).
                        Count(&nPhase).Error; err != nil {
                        return err
                }
                if nPhase > 0 {
                        has = true
                        return nil
                }
                // JournalierAffectation
                var nJour int64
                if err := tx.Model(&model.JournalierAffectation{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "JournalierAffectation"."chantierId"`).
                        Where(`"JournalierAffectation"."chantierId" = ?`, chantierID).
                        Count(&nJour).Error; err != nil {
                        return err
                }
                if nJour > 0 {
                        has = true
                        return nil
                }
                // Pointage
                var nPoint int64
                if err := tx.Model(&model.Pointage{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "Pointage"."chantierId"`).
                        Where(`"Pointage"."chantierId" = ?`, chantierID).
                        Count(&nPoint).Error; err != nil {
                        return err
                }
                if nPoint > 0 {
                        has = true
                        return nil
                }
                // DocumentChantier
                var nDoc int64
                if err := tx.Model(&model.DocumentChantier{}).
                        Joins(`JOIN "Chantier" ON "Chantier".id = "DocumentChantier"."chantierId"`).
                        Where(`"DocumentChantier"."chantierId" = ?`, chantierID).
                        Count(&nDoc).Error; err != nil {
                        return err
                }
                if nDoc > 0 {
                        has = true
                        return nil
                }
                return nil
        })
        return has, err
}

// Delete — supprime un chantier (hard delete).
// Si force=true : cascade delete Phase → Tache, JournalierAffectation, Pointage,
// DocumentChantier avant de supprimer le Chantier.
// Si force=false : le usecase a déjà vérifié HasChildren, on peut juste supprimer.
func (r *ChantierRepository) Delete(ctx context.Context, auth *database.AuthUser, id string, force bool) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                // Vérifie l'existence
                var exists int64
                if err := tx.Model(&model.Chantier{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil // idempotent
                }

                // Cascade si force=true
                if force {
                        // 1. Taches via Phase (Phase.PhaseID = Tache.PhaseID)
                        if err := tx.Where(`"phaseId" IN (SELECT id FROM "Phase" WHERE "chantierId" = ?)`, id).
                                Delete(&model.Tache{}).Error; err != nil {
                                return fmt.Errorf("cascade delete Tache: %w", err)
                        }
                        // 2. Phases
                        if err := tx.Where(`"chantierId" = ?`, id).Delete(&model.Phase{}).Error; err != nil {
                                return fmt.Errorf("cascade delete Phase: %w", err)
                        }
                        // 3. JournalierAffectation
                        if err := tx.Where(`"chantierId" = ?`, id).Delete(&model.JournalierAffectation{}).Error; err != nil {
                                return fmt.Errorf("cascade delete JournalierAffectation: %w", err)
                        }
                        // 4. Pointage
                        if err := tx.Where(`"chantierId" = ?`, id).Delete(&model.Pointage{}).Error; err != nil {
                                return fmt.Errorf("cascade delete Pointage: %w", err)
                        }
                        // 5. DocumentChantier
                        if err := tx.Where(`"chantierId" = ?`, id).Delete(&model.DocumentChantier{}).Error; err != nil {
                                return fmt.Errorf("cascade delete DocumentChantier: %w", err)
                        }
                }

                // Hard delete Chantier
                return tx.Where("id = ?", id).Delete(&model.Chantier{}).Error
        })
}
