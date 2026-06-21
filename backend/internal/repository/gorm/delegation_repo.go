// Package gorm — delegation_repo.go
// Repository pour les délégations de domaine fonctionnel (Phase 7 — délégation).
//
// Le GERANT peut déléguer un domaine (FINANCE, RH, LOGISTIQUE, COMMERCIAL, CHANTIER,
// DOCUMENTS) à un user avec un niveau de permission (LECTURE, ECRITURE, GESTION).
// Le GERANT peut aussi promouvoir jusqu'à 2 co-GERANTS (mêmes droits que GERANT,
// sauf promote/demote réservé au principal GERANT).
//
// Connexions :
//   - runtimeDB (app_user, RLS enforced) — pour les opérations CRUD tenant-scoped
//     (Create, GetByID, List, ListByUser, ListMyDelegations, Update, Revoke).
//     Utilise database.WithTenant() pour appliquer le filtrage tenant.
//   - migrationsDB (postgres, bypass RLS) — pour les opérations cross-tenant
//     utilisées par le middleware RequireAccess (GetActive), la commande
//     d'expiration (ExpireOld) et la gestion des co-GERANTS
//     (CountCoGerants, PromoteCoGerant, DemoteCoGerant).
//
// Pourquoi le GetActive utilise Migrations :
//   Le middleware RequireAccess tourne AVANT que la requête n'atteigne le handler.
//   Il doit pouvoir vérifier rapidement si un user a une délégation active pour un
//   domaine, sans avoir à instancier un contexte RLS complet. L'autorisation est
//   déjà assurée par l'authentification JWT + le check du role/co-GERANT dans le
//   middleware lui-même. Le risque de fuite cross-tenant est nul car le userId
//   vient du JWT (pas du client).
package gorm

import (
        "context"
        "errors"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"

        "gorm.io/gorm"
)

// DelegationFilter — critères de filtrage pour List. Tous optionnels.
type DelegationFilter struct {
        ToUserID     string
        Domain       string
        Statut       string
        FromUserID   string
        EntrepriseID string
        Page         int
        PageSize     int
}

// DelegationRepository — repository pour les délégations.
//
// Architecturalement, deux connexions GORM :
//   - runtimeDB    : pour les opérations tenant-scoped (CRUD classique, RLS)
//   - migrationsDB : pour les opérations cross-tenant (middleware, cron, co-gerants)
type DelegationRepository struct {
        runtimeDB    *gorm.DB
        migrationsDB *gorm.DB
}

// NewDelegationRepository constructeur.
func NewDelegationRepository(runtimeDB, migrationsDB *gorm.DB) *DelegationRepository {
        return &DelegationRepository{runtimeDB: runtimeDB, migrationsDB: migrationsDB}
}

// Create — crée une nouvelle délégation (statut=ACTIF). L'ID est généré si vide.
// Tenant-scoped via WithTenant (entrepriseId doit matcher auth.EntrepriseID).
func (r *DelegationRepository) Create(ctx context.Context, auth *database.AuthUser, d model.Delegation) (*model.Delegation, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if d.ID == "" {
                d.ID = newCuidLikeID()
        }
        now := time.Now().UTC()
        if d.CreatedAt.IsZero() {
                d.CreatedAt = now
        }
        if d.UpdatedAt.IsZero() {
                d.UpdatedAt = now
        }
        if d.Statut == "" {
                d.Statut = model.DelegationStatutActif
        }

        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                return tx.Create(&d).Error
        })
        if err != nil {
                return nil, err
        }
        return &d, nil
}

// GetByID — récupère une délégation par ID (RLS-filtered). (nil, nil) si non trouvé.
func (r *DelegationRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if id == "" {
                return nil, nil
        }
        var d model.Delegation
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                err := tx.Where("id = ?", id).First(&d).Error
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
        if d.ID == "" {
                return nil, nil
        }
        return &d, nil
}

// List — liste paginée des délégations (RLS-filtered) avec filtres optionnels.
// Ordonné par createdAt DESC. Retourne (items, total, err).
func (r *DelegationRepository) List(ctx context.Context, auth *database.AuthUser, filter DelegationFilter) ([]model.Delegation, int64, error) {
        if r.runtimeDB == nil {
                return nil, 0, ErrRuntimeRequired
        }
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
                items []model.Delegation
                total int64
        )
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                q := tx.Model(&model.Delegation{})
                if filter.ToUserID != "" {
                        q = q.Where(`"toUserId" = ?`, filter.ToUserID)
                }
                if filter.Domain != "" {
                        q = q.Where("domain = ?", filter.Domain)
                }
                if filter.Statut != "" {
                        q = q.Where("statut = ?", filter.Statut)
                }
                if filter.FromUserID != "" {
                        q = q.Where(`"fromUserId" = ?`, filter.FromUserID)
                }
                if filter.EntrepriseID != "" {
                        q = q.Where(`"entrepriseId" = ?`, filter.EntrepriseID)
                }
                if err := q.Count(&total).Error; err != nil {
                        return fmt.Errorf("count delegations: %w", err)
                }
                if err := q.
                        Order(`"createdAt" DESC`).
                        Offset(offset).
                        Limit(pageSize).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list delegations: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, 0, err
        }
        return items, total, nil
}

// ListByUser — délégations reçues par un user (RLS-filtered, statut non filtré).
func (r *DelegationRepository) ListByUser(ctx context.Context, auth *database.AuthUser, userID string) ([]model.Delegation, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if userID == "" {
                return []model.Delegation{}, nil
        }
        var items []model.Delegation
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                if err := tx.
                        Where(`"toUserId" = ?`, userID).
                        Order(`"createdAt" DESC`).
                        Find(&items).Error; err != nil {
                        return fmt.Errorf("list delegations by user: %w", err)
                }
                return nil
        })
        if err != nil {
                return nil, err
        }
        return items, nil
}

// ListMyDelegations — délégations reçues par le user courant (auth.UserID).
func (r *DelegationRepository) ListMyDelegations(ctx context.Context, auth *database.AuthUser) ([]model.Delegation, error) {
        if auth == nil {
                return nil, fmt.Errorf("auth is required")
        }
        return r.ListByUser(ctx, auth, auth.UserID)
}

// Update — met à jour une délégation par ID avec un map d'updates (RLS-filtered).
// Met à jour updatedAt automatiquement. Renvoie la délégation à jour. (nil, nil) si non trouvé.
func (r *DelegationRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Delegation, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if id == "" {
                return nil, fmt.Errorf("id is required")
        }
        if len(updates) == 0 {
                return r.GetByID(ctx, auth, id)
        }
        updates["updatedAt"] = time.Now().UTC()

        var updated model.Delegation
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                res := tx.Model(&model.Delegation{}).Where("id = ?", id).Updates(updates)
                if res.Error != nil {
                        return res.Error
                }
                if res.RowsAffected == 0 {
                        return nil // non trouvé / non visible → (nil, nil)
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

// Revoke — marque une délégation comme REVOCQUE. Idempotent (pas d'erreur si déjà révoquée).
// Renvoie la délégation mise à jour. (nil, nil) si non trouvée.
func (r *DelegationRepository) Revoke(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error) {
        if r.runtimeDB == nil {
                return nil, ErrRuntimeRequired
        }
        if id == "" {
                return nil, fmt.Errorf("id is required")
        }
        now := time.Now().UTC()
        var updated model.Delegation
        err := database.WithTenant(ctx, r.runtimeDB, auth, func(tx *gorm.DB) error {
                res := tx.Model(&model.Delegation{}).
                        Where("id = ?", id).
                        Updates(map[string]any{
                                "statut":    model.DelegationStatutRevoque,
                                "updatedAt": now,
                        })
                if res.Error != nil {
                        return res.Error
                }
                if res.RowsAffected == 0 {
                        return nil // non trouvé / non visible → (nil, nil)
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

// GetActive — vérifie si un user a une délégation ACTIVE (non expirée) pour un domaine
// dans une entreprise. Utilise la connexion Migrations (pas de WithTenant) car cette
// méthode est appelée par le middleware RequireAccess avant que la requête n'atteigne
// le handler — il faut pouvoir vérifier rapidement sans overhead RLS.
//
// Règles :
//   - statut = ACTIF
//   - expiresLe IS NULL OR expiresLe > now
//   - userId + domain + entrepriseId matchent
//
// Retourne (nil, nil) si aucune délégation active trouvée.
func (r *DelegationRepository) GetActive(ctx context.Context, userID, domain, entrepriseID string) (*model.Delegation, error) {
        if r.migrationsDB == nil {
                return nil, fmt.Errorf("migrations DB is required for GetActive")
        }
        if userID == "" || domain == "" || entrepriseID == "" {
                return nil, nil
        }
        now := time.Now().UTC()
        var d model.Delegation
        err := r.migrationsDB.WithContext(ctx).
                Where(`"toUserId" = ? AND domain = ? AND "entrepriseId" = ? AND statut = ?`,
                        userID, domain, entrepriseID, model.DelegationStatutActif).
                Where(`"expiresLe" IS NULL OR "expiresLe" > ?`, now).
                Order(`"createdAt" DESC`).
                First(&d).Error
        if err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, nil
                }
                return nil, fmt.Errorf("get active delegation: %w", err)
        }
        return &d, nil
}

// ExpireOld — marque comme EXPIRE toutes les délégations ACTIVES dont expiresLe < now.
// Retourne le nombre de lignes affectées. Idempotent. Utilise Migrations (cross-tenant).
func (r *DelegationRepository) ExpireOld(ctx context.Context) (int64, error) {
        if r.migrationsDB == nil {
                return 0, fmt.Errorf("migrations DB is required for ExpireOld")
        }
        now := time.Now().UTC()
        res := r.migrationsDB.WithContext(ctx).Model(&model.Delegation{}).
                Where("statut = ? AND \"expiresLe\" IS NOT NULL AND \"expiresLe\" < ?",
                        model.DelegationStatutActif, now).
                Updates(map[string]any{
                        "statut":    model.DelegationStatutExpire,
                        "updatedAt": now,
                })
        if res.Error != nil {
                return 0, fmt.Errorf("expire old delegations: %w", res.Error)
        }
        return res.RowsAffected, nil
}

// ── Co-GERANTS management ────────────────────────────────────────────
//
// Ces méthodes utilisent Migrations (bypass RLS) car elles opèrent sur la table
// User en cross-tenant (le principal GERANT modifie le flag isCoGerant d'un user
// de sa propre entreprise — l'autorisation est faite côté usecase).

// CountCoGerants — compte les co-GERANTS d'une entreprise.
func (r *DelegationRepository) CountCoGerants(ctx context.Context, entrepriseID string) (int64, error) {
        if r.migrationsDB == nil {
                return 0, fmt.Errorf("migrations DB is required for CountCoGerants")
        }
        if entrepriseID == "" {
                return 0, nil
        }
        var n int64
        err := r.migrationsDB.WithContext(ctx).Model(&model.User{}).
                Where(`"entrepriseId" = ? AND "isCoGerant" = ?`, entrepriseID, true).
                Count(&n).Error
        if err != nil {
                return 0, fmt.Errorf("count co-gerants: %w", err)
        }
        return n, nil
}

// PromoteCoGerant — set isCoGerant=true sur un user. Idempotent.
func (r *DelegationRepository) PromoteCoGerant(ctx context.Context, userID string) error {
        if r.migrationsDB == nil {
                return fmt.Errorf("migrations DB is required for PromoteCoGerant")
        }
        if userID == "" {
                return fmt.Errorf("userID is required")
        }
        now := time.Now().UTC()
        return r.migrationsDB.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", userID).
                Updates(map[string]any{
                        "isCoGerant": true,
                        "updatedAt":  now,
                }).Error
}

// DemoteCoGerant — set isCoGerant=false sur un user. Idempotent.
func (r *DelegationRepository) DemoteCoGerant(ctx context.Context, userID string) error {
        if r.migrationsDB == nil {
                return fmt.Errorf("migrations DB is required for DemoteCoGerant")
        }
        if userID == "" {
                return fmt.Errorf("userID is required")
        }
        now := time.Now().UTC()
        return r.migrationsDB.WithContext(ctx).Model(&model.User{}).
                Where("id = ?", userID).
                Updates(map[string]any{
                        "isCoGerant": false,
                        "updatedAt":  now,
                }).Error
}

// GetCoGerants — liste les co-GERANTS d'une entreprise. Utilisé par le handler
// pour l'endpoint GET /users/co-gerants (GERANT only).
func (r *DelegationRepository) GetCoGerants(ctx context.Context, entrepriseID string) ([]model.User, error) {
        if r.migrationsDB == nil {
                return nil, fmt.Errorf("migrations DB is required for GetCoGerants")
        }
        if entrepriseID == "" {
                return []model.User{}, nil
        }
        var users []model.User
        err := r.migrationsDB.WithContext(ctx).
                Where(`"entrepriseId" = ? AND "isCoGerant" = ?`, entrepriseID, true).
                Order(`"createdAt" DESC`).
                Find(&users).Error
        if err != nil {
                return nil, fmt.Errorf("get co-gerants: %w", err)
        }
        return users, nil
}

// GetUserByID — récupère un user par ID via la connexion Migrations (bypass RLS).
// Utilisé par le usecase pour vérifier qu'un toUserId existe et appartient à la
// bonne entreprise avant de créer une délégation. L'autorisation (GERANT only) est
// faite côté usecase, donc le bypass RLS ici est acceptable.
// Retourne (nil, nil) si non trouvé.
func (r *DelegationRepository) GetUserByID(ctx context.Context, userID string) (*model.User, error) {
        if r.migrationsDB == nil {
                return nil, fmt.Errorf("migrations DB is required for GetUserByID")
        }
        if userID == "" {
                return nil, nil
        }
        var u model.User
        err := r.migrationsDB.WithContext(ctx).Where("id = ?", userID).First(&u).Error
        if err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, nil
                }
                return nil, fmt.Errorf("get user by id: %w", err)
        }
        return &u, nil
}

// ══════════════════════════════════════════════════════════════════
// Phase 5 — Auto-grant (délégations automatiques selon la fonction BTP)
// ══════════════════════════════════════════════════════════════════
//
// Les délégations auto sont identifiées par un préfixe "AUTO:" dans le champ
// Raison (ex: "AUTO: CHARGE_LOGISTIQUE"). Cela permet de les distinguer des
// délégations manuelles créées par le GERANT via /parametres/delegations.
//
// Ces méthodes utilisent la connexion Migrations (bypass RLS) car :
//   - L'auto-grant est une opération système déclenchée par le usecase IAM
//   - Le userID + entrepriseID viennent du contexte auth (sécurisé)
//   - Évite les conflits avec WithTenant (qui set LOCAL ROLE app_user)

// AutoGrantPrefix — préfixe des délégations auto dans le champ Raison.
const AutoGrantPrefix = "AUTO:"

// CreateAutoGrant — crée une délégation auto (idempotente).
//
// Si une délégation auto ACTIVE existe déjà pour le même (userID, domaine),
// on ne fait rien (idempotent). Sinon, on crée une nouvelle délégation avec :
//   - statut = ACTIF
//   - permissions = level fourni (toujours ECRITURE pour les auto-grants)
//   - raison = "AUTO: <fonction>" (ex: "AUTO: CHARGE_LOGISTIQUE")
//   - fromUserID = systemUserID (le GERANT qui crée le user, ou un ID système)
//
// Retourne la délégation créée, ou nil si idempotent (déjà existante).
func (r *DelegationRepository) CreateAutoGrant(ctx context.Context, userID, entrepriseID, fromUserID, domain, permission, fonction string) (*model.Delegation, error) {
        if r.migrationsDB == nil {
                return nil, fmt.Errorf("migrations DB is required for CreateAutoGrant")
        }
        if userID == "" || entrepriseID == "" || domain == "" || permission == "" {
                return nil, nil
        }

        // Check idempotence : une délégation auto ACTIVE existe-t-elle déjà ?
        raison := AutoGrantPrefix + " " + fonction
        var existing model.Delegation
        err := r.migrationsDB.WithContext(ctx).
                Where(`"toUserId" = ? AND domain = ? AND "entrepriseId" = ? AND statut = ? AND raison LIKE ?`,
                        userID, domain, entrepriseID, model.DelegationStatutActif, AutoGrantPrefix+"%").
                First(&existing).Error
        if err == nil {
                // Déjà existante — idempotent, on ne fait rien
                return &existing, nil
        }
        if !errors.Is(err, gorm.ErrRecordNotFound) {
                return nil, fmt.Errorf("check existing auto-grant: %w", err)
        }

        // Crée la nouvelle délégation auto
        now := time.Now().UTC()
        d := model.Delegation{
                ID:           newCuidLikeID(),
                EntrepriseID: entrepriseID,
                FromUserID:   fromUserID,
                ToUserID:     userID,
                Domain:       domain,
                Permissions:  permission,
                Statut:       model.DelegationStatutActif,
                Raison:       &raison,
                CreatedAt:    now,
                UpdatedAt:    now,
        }
        if err := r.migrationsDB.WithContext(ctx).Create(&d).Error; err != nil {
                return nil, fmt.Errorf("create auto-grant: %w", err)
        }
        return &d, nil
}

// RevokeAutoGrantByUser — révoque TOUTES les délégations auto actives d'un user.
//
// Utilisé quand la fonction d'un EMPLOYE change ou est retirée : on révoque
// l'ancienne délégation auto avant d'en créer une nouvelle (ou aucune si la
// nouvelle fonction n'a pas de mapping).
//
// Retourne le nombre de délégations révoquées. Idempotent.
func (r *DelegationRepository) RevokeAutoGrantByUser(ctx context.Context, userID, entrepriseID string) (int64, error) {
        if r.migrationsDB == nil {
                return 0, fmt.Errorf("migrations DB is required for RevokeAutoGrantByUser")
        }
        if userID == "" {
                return 0, nil
        }
        now := time.Now().UTC()
        res := r.migrationsDB.WithContext(ctx).Model(&model.Delegation{}).
                Where(`"toUserId" = ? AND statut = ? AND raison LIKE ?`,
                        userID, model.DelegationStatutActif, AutoGrantPrefix+"%").
                Updates(map[string]any{
                        "statut":    model.DelegationStatutRevoque,
                        "updatedAt": now,
                })
        if res.Error != nil {
                return 0, fmt.Errorf("revoke auto-grant: %w", res.Error)
        }
        return res.RowsAffected, nil
}
