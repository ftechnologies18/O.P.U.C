// Package gorm — engin_repo.go
// Repository pour le parc engins + locations (Phase B-ENGINS).
//
// Tables :
//   - Equipement    : RLS-protected (policy tenant_isolation sur entrepriseId).
//                     Avec WithTenant, SUPER_ADMIN voit toutes les entreprises,
//                     autres rôles ne voient que leur entrepriseId.
//   - LocationEngin : PAS de RLS direct → filtrage tenant via JOIN sur
//                     "Equipement" (qui est RLS-protected). Si l'equipementId
//                     n'appartient pas au tenant, le JOIN renvoie 0 lignes.
//
// Pour les Preload (Equipement, Fournisseur, Chantier), GORM exécute une
// requête séparée dans le même `tx` (donc RLS activée). Les relations
// orphelines (FK pointant vers un autre tenant) ne sont pas chargées.
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/usecase/engin"

        "gorm.io/gorm"
)

// EnginRepository — repository tenant-scoped pour Equipement + LocationEngin.
type EnginRepository struct {
        db *gorm.DB
}

// NewEnginRepository constructeur.
// runtimeDB = dbm.Runtime (app_user, RLS enforced).
func NewEnginRepository(runtimeDB *gorm.DB) *EnginRepository {
        return &EnginRepository{db: runtimeDB}
}

// compile-time check : EnginRepository implémente engin.Repo.
var _ engin.Repo = (*EnginRepository)(nil)

// ══════════════════════════════════════════════════════════════════
// Equipement (RLS direct)
// ══════════════════════════════════════════════════════════════════

// ListEquipements — liste paginée des équipements (RLS direct).
// Filtres :
//   - search       : ILIKE sur designation, marque, modele, immatriculation
//   - typeLocation : PROPRE | LOCATION
//   - chantierId   : filtre équipements ayant une location sur ce chantier
//
// Tri : createdAt DESC.
func (r *EnginRepository) ListEquipements(ctx context.Context, auth *database.AuthUser, filter engin.ListEquipementsInput) ([]model.Equipement, int64, error) {
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
                items []model.Equipement
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Equipement{})
                if filter.TypeLocation != "" {
                        q = q.Where(`"typeLocation" = ?`, filter.TypeLocation)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where(
                                `designation ILIKE ? OR marque ILIKE ? OR modele ILIKE ? OR immatriculation ILIKE ?`,
                                like, like, like, like,
                        )
                }
                if filter.ChantierID != "" {
                        // Equipements ayant au moins une location sur ce chantier
                        q = q.Where(`id IN (SELECT "equipementId" FROM "LocationEngin" WHERE "chantierId" = ?)`, filter.ChantierID)
                }

                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count equipements: %w", err)
                }
                if err := q.
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list equipements: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetEquipementByID — fetch par ID (RLS direct).
// (nil, nil) si non trouvé ou non visible.
func (r *EnginRepository) GetEquipementByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Equipement, error) {
        var e model.Equipement
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.Where("id = ?", id).First(&e).Error
                if err != nil {
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
        if e.ID == "" {
                return nil, nil
        }
        return &e, nil
}

// CreateEquipement — insère un nouvel équipement (RLS WITH CHECK sur entrepriseId).
func (r *EnginRepository) CreateEquipement(ctx context.Context, auth *database.AuthUser, e model.Equipement) (*model.Equipement, error) {
        if e.ID == "" {
                e.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if e.CreatedAt.IsZero() {
                e.CreatedAt = now
        }
        if e.UpdatedAt.IsZero() {
                e.UpdatedAt = now
        }
        if e.Etat == "" {
                e.Etat = "BON"
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&e).Error
        })
        if err != nil {
                return nil, err
        }
        return &e, nil
}

// UpdateEquipement — met à jour un équipement par ID (partial updates via map).
// (nil, nil) si non trouvé.
func (r *EnginRepository) UpdateEquipement(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Equipement, error) {
        updates["updatedAt"] = time.Now().UTC()

        var updated model.Equipement
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.Equipement{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                if err := tx.Model(&model.Equipement{}).Where("id = ?", id).Updates(updates).Error; err != nil {
                        return err
                }
                if err := tx.Where("id = ?", id).First(&updated).Error; err != nil {
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

// DeleteEquipement — hard delete par ID (RLS direct). Idempotent.
func (r *EnginRepository) DeleteEquipement(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.Equipement{}).Where("id = ?", id).Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.Equipement{}).Error
        })
}

// CountLocationsByEquipement — nombre de locations liées à un équipement
// (RLS via JOIN Equipement).
func (r *EnginRepository) CountLocationsByEquipement(ctx context.Context, auth *database.AuthUser, equipementID string) (int64, error) {
        var n int64
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.LocationEngin{}).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Where(`"LocationEngin"."equipementId" = ?`, equipementID).
                        Count(&n).Error
        })
        return n, err
}

// CountLocationsByEquipements — batch count locations par équipement
// (évite N+1 sur List). RLS via JOIN Equipement.
func (r *EnginRepository) CountLocationsByEquipements(ctx context.Context, auth *database.AuthUser, equipementIDs []string) (map[string]int64, error) {
        out := make(map[string]int64, len(equipementIDs))
        if len(equipementIDs) == 0 {
                return out, nil
        }
        type row struct {
                EquipementID string `gorm:"column:equipementId"`
                Count        int64
        }
        var rows []row
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.LocationEngin{}).
                        Select(`"equipementId" as equipementId, COUNT(*) as count`).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Where(`"LocationEngin"."equipementId" IN ?`, equipementIDs).
                        Group(`"equipementId"`).
                        Scan(&rows).Error
        })
        if err != nil {
                return nil, err
        }
        for _, r := range rows {
                out[r.EquipementID] = r.Count
        }
        return out, nil
}

// CountEquipementsByTypeLocation — agrège les équipements par typeLocation
// pour les KPI. Compte total, propres (typeLocation=PROPRE), loues
// (typeLocation=LOCATION).
func (r *EnginRepository) CountEquipementsByTypeLocation(ctx context.Context, auth *database.AuthUser) (total, propres, loues int64, err error) {
        type row struct {
                TypeLocation string
                Count        int64
        }
        var rows []row
        err = database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.Equipement{}).
                        Select(`COALESCE("typeLocation", '') as type_location, COUNT(*) as count`).
                        Group(`"typeLocation"`).
                        Scan(&rows).Error
        })
        if err != nil {
                return 0, 0, 0, err
        }
        for _, r := range rows {
                total += r.Count
                switch r.TypeLocation {
                case "PROPRE":
                        propres += r.Count
                case "LOCATION":
                        loues += r.Count
                }
        }
        return total, propres, loues, nil
}

// ══════════════════════════════════════════════════════════════════
// LocationEngin (pas de RLS direct → JOIN Equipement)
// ══════════════════════════════════════════════════════════════════

// ListLocations — liste paginée des locations (RLS via JOIN Equipement).
// Filtres : search (fournisseurNom, numeroContrat), statut, chantierId.
// Preload Equipement + Fournisseur + Chantier pour la réponse complète.
func (r *EnginRepository) ListLocations(ctx context.Context, auth *database.AuthUser, filter engin.ListLocationsInput) ([]model.LocationEngin, int64, error) {
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
                items []model.LocationEngin
                total int64
        )
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.LocationEngin{}).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`)
                if filter.Statut != "" {
                        q = q.Where(`"LocationEngin".statut = ?`, filter.Statut)
                }
                if filter.ChantierID != "" {
                        q = q.Where(`"LocationEngin"."chantierId" = ?`, filter.ChantierID)
                }
                if filter.Search != "" {
                        like := "%" + filter.Search + "%"
                        q = q.Where(
                                `"LocationEngin"."fournisseurNom" ILIKE ? OR "LocationEngin"."numeroContrat" ILIKE ?`,
                                like, like,
                        )
                }

                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count locations: %w", err)
                }
                if err := q.
                        Preload("Equipement").
                        Preload("Fournisseur").
                        Preload("Chantier").
                        Order(`"LocationEngin"."createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list locations: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// GetLocationByID — fetch par ID (RLS via JOIN Equipement).
// (nil, nil) si non trouvé ou non visible.
func (r *EnginRepository) GetLocationByID(ctx context.Context, auth *database.AuthUser, id string) (*model.LocationEngin, error) {
        var l model.LocationEngin
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                err := tx.
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Preload("Equipement").
                        Preload("Fournisseur").
                        Preload("Chantier").
                        Where(`"LocationEngin".id = ?`, id).
                        First(&l).Error
                if err != nil {
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
        if l.ID == "" {
                return nil, nil
        }
        return &l, nil
}

// CreateLocation — insère une nouvelle location (RLS WITH CHECK sur Equipement
// via FK : l'equipementId doit appartenir au tenant, sinon la lecture ultérieure
// sera filtrée par le JOIN).
func (r *EnginRepository) CreateLocation(ctx context.Context, auth *database.AuthUser, l model.LocationEngin) (*model.LocationEngin, error) {
        if l.ID == "" {
                l.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if l.CreatedAt.IsZero() {
                l.CreatedAt = now
        }
        if l.UpdatedAt.IsZero() {
                l.UpdatedAt = now
        }
        if l.Statut == "" {
                l.Statut = "EN_COURS"
        }
        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Create(&l).Error
        })
        if err != nil {
                return nil, err
        }
        // Recharge avec Preload pour la réponse (RLS via JOIN Equipement)
        return r.GetLocationByID(ctx, auth, l.ID)
}

// UpdateLocation — met à jour une location par ID (partial updates via map).
// (nil, nil) si non trouvé.
func (r *EnginRepository) UpdateLocation(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.LocationEngin, error) {
        updates["updatedAt"] = time.Now().UTC()

        err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.LocationEngin{}).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Where(`"LocationEngin".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Model(&model.LocationEngin{}).Where("id = ?", id).Updates(updates).Error
        })
        if err != nil {
                return nil, err
        }
        // Recharge avec Preload
        return r.GetLocationByID(ctx, auth, id)
}

// DeleteLocation — hard delete par ID (RLS via JOIN Equipement). Idempotent.
func (r *EnginRepository) DeleteLocation(ctx context.Context, auth *database.AuthUser, id string) error {
        return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                var exists int64
                if err := tx.Model(&model.LocationEngin{}).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Where(`"LocationEngin".id = ?`, id).
                        Count(&exists).Error; err != nil {
                        return err
                }
                if exists == 0 {
                        return nil
                }
                return tx.Where("id = ?", id).Delete(&model.LocationEngin{}).Error
        })
}

// LocationKPIs — KPIs agrégés sur les locations (RLS via JOIN Equipement).
//   - enCours            : COUNT WHERE statut = 'EN_COURS'
//   - coutTotalEnCours   : SUM(coutJournalier) WHERE statut = 'EN_COURS'
//   - coutJournalierMoyen: AVG(coutJournalier) WHERE statut = 'EN_COURS'
//   - locationsCeMois    : COUNT WHERE createdAt >= début du mois courant
func (r *EnginRepository) LocationKPIs(ctx context.Context, auth *database.AuthUser) (enCours int64, coutTotalEnCours, coutJournalierMoyen float64, locationsCeMois int64, err error) {
        type row struct {
                EnCours           int64   `gorm:"column:en_cours"`
                CoutTotalEnCours  float64 `gorm:"column:cout_total_en_cours"`
                CoutJournalierMoy float64 `gorm:"column:cout_journalier_moyen"`
                LocationsCeMois   int64   `gorm:"column:locations_ce_mois"`
        }
        var res row
        now := time.Now().UTC()
        startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
        err = database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
                return tx.Model(&model.LocationEngin{}).
                        Joins(`JOIN "Equipement" ON "Equipement".id = "LocationEngin"."equipementId"`).
                        Select(`COALESCE(SUM(CASE WHEN "LocationEngin".statut = 'EN_COURS' THEN 1 ELSE 0 END), 0) AS en_cours,
                                COALESCE(SUM(CASE WHEN "LocationEngin".statut = 'EN_COURS' THEN "LocationEngin"."coutJournalier" ELSE 0 END), 0) AS cout_total_en_cours,
                                COALESCE(AVG(CASE WHEN "LocationEngin".statut = 'EN_COURS' THEN "LocationEngin"."coutJournalier" END), 0) AS cout_journalier_moyen,
                                COALESCE(SUM(CASE WHEN "LocationEngin"."createdAt" >= ? THEN 1 ELSE 0 END), 0) AS locations_ce_mois`, startOfMonth).
                        Scan(&res).Error
        })
        if err != nil {
                return 0, 0, 0, 0, err
        }
        return res.EnCours, res.CoutTotalEnCours, res.CoutJournalierMoy, res.LocationsCeMois, nil
}
