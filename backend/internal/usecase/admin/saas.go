// Package admin — saas.go
// Usecase pour les fonctionnalités SaaS de la plateforme O.P.U.C :
//   - SupportAccess   : demandes d'accès SUPER_ADMIN ↔ GERANT (consentement explicite)
//   - Subscriptions   : abonnements STARTER/PRO/ENTERPRISE (trial 14 jours par défaut)
//   - Admin Dashboard : KPIs plateforme + CRUD entreprises (SUPER_ADMIN only)
//
// Hiérarchie d'autorisation :
//   - SUPER_ADMIN : peut lister toutes les demandes/abonnements/entreprises,
//                   créer des abonnements, suspendre/réactiver des tenants
//   - GERANT      : peut voir les demandes de SON entreprise, les approuver/refuser,
//                   révoquer un accès actif sur SON entreprise
//   - Autres      : peuvent voir les demandes de SON entreprise (lecture seule)
//
// Repos utilisés (tous via connexion Migrations / bypass RLS) :
//   - gorm.SupportAccessRepo
//   - gorm.SubscriptionRepo
//   - gorm.AdminEntrepriseRepo
//
// Le usecase fait toute l'autorisation (rôle + ownership), pas la DB.
package admin

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/repository/gorm"
)

// ── Repos interfaces (injection) ────────────────────────────────────
// On dépend d'interfaces (pas du struct concret) pour faciliter les tests.
// Mais comme les signatures des méthodes sont simples, on accepte directement
// les pointeurs vers les repos concrets. Le usecase ne fait que de l'orchestration.

// SaaSRepos — agrège les 3 repos nécessaires au usecase SaaS.
type SaaSRepos struct {
	SupportAccess   *gorm.SupportAccessRepo
	Subscription    *gorm.SubscriptionRepo
	AdminEntreprise *gorm.AdminEntrepriseRepo
}

// ── Inputs / Filters ────────────────────────────────────────────────

// SupportAccessListInput — critères de filtrage pour ListRequests.
// SUPER_ADMIN: ne set pas EntrepriseID → voit toutes les demandes.
// GERANT/autre: set EntrepriseID = auth.EntrepriseID → ne voit que les siennes.
type SupportAccessListInput struct {
	Statut       string
	EntrepriseID string
	SuperAdminID string
	Page         int
	PageSize     int
}

// SubscriptionListInput — critères de filtrage pour ListSubscriptions.
type SubscriptionListInput struct {
	Plan         string
	Statut       string
	EntrepriseID string
	Page         int
	PageSize     int
}

// EntrepriseListInput — critères de filtrage pour ListEntreprises.
type EntrepriseListInput struct {
	Search   string
	Status   string
	Page     int
	PageSize int
}

// CreateEntrepriseInput — payload pour créer une entreprise.
type CreateEntrepriseInput struct {
	Nom       string
	Adresse   *string
	Telephone *string
	Email     *string
	Status    string // défaut "active"
}

// UpdateEntrepriseInput — payload pour update (tous optionnels).
type UpdateEntrepriseInput struct {
	Nom       *string
	Adresse   *string
	Telephone *string
	Email     *string
}

// ── Usecase ─────────────────────────────────────────────────────────

// Usecase — cas d'usage SaaS (SupportAccess + Subscriptions + Admin).
type Usecase struct {
	repos SaaSRepos
	log   *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repos SaaSRepos, log *slog.Logger) *Usecase {
	return &Usecase{repos: repos, log: log}
}

// ── SupportAccess ────────────────────────────────────────────────────

// RequestAccess — SUPER_ADMIN crée une demande d'accès (statut=DEMANDE).
// Règles :
//   - auth.Role doit être SUPER_ADMIN
//   - entrepriseId doit être non vide
//   - raison doit être non vide
func (uc *Usecase) RequestAccess(ctx context.Context, auth *database.AuthUser, entrepriseID, raison string) (*model.SupportAccess, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	entrepriseID = strings.TrimSpace(entrepriseID)
	raison = strings.TrimSpace(raison)
	if entrepriseID == "" {
		return nil, fmt.Errorf("%w: entrepriseId is required", domain.ErrBadRequest)
	}
	if raison == "" {
		return nil, fmt.Errorf("%w: raison is required", domain.ErrBadRequest)
	}

	// Vérifie que l'entreprise existe (et est active)
	ent, err := uc.repos.AdminEntreprise.GetByID(ctx, entrepriseID)
	if err != nil {
		uc.log.Error("admin.RequestAccess: GetByID", "err", err, "ent", entrepriseID)
		return nil, domain.ErrInternal
	}
	if ent == nil {
		return nil, domain.ErrNotFound
	}

	sa, err := uc.repos.SupportAccess.RequestAccess(ctx, auth.UserID, entrepriseID, raison)
	if err != nil {
		uc.log.Error("admin.RequestAccess: repo", "err", err, "auth", auth.UserID)
		return nil, domain.ErrInternal
	}
	uc.log.Info("support access requested",
		"id", sa.ID, "superAdmin", auth.UserID, "ent", entrepriseID,
	)
	return sa, nil
}

// ListRequests — liste les demandes d'accès.
// SUPER_ADMIN voit tout. Les autres rôles ne voient que les demandes de leur entreprise.
func (uc *Usecase) ListRequests(ctx context.Context, auth *database.AuthUser, in SupportAccessListInput) ([]model.SupportAccess, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	// Non-SUPER_ADMIN : force EntrepriseID = auth.EntrepriseID (ne peut voir que sa boîte)
	if auth.Role != "SUPER_ADMIN" {
		if auth.EntrepriseID == "" {
			return nil, 0, fmt.Errorf("%w: non-admin user has no entrepriseId", domain.ErrBadRequest)
		}
		in.EntrepriseID = auth.EntrepriseID
	}

	items, total, err := uc.repos.SupportAccess.ListRequests(ctx, gorm.SupportAccessFilter(in))
	if err != nil {
		uc.log.Error("admin.ListRequests", "err", err, "auth", auth.UserID)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// ApproveAccess — GERANT approuve une demande d'accès.
// Règles :
//   - auth.Role doit être GERANT (les autres rôles ne peuvent pas approuver)
//   - auth.EntrepriseID doit matcher supportAccess.EntrepriseID
//   - Le statut doit être DEMANDE
func (uc *Usecase) ApproveAccess(ctx context.Context, auth *database.AuthUser, id string) (*model.SupportAccess, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "GERANT" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	sa, err := uc.repos.SupportAccess.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.ApproveAccess: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if sa == nil {
		return nil, domain.ErrNotFound
	}
	// Vérifie ownership : le GERANT ne peut approuver que pour sa propre entreprise
	if sa.EntrepriseID != auth.EntrepriseID {
		return nil, domain.ErrForbidden
	}
	updated, err := uc.repos.SupportAccess.Approve(ctx, id, auth.UserID)
	if err != nil {
		uc.log.Error("admin.ApproveAccess: repo.Approve", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	// Log l'action
	_ = uc.repos.SupportAccess.LogAction(ctx, id, fmt.Sprintf("APPROVED by %s", auth.UserID))
	uc.log.Info("support access approved",
		"id", id, "gerant", auth.UserID, "ent", sa.EntrepriseID,
	)
	return updated, nil
}

// RefuseAccess — GERANT refuse une demande d'accès.
func (uc *Usecase) RefuseAccess(ctx context.Context, auth *database.AuthUser, id string) (*model.SupportAccess, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "GERANT" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	sa, err := uc.repos.SupportAccess.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.RefuseAccess: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if sa == nil {
		return nil, domain.ErrNotFound
	}
	if sa.EntrepriseID != auth.EntrepriseID {
		return nil, domain.ErrForbidden
	}
	updated, err := uc.repos.SupportAccess.Refuse(ctx, id, auth.UserID)
	if err != nil {
		uc.log.Error("admin.RefuseAccess: repo.Refuse", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	_ = uc.repos.SupportAccess.LogAction(ctx, id, fmt.Sprintf("REFUSED by %s", auth.UserID))
	uc.log.Info("support access refused",
		"id", id, "gerant", auth.UserID, "ent", sa.EntrepriseID,
	)
	return updated, nil
}

// RevokeAccess — révoque un accès actif.
// Règles :
//   - SUPER_ADMIN peut révoquer n'importe quel accès
//   - GERANT peut révoquer un accès sur sa propre entreprise
//   - Le statut doit être AUTORISE
func (uc *Usecase) RevokeAccess(ctx context.Context, auth *database.AuthUser, id string) (*model.SupportAccess, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	sa, err := uc.repos.SupportAccess.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.RevokeAccess: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if sa == nil {
		return nil, domain.ErrNotFound
	}
	// Autorisation : SUPER_ADMIN ou GERANT de l'entreprise
	if auth.Role != "SUPER_ADMIN" {
		if auth.Role != "GERANT" {
			return nil, domain.ErrForbidden
		}
		if sa.EntrepriseID != auth.EntrepriseID {
			return nil, domain.ErrForbidden
		}
	}
	updated, err := uc.repos.SupportAccess.Revoke(ctx, id, auth.UserID)
	if err != nil {
		uc.log.Error("admin.RevokeAccess: repo.Revoke", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	_ = uc.repos.SupportAccess.LogAction(ctx, id, fmt.Sprintf("REVOKED by %s", auth.UserID))
	uc.log.Info("support access revoked",
		"id", id, "by", auth.UserID, "ent", sa.EntrepriseID,
	)
	return updated, nil
}

// HasActiveAccess — vérifie si superAdminID a un accès actif sur entrepriseID.
// Public (pas d'auth requis côté usecase) — utilisé pour vérifier l'accès RLS.
func (uc *Usecase) HasActiveAccess(ctx context.Context, superAdminID, entrepriseID string) (bool, error) {
	return uc.repos.SupportAccess.HasActiveAccess(ctx, superAdminID, entrepriseID)
}

// ── Subscriptions ───────────────────────────────────────────────────

// GetSubscription — retourne l'abonnement d'une entreprise.
// Règles :
//   - SUPER_ADMIN peut voir n'importe quelle entreprise
//   - Autres rôles ne voient que leur propre entreprise
func (uc *Usecase) GetSubscription(ctx context.Context, auth *database.AuthUser, entrepriseID string) (*model.Subscription, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	entrepriseID = strings.TrimSpace(entrepriseID)
	if entrepriseID == "" {
		return nil, fmt.Errorf("%w: entrepriseId is required", domain.ErrBadRequest)
	}
	if auth.Role != "SUPER_ADMIN" && entrepriseID != auth.EntrepriseID {
		return nil, domain.ErrForbidden
	}
	sub, err := uc.repos.Subscription.GetByEntreprise(ctx, entrepriseID)
	if err != nil {
		uc.log.Error("admin.GetSubscription", "err", err, "ent", entrepriseID)
		return nil, domain.ErrInternal
	}
	if sub == nil {
		return nil, domain.ErrNotFound
	}
	return sub, nil
}

// CreateSubscription — crée un abonnement pour une entreprise.
// Règles :
//   - auth.Role doit être SUPER_ADMIN
//   - plan doit être STARTER, PRO ou ENTERPRISE
//   - Si l'entreprise a déjà un abonnement → 409 Conflict
//   - Statut initial = TRIAL, trialEndsAt = now+14 jours
//   - Les quotas (MaxUsers, MaxChantiers, MaxStorageMB) et Amount viennent de PlanConfigs
func (uc *Usecase) CreateSubscription(ctx context.Context, auth *database.AuthUser, entrepriseID, plan string) (*model.Subscription, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	entrepriseID = strings.TrimSpace(entrepriseID)
	if entrepriseID == "" {
		return nil, fmt.Errorf("%w: entrepriseId is required", domain.ErrBadRequest)
	}
	if !isValidPlan(plan) {
		return nil, fmt.Errorf("%w: invalid plan %q (allowed: STARTER, PRO, ENTERPRISE)", domain.ErrBadRequest, plan)
	}
	// Vérifie que l'entreprise existe
	ent, err := uc.repos.AdminEntreprise.GetByID(ctx, entrepriseID)
	if err != nil {
		uc.log.Error("admin.CreateSubscription: GetByID", "err", err)
		return nil, domain.ErrInternal
	}
	if ent == nil {
		return nil, domain.ErrNotFound
	}
	// Vérifie qu'il n'existe pas déjà un abonnement
	existing, err := uc.repos.Subscription.GetByEntreprise(ctx, entrepriseID)
	if err != nil {
		uc.log.Error("admin.CreateSubscription: GetByEntreprise", "err", err)
		return nil, domain.ErrInternal
	}
	if existing != nil {
		return nil, domain.ErrConflict
	}

	cfg := model.PlanConfigs[plan]
	now := time.Now().UTC()
	trialEnd := now.Add(14 * 24 * time.Hour) // 14 jours de trial
	sub := &model.Subscription{
		EntrepriseID: entrepriseID,
		Plan:         plan,
		Statut:       model.SubStatutTrial,
		TrialEndsAt:  &trialEnd,
		Amount:       cfg.Amount,
		Currency:     "XOF",
		MaxUsers:     cfg.MaxUsers,
		MaxChantiers: cfg.MaxChantiers,
		MaxStorageMB: cfg.MaxStorageMB,
	}
	created, err := uc.repos.Subscription.Create(ctx, sub)
	if err != nil {
		uc.log.Error("admin.CreateSubscription: Create", "err", err)
		return nil, domain.ErrInternal
	}
	uc.log.Info("subscription created",
		"id", created.ID, "ent", entrepriseID, "plan", plan,
	)
	return created, nil
}

// ChangePlan — change le plan d'un abonnement. Met à jour Amount + quotas.
// Règles :
//   - auth.Role doit être SUPER_ADMIN
//   - plan doit être valide
func (uc *Usecase) ChangePlan(ctx context.Context, auth *database.AuthUser, id, newPlan string) (*model.Subscription, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	if !isValidPlan(newPlan) {
		return nil, fmt.Errorf("%w: invalid plan %q (allowed: STARTER, PRO, ENTERPRISE)", domain.ErrBadRequest, newPlan)
	}
	cfg := model.PlanConfigs[newPlan]
	updates := map[string]any{
		"plan":         newPlan,
		"amount":       cfg.Amount,
		"maxUsers":     cfg.MaxUsers,
		"maxChantiers": cfg.MaxChantiers,
		"maxStorageMB": cfg.MaxStorageMB,
	}
	updated, err := uc.repos.Subscription.Update(ctx, id, updates)
	if err != nil {
		uc.log.Error("admin.ChangePlan: Update", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	uc.log.Info("subscription plan changed",
		"id", id, "newPlan", newPlan, "by", auth.UserID,
	)
	return updated, nil
}

// CancelSubscription — annule un abonnement (statut=CANCELED).
// Règles :
//   - auth.Role doit être SUPER_ADMIN
func (uc *Usecase) CancelSubscription(ctx context.Context, auth *database.AuthUser, id string) (*model.Subscription, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	cancelled, err := uc.repos.Subscription.Cancel(ctx, id)
	if err != nil {
		uc.log.Error("admin.CancelSubscription: Cancel", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if cancelled == nil {
		return nil, domain.ErrNotFound
	}
	uc.log.Info("subscription cancelled", "id", id, "by", auth.UserID)
	return cancelled, nil
}

// ListSubscriptions — liste les abonnements (SUPER_ADMIN only).
func (uc *Usecase) ListSubscriptions(ctx context.Context, auth *database.AuthUser, in SubscriptionListInput) ([]model.Subscription, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, 0, domain.ErrForbidden
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repos.Subscription.List(ctx, gorm.SubscriptionFilter(in))
	if err != nil {
		uc.log.Error("admin.ListSubscriptions", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// ── Admin Dashboard ─────────────────────────────────────────────────

// GetDashboardStats — KPIs plateforme (SUPER_ADMIN only).
// Retourne {totalEntreprises, totalUsers, activeSubscriptions, trialSubscriptions, mrr}.
func (uc *Usecase) GetDashboardStats(ctx context.Context, auth *database.AuthUser) (map[string]any, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	stats, err := uc.repos.AdminEntreprise.GetDashboardStats(ctx)
	if err != nil {
		uc.log.Error("admin.GetDashboardStats", "err", err)
		return nil, domain.ErrInternal
	}
	return stats, nil
}

// ListEntreprises — liste paginée des entreprises (SUPER_ADMIN only).
func (uc *Usecase) ListEntreprises(ctx context.Context, auth *database.AuthUser, in EntrepriseListInput) ([]model.Entreprise, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, 0, domain.ErrForbidden
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repos.AdminEntreprise.List(ctx, gorm.AdminEntrepriseFilter(in))
	if err != nil {
		uc.log.Error("admin.ListEntreprises", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// EntrepriseDetail — retour structuré pour GetEntrepriseDetail.
// Contient l'entreprise + compteurs (users/chantiers/factures) + abonnement.
type EntrepriseDetail struct {
	Entreprise  *model.Entreprise  `json:"entreprise"`
	Stats       map[string]any     `json:"stats"`
	Subscription *model.Subscription `json:"subscription,omitempty"`
}

// GetEntrepriseDetail — détail d'une entreprise + stats (users/chantiers/factures).
// SUPER_ADMIN only.
func (uc *Usecase) GetEntrepriseDetail(ctx context.Context, auth *database.AuthUser, id string) (*EntrepriseDetail, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	ent, err := uc.repos.AdminEntreprise.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.GetEntrepriseDetail: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if ent == nil {
		return nil, domain.ErrNotFound
	}
	stats, err := uc.repos.AdminEntreprise.GetStats(ctx, id)
	if err != nil {
		uc.log.Error("admin.GetEntrepriseDetail: GetStats", "err", err, "id", id)
		// Non bloquant : on retourne l'entreprise sans stats
		stats = map[string]any{"users": int64(0), "chantiers": int64(0), "factures": int64(0)}
	}
	// Optionnel : récupère l'abonnement
	sub, _ := uc.repos.Subscription.GetByEntreprise(ctx, id)

	return &EntrepriseDetail{
		Entreprise:   ent,
		Stats:        stats,
		Subscription: sub,
	}, nil
}

// CreateEntreprise — crée une nouvelle entreprise (SUPER_ADMIN only).
// Retourne l'entreprise créée.
func (uc *Usecase) CreateEntreprise(ctx context.Context, auth *database.AuthUser, in CreateEntrepriseInput) (*model.Entreprise, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	in.Nom = strings.TrimSpace(in.Nom)
	if in.Nom == "" {
		return nil, fmt.Errorf("%w: nom is required", domain.ErrBadRequest)
	}
	status := in.Status
	if status == "" {
		status = "active"
	}
	e := &model.Entreprise{
		Nom:       in.Nom,
		Adresse:   in.Adresse,
		Telephone: in.Telephone,
		Email:     in.Email,
		Status:    status,
	}
	created, err := uc.repos.AdminEntreprise.Create(ctx, e)
	if err != nil {
		uc.log.Error("admin.CreateEntreprise: Create", "err", err)
		return nil, domain.ErrInternal
	}
	uc.log.Info("entreprise created", "id", created.ID, "nom", created.Nom, "by", auth.UserID)
	return created, nil
}

// UpdateEntreprise — met à jour une entreprise (SUPER_ADMIN only).
// Tous les champs du payload sont optionnels (seuls les non-nil sont updatés).
func (uc *Usecase) UpdateEntreprise(ctx context.Context, auth *database.AuthUser, id string, in UpdateEntrepriseInput) (*model.Entreprise, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return nil, domain.ErrForbidden
	}
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	updates := map[string]any{}
	if in.Nom != nil {
		v := strings.TrimSpace(*in.Nom)
		if v == "" {
			return nil, fmt.Errorf("%w: nom cannot be empty", domain.ErrBadRequest)
		}
		updates["nom"] = v
	}
	if in.Adresse != nil {
		updates["adresse"] = *in.Adresse
	}
	if in.Telephone != nil {
		updates["telephone"] = *in.Telephone
	}
	if in.Email != nil {
		updates["email"] = *in.Email
	}
	updated, err := uc.repos.AdminEntreprise.Update(ctx, id, updates)
	if err != nil {
		uc.log.Error("admin.UpdateEntreprise: Update", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// SuspendEntreprise — suspend une entreprise (status=suspended). SUPER_ADMIN only.
func (uc *Usecase) SuspendEntreprise(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return domain.ErrForbidden
	}
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	// Vérifie que l'entreprise existe
	ent, err := uc.repos.AdminEntreprise.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.SuspendEntreprise: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if ent == nil {
		return domain.ErrNotFound
	}
	if err := uc.repos.AdminEntreprise.Suspend(ctx, id); err != nil {
		uc.log.Error("admin.SuspendEntreprise: Suspend", "err", err, "id", id)
		return domain.ErrInternal
	}
	uc.log.Info("entreprise suspended", "id", id, "by", auth.UserID)
	return nil
}

// ReactivateEntreprise — réactive une entreprise (status=active). SUPER_ADMIN only.
func (uc *Usecase) ReactivateEntreprise(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if auth.Role != "SUPER_ADMIN" {
		return domain.ErrForbidden
	}
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}
	ent, err := uc.repos.AdminEntreprise.GetByID(ctx, id)
	if err != nil {
		uc.log.Error("admin.ReactivateEntreprise: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if ent == nil {
		return domain.ErrNotFound
	}
	if err := uc.repos.AdminEntreprise.Reactivate(ctx, id); err != nil {
		uc.log.Error("admin.ReactivateEntreprise: Reactivate", "err", err, "id", id)
		return domain.ErrInternal
	}
	uc.log.Info("entreprise reactivated", "id", id, "by", auth.UserID)
	return nil
}

// ── helpers ─────────────────────────────────────────────────────────

// isValidPlan vérifie qu'un plan est dans la liste des 3 plans SaaS.
func isValidPlan(p string) bool {
	switch p {
	case model.PlanStarter, model.PlanPro, model.PlanEnterprise:
		return true
	}
	return false
}
