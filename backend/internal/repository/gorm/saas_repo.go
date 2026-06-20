// Package gorm — saas_repo.go
// Repositories pour les fonctionnalités SaaS (Phase 6) :
//   - SupportAccessRepo     : demandes d'accès support (SUPER_ADMIN ↔ GERANT)
//   - SubscriptionRepo      : abonnements SaaS (STARTER/PRO/ENTERPRISE)
//   - AdminEntrepriseRepo   : CRUD admin des tenants (SUPER_ADMIN only)
//
// Connexions :
//   - Ces 3 repos utilisent la connexion Migrations (postgres, BYPASS RLS).
//     Pourquoi ? SupportAccess et Subscription sont des ressources *plateforme* :
//     elles couvrent plusieurs tenants (un SUPER_ADMIN peut avoir des demandes
//     sur N entreprises). Le filtrage RLS tenant_isolation ne s'applique donc
//     pas nativement, et le usecase fait l'autorisation (vérifie rôle + ownership).
//   - AdminEntrepriseRepo liste TOUTES les entreprises (KPIs plateforme) — c'est
//     par nature cross-tenant, donc Migrations + pas de WithTenant.
//
// RLS est quand même activé sur SupportAccess et Subscription (cf. cmd/update_rls_saas)
// pour defense-in-depth : si jamais une requête passait par Runtime + WithTenant,
// le policy tenant_isolation filtrerait correctement (SUPER_ADMIN bypass ou
// entrepriseId = current_tenant).
package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"

	"gorm.io/gorm"
)

// ────────────────────────────────────────────────────────────────────
// SupportAccessRepo
// ────────────────────────────────────────────────────────────────────

// SupportAccessRepo — repository pour les demandes d'accès support.
// Utilise la connexion Migrations (bypass RLS) : le usecase fait l'autorisation.
type SupportAccessRepo struct {
	db *gorm.DB // Migrations (postgres, bypass RLS)
}

// NewSupportAccessRepo constructeur.
func NewSupportAccessRepo(migrationsDB *gorm.DB) *SupportAccessRepo {
	return &SupportAccessRepo{db: migrationsDB}
}

// SupportAccessFilter — critères de filtrage pour ListRequests.
// Tous les champs sont optionnels (chaîne vide = pas de filtre).
type SupportAccessFilter struct {
	Statut        string
	EntrepriseID  string
	SuperAdminID  string
	Page          int
	PageSize      int
}

// RequestAccess — crée une nouvelle demande d'accès (statut=DEMANDE).
// L'ID est généré si vide. Les timestamps demandeLe/createdAt/updatedAt sont set.
func (r *SupportAccessRepo) RequestAccess(ctx context.Context, superAdminID, entrepriseID, raison string) (*model.SupportAccess, error) {
	if superAdminID == "" || entrepriseID == "" {
		return nil, fmt.Errorf("superAdminID and entrepriseID are required")
	}
	if raison == "" {
		return nil, fmt.Errorf("raison is required")
	}

	now := time.Now().UTC()
	sa := model.SupportAccess{
		ID:           newCuidLikeID(),
		SuperAdminID: superAdminID,
		EntrepriseID: entrepriseID,
		Raison:       raison,
		Statut:       model.SupportStatutDemande,
		DemandeLe:    now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := r.db.WithContext(ctx).Create(&sa).Error; err != nil {
		return nil, fmt.Errorf("create support access: %w", err)
	}
	return &sa, nil
}

// ListRequests — liste paginée des demandes d'accès (filtrage optionnel).
// Retourne (items, total, err). Ordonné par demandeLe DESC.
func (r *SupportAccessRepo) ListRequests(ctx context.Context, filter SupportAccessFilter) ([]model.SupportAccess, int64, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	q := r.db.WithContext(ctx).Model(&model.SupportAccess{})
	if filter.Statut != "" {
		q = q.Where("statut = ?", filter.Statut)
	}
	if filter.EntrepriseID != "" {
		q = q.Where(`"entrepriseId" = ?`, filter.EntrepriseID)
	}
	if filter.SuperAdminID != "" {
		q = q.Where(`"superAdminId" = ?`, filter.SuperAdminID)
	}

	var (
		items []model.SupportAccess
		total int64
	)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count support accesses: %w", err)
	}
	if err := q.
		Order(`"demandeLe" DESC`).
		Offset(offset).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("list support accesses: %w", err)
	}
	return items, total, nil
}

// GetByID — récupère une demande par ID. (nil, nil) si non trouvé.
func (r *SupportAccessRepo) GetByID(ctx context.Context, id string) (*model.SupportAccess, error) {
	if id == "" {
		return nil, nil
	}
	var sa model.SupportAccess
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&sa).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get support access: %w", err)
	}
	return &sa, nil
}

// Approve — approuve une demande (statut=AUTORISE, autoriseLe=now, expireLe=now+4h).
// Vérifie que le statut courant est DEMANDE (sinon retourne une erreur).
// autoriseParId = gerantID (le GERANT qui approuve).
func (r *SupportAccessRepo) Approve(ctx context.Context, id, gerantID string) (*model.SupportAccess, error) {
	if id == "" || gerantID == "" {
		return nil, fmt.Errorf("id and gerantID are required")
	}
	sa, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sa == nil {
		return nil, nil // non trouvé → (nil, nil)
	}
	if sa.Statut != model.SupportStatutDemande {
		return nil, fmt.Errorf("cannot approve: current statut is %s, expected DEMANDE", sa.Statut)
	}

	now := time.Now().UTC()
	expire := now.Add(model.MaxSupportAccessDuration)
	gid := gerantID

	updates := map[string]any{
		"statut":        model.SupportStatutAutorise,
		"autoriseLe":    &now,
		"expireLe":      &expire,
		"autoriseParId": &gid,
		"updatedAt":     now,
	}
	if err := r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where("id = ?", id).
		Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("approve support access: %w", err)
	}
	// Re-fetch pour retourner l'objet à jour
	return r.GetByID(ctx, id)
}

// Refuse — refuse une demande (statut=REFUSE). Vérifie que le statut est DEMANDE.
func (r *SupportAccessRepo) Refuse(ctx context.Context, id, gerantID string) (*model.SupportAccess, error) {
	if id == "" || gerantID == "" {
		return nil, fmt.Errorf("id and gerantID are required")
	}
	sa, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sa == nil {
		return nil, nil
	}
	if sa.Statut != model.SupportStatutDemande {
		return nil, fmt.Errorf("cannot refuse: current statut is %s, expected DEMANDE", sa.Statut)
	}

	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"statut":    model.SupportStatutRefuse,
			"updatedAt": now,
		}).Error; err != nil {
		return nil, fmt.Errorf("refuse support access: %w", err)
	}
	return r.GetByID(ctx, id)
}

// Revoke — révoque un accès autorisé (statut=REVOQUE, revoqueLe=now).
// Vérifie que le statut courant est AUTORISE (sinon erreur).
// revoqueParId = revokedBy (SUPER_ADMIN ou GERANT).
func (r *SupportAccessRepo) Revoke(ctx context.Context, id, revokedBy string) (*model.SupportAccess, error) {
	if id == "" || revokedBy == "" {
		return nil, fmt.Errorf("id and revokedBy are required")
	}
	sa, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sa == nil {
		return nil, nil
	}
	if sa.Statut != model.SupportStatutAutorise {
		return nil, fmt.Errorf("cannot revoke: current statut is %s, expected AUTORISE", sa.Statut)
	}

	now := time.Now().UTC()
	rb := revokedBy
	if err := r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"statut":       model.SupportStatutRevoque,
			"revoqueLe":    &now,
			"revoqueParId": &rb,
			"updatedAt":    now,
		}).Error; err != nil {
		return nil, fmt.Errorf("revoke support access: %w", err)
	}
	return r.GetByID(ctx, id)
}

// HasActiveAccess — vérifie s'il existe un accès AUTORISE non expiré pour
// (superAdminID, entrepriseID). Utilisé par la policy RLS app_has_support_access.
func (r *SupportAccessRepo) HasActiveAccess(ctx context.Context, superAdminID, entrepriseID string) (bool, error) {
	if superAdminID == "" || entrepriseID == "" {
		return false, nil
	}
	now := time.Now().UTC()
	var n int64
	err := r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where(`"superAdminId" = ? AND "entrepriseId" = ? AND statut = ?`,
			superAdminID, entrepriseID, model.SupportStatutAutorise).
		Where(`"expireLe" IS NULL OR "expireLe" > ?`, now).
		Count(&n).Error
	if err != nil {
		return false, fmt.Errorf("has active access: %w", err)
	}
	return n > 0, nil
}

// LogAction — ajoute une entrée au journal d'actions (actionsLog JSON).
// Format : tableau d'objets {"action": "...", "at": "RFC3339"}.
// Si actionsLog est NULL, initialise un nouveau tableau.
func (r *SupportAccessRepo) LogAction(ctx context.Context, id, action string) error {
	if id == "" || action == "" {
		return fmt.Errorf("id and action are required")
	}
	sa, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if sa == nil {
		return gorm.ErrRecordNotFound
	}

	var entries []map[string]any
	if sa.ActionsLog != nil && *sa.ActionsLog != "" {
		// Best-effort : si parse échoue, on écrase avec un tableau neuf
		_ = json.Unmarshal([]byte(*sa.ActionsLog), &entries)
	}
	if entries == nil {
		entries = []map[string]any{}
	}
	entries = append(entries, map[string]any{
		"action": action,
		"at":     time.Now().UTC().Format(time.RFC3339),
	})
	b, err := json.Marshal(entries)
	if err != nil {
		return fmt.Errorf("marshal actions log: %w", err)
	}
	str := string(b)
	return r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"actionsLog": &str,
			"updatedAt":  time.Now().UTC(),
		}).Error
}

// ExpireOld — marque comme EXPIRE tous les accès AUTORISE dont expireLe < now.
// Retourne le nombre de lignes affectées. Idempotent.
func (r *SupportAccessRepo) ExpireOld(ctx context.Context) (int64, error) {
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&model.SupportAccess{}).
		Where("statut = ? AND \"expireLe\" IS NOT NULL AND \"expireLe\" < ?", model.SupportStatutAutorise, now).
		Updates(map[string]any{
			"statut":    model.SupportStatutExpire,
			"updatedAt": now,
		})
	if res.Error != nil {
		return 0, fmt.Errorf("expire old support accesses: %w", res.Error)
	}
	return res.RowsAffected, nil
}

// ────────────────────────────────────────────────────────────────────
// SubscriptionRepo
// ────────────────────────────────────────────────────────────────────

// SubscriptionRepo — repository pour les abonnements SaaS.
// Utilise Migrations (bypass RLS) — le usecase fait l'autorisation.
type SubscriptionRepo struct {
	db *gorm.DB // Migrations (postgres, bypass RLS)
}

// NewSubscriptionRepo constructeur.
func NewSubscriptionRepo(migrationsDB *gorm.DB) *SubscriptionRepo {
	return &SubscriptionRepo{db: migrationsDB}
}

// SubscriptionFilter — critères de filtrage pour List.
type SubscriptionFilter struct {
	Plan         string
	Statut       string
	EntrepriseID string
	Page         int
	PageSize     int
}

// GetByEntreprise — récupère l'abonnement d'une entreprise. (nil, nil) si non trouvé.
func (r *SubscriptionRepo) GetByEntreprise(ctx context.Context, entrepriseID string) (*model.Subscription, error) {
	if entrepriseID == "" {
		return nil, nil
	}
	var sub model.Subscription
	err := r.db.WithContext(ctx).
		Where(`"entrepriseId" = ?`, entrepriseID).
		First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subscription: %w", err)
	}
	return &sub, nil
}

// Create — crée un abonnement. L'ID est généré si vide.
func (r *SubscriptionRepo) Create(ctx context.Context, sub *model.Subscription) (*model.Subscription, error) {
	if sub == nil {
		return nil, fmt.Errorf("subscription is nil")
	}
	if sub.EntrepriseID == "" {
		return nil, fmt.Errorf("entrepriseId is required")
	}
	if sub.ID == "" {
		sub.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if sub.CreatedAt.IsZero() {
		sub.CreatedAt = now
	}
	if sub.UpdatedAt.IsZero() {
		sub.UpdatedAt = now
	}
	if err := r.db.WithContext(ctx).Create(sub).Error; err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}
	return sub, nil
}

// Update — met à jour un abonnement par ID avec un map d'updates.
// Met à jour updatedAt automatiquement. Retourne l'objet à jour. (nil, nil) si non trouvé.
func (r *SubscriptionRepo) Update(ctx context.Context, id string, updates map[string]any) (*model.Subscription, error) {
	if id == "" {
		return nil, fmt.Errorf("id is required")
	}
	if len(updates) == 0 {
		return r.getByID(ctx, id)
	}
	updates["updatedAt"] = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("id = ?", id).
		Updates(updates)
	if res.Error != nil {
		return nil, fmt.Errorf("update subscription: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return r.getByID(ctx, id)
}

// Cancel — annule un abonnement (statut=CANCELED).
func (r *SubscriptionRepo) Cancel(ctx context.Context, id string) (*model.Subscription, error) {
	if id == "" {
		return nil, fmt.Errorf("id is required")
	}
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"statut":    model.SubStatutCanceled,
			"updatedAt": now,
		})
	if res.Error != nil {
		return nil, fmt.Errorf("cancel subscription: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return r.getByID(ctx, id)
}

// List — liste paginée des abonnements (filtrage optionnel par plan, statut, entreprise).
func (r *SubscriptionRepo) List(ctx context.Context, filter SubscriptionFilter) ([]model.Subscription, int64, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	q := r.db.WithContext(ctx).Model(&model.Subscription{})
	if filter.Plan != "" {
		q = q.Where("plan = ?", filter.Plan)
	}
	if filter.Statut != "" {
		q = q.Where("statut = ?", filter.Statut)
	}
	if filter.EntrepriseID != "" {
		q = q.Where(`"entrepriseId" = ?`, filter.EntrepriseID)
	}

	var (
		items []model.Subscription
		total int64
	)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count subscriptions: %w", err)
	}
	if err := q.
		Order(`"createdAt" DESC`).
		Offset(offset).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("list subscriptions: %w", err)
	}
	return items, total, nil
}

// getByID — helper interne pour fetch un abonnement par ID.
func (r *SubscriptionRepo) getByID(ctx context.Context, id string) (*model.Subscription, error) {
	var sub model.Subscription
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subscription by id: %w", err)
	}
	return &sub, nil
}

// ────────────────────────────────────────────────────────────────────
// AdminEntrepriseRepo — CRUD admin des tenants (SUPER_ADMIN only)
// ────────────────────────────────────────────────────────────────────

// AdminEntrepriseRepo — repository pour la gestion admin des entreprises.
// Utilise Migrations (bypass RLS) — SUPER_ADMIN only. Pas de WithTenant.
type AdminEntrepriseRepo struct {
	db *gorm.DB // Migrations (postgres, bypass RLS)
}

// NewAdminEntrepriseRepo constructeur.
func NewAdminEntrepriseRepo(migrationsDB *gorm.DB) *AdminEntrepriseRepo {
	return &AdminEntrepriseRepo{db: migrationsDB}
}

// AdminEntrepriseFilter — critères de filtrage pour List.
type AdminEntrepriseFilter struct {
	Search   string // ILIKE sur nom, email, telephone
	Status   string // active, suspended, inactive
	Page     int
	PageSize int
}

// List — liste paginée de TOUTES les entreprises. Ordonné par createdAt DESC.
func (r *AdminEntrepriseRepo) List(ctx context.Context, filter AdminEntrepriseFilter) ([]model.Entreprise, int64, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	q := r.db.WithContext(ctx).Model(&model.Entreprise{})
	if filter.Search != "" {
		like := "%" + filter.Search + "%"
		q = q.Where("nom ILIKE ? OR email ILIKE ? OR telephone ILIKE ?", like, like, like)
	}
	if filter.Status != "" {
		q = q.Where("status = ?", filter.Status)
	}

	var (
		items []model.Entreprise
		total int64
	)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count entreprises: %w", err)
	}
	if err := q.
		Order(`"createdAt" DESC`).
		Offset(offset).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("list entreprises: %w", err)
	}
	return items, total, nil
}

// GetByID — récupère une entreprise par ID. (nil, nil) si non trouvée.
func (r *AdminEntrepriseRepo) GetByID(ctx context.Context, id string) (*model.Entreprise, error) {
	if id == "" {
		return nil, nil
	}
	var e model.Entreprise
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&e).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get entreprise: %w", err)
	}
	return &e, nil
}

// Create — crée une nouvelle entreprise. L'ID est généré si vide.
func (r *AdminEntrepriseRepo) Create(ctx context.Context, e *model.Entreprise) (*model.Entreprise, error) {
	if e == nil {
		return nil, fmt.Errorf("entreprise is nil")
	}
	if e.Nom == "" {
		return nil, fmt.Errorf("nom is required")
	}
	if e.ID == "" {
		e.ID = newCuidLikeID()
	}
	if e.Status == "" {
		e.Status = "active"
	}
	now := time.Now().UTC()
	if e.CreatedAt.IsZero() {
		e.CreatedAt = now
	}
	if e.UpdatedAt.IsZero() {
		e.UpdatedAt = now
	}
	if err := r.db.WithContext(ctx).Create(e).Error; err != nil {
		return nil, fmt.Errorf("create entreprise: %w", err)
	}
	return e, nil
}

// Update — met à jour une entreprise par ID avec un map d'updates.
// Retourne l'objet à jour. (nil, nil) si non trouvé.
func (r *AdminEntrepriseRepo) Update(ctx context.Context, id string, updates map[string]any) (*model.Entreprise, error) {
	if id == "" {
		return nil, fmt.Errorf("id is required")
	}
	if len(updates) == 0 {
		return r.GetByID(ctx, id)
	}
	updates["updatedAt"] = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&model.Entreprise{}).
		Where("id = ?", id).
		Updates(updates)
	if res.Error != nil {
		return nil, fmt.Errorf("update entreprise: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return r.GetByID(ctx, id)
}

// Suspend — suspend une entreprise (status=suspended).
func (r *AdminEntrepriseRepo) Suspend(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	return r.db.WithContext(ctx).Model(&model.Entreprise{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":    "suspended",
			"updatedAt": time.Now().UTC(),
		}).Error
}

// Reactivate — réactive une entreprise (status=active).
func (r *AdminEntrepriseRepo) Reactivate(ctx context.Context, id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	return r.db.WithContext(ctx).Model(&model.Entreprise{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":    "active",
			"updatedAt": time.Now().UTC(),
		}).Error
}

// GetStats — retourne des compteurs pour une entreprise : users, chantiers, factures.
// Ces requêtes sont cross-tenant (comptage direct sur les tables), donc utilisent
// la connexion Migrations (bypass RLS).
func (r *AdminEntrepriseRepo) GetStats(ctx context.Context, id string) (map[string]any, error) {
	if id == "" {
		return nil, fmt.Errorf("id is required")
	}
	out := map[string]any{"users": int64(0), "chantiers": int64(0), "factures": int64(0)}

	var users int64
	if err := r.db.WithContext(ctx).Model(&model.User{}).
		Where(`"entrepriseId" = ?`, id).
		Count(&users).Error; err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	out["users"] = users

	var chantiers int64
	if err := r.db.WithContext(ctx).Model(&model.Chantier{}).
		Where(`"entrepriseId" = ?`, id).
		Count(&chantiers).Error; err != nil {
		return nil, fmt.Errorf("count chantiers: %w", err)
	}
	out["chantiers"] = chantiers

	var factures int64
	if err := r.db.WithContext(ctx).Model(&model.Facture{}).
		Where(`"entrepriseId" = ?`, id).
		Count(&factures).Error; err != nil {
		return nil, fmt.Errorf("count factures: %w", err)
	}
	out["factures"] = factures

	return out, nil
}

// GetDashboardStats — KPIs plateforme pour le dashboard SUPER_ADMIN.
// Retourne {totalEntreprises, totalUsers, activeSubscriptions, trialSubscriptions, mrr}.
// MRR (Monthly Recurring Revenue) = somme des montants des abonnements ACTIVE
// (TRIAL不计入 car trial = gratuit).
func (r *AdminEntrepriseRepo) GetDashboardStats(ctx context.Context) (map[string]any, error) {
	out := map[string]any{
		"totalEntreprises":    int64(0),
		"totalUsers":          int64(0),
		"activeSubscriptions": int64(0),
		"trialSubscriptions":  int64(0),
		"mrr":                 float64(0),
	}

	var totalEnt int64
	if err := r.db.WithContext(ctx).Model(&model.Entreprise{}).Count(&totalEnt).Error; err != nil {
		return nil, fmt.Errorf("count entreprises: %w", err)
	}
	out["totalEntreprises"] = totalEnt

	var totalUsers int64
	if err := r.db.WithContext(ctx).Model(&model.User{}).Count(&totalUsers).Error; err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	out["totalUsers"] = totalUsers

	var activeSubs int64
	if err := r.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("statut = ?", model.SubStatutActive).
		Count(&activeSubs).Error; err != nil {
		return nil, fmt.Errorf("count active subscriptions: %w", err)
	}
	out["activeSubscriptions"] = activeSubs

	var trialSubs int64
	if err := r.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("statut = ?", model.SubStatutTrial).
		Count(&trialSubs).Error; err != nil {
		return nil, fmt.Errorf("count trial subscriptions: %w", err)
	}
	out["trialSubscriptions"] = trialSubs

	// MRR = somme des Amount des abonnements ACTIVE (TRIAL exclus car gratuit)
	var mrr float64
	if err := r.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("statut = ?", model.SubStatutActive).
		Select("COALESCE(SUM(amount), 0)").
		Row().Scan(&mrr); err != nil {
		return nil, fmt.Errorf("compute mrr: %w", err)
	}
	out["mrr"] = mrr

	return out, nil
}
