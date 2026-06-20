// Package dto — saas_dto.go
// DTOs pour les routes SaaS :
//   - /api/v1/admin/*         (SUPER_ADMIN only) — dashboard, entreprises, subscriptions, support-access
//   - /api/v1/support-access/* (GERANT)          — approval flow for support access requests
//
// Format wire (JSON) aligné sur le frontend Next.js (camelCase).
package dto

import (
	"opuc/internal/domain/model"
)

// ── SupportAccess ───────────────────────────────────────────────────

// SupportAccessRequestRequest — payload POST /api/v1/admin/support-access/request
type SupportAccessRequestRequest struct {
	EntrepriseID string `json:"entrepriseId"`
	Raison       string `json:"raison"`
}

// SupportAccessListResponse — réponse GET /api/v1/admin/support-access et GET /api/v1/support-access
type SupportAccessListResponse struct {
	Data     []model.SupportAccess `json:"data"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

// ── Subscriptions ───────────────────────────────────────────────────

// CreateSubscriptionRequest — payload POST /api/v1/admin/subscriptions
type CreateSubscriptionRequest struct {
	EntrepriseID string `json:"entrepriseId"`
	Plan         string `json:"plan"` // STARTER, PRO, ENTERPRISE
}

// ChangePlanRequest — payload PUT /api/v1/admin/subscriptions/{id}
type ChangePlanRequest struct {
	Plan string `json:"plan"`
}

// SubscriptionListResponse — réponse GET /api/v1/admin/subscriptions
type SubscriptionListResponse struct {
	Data     []model.Subscription `json:"data"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
}

// ── Admin Entreprises ───────────────────────────────────────────────

// CreateEntrepriseRequest — payload POST /api/v1/admin/entreprises
type CreateEntrepriseRequest struct {
	Nom       string  `json:"nom"`
	Adresse   *string `json:"adresse,omitempty"`
	Telephone *string `json:"telephone,omitempty"`
	Email     *string `json:"email,omitempty"`
	Status    string  `json:"status,omitempty"` // défaut "active"
}

// UpdateEntrepriseRequest — payload PUT /api/v1/admin/entreprises/{id}
// Tous les champs optionnels (seuls les non-nil sont updatés).
type UpdateEntrepriseRequest struct {
	Nom       *string `json:"nom,omitempty"`
	Adresse   *string `json:"adresse,omitempty"`
	Telephone *string `json:"telephone,omitempty"`
	Email     *string `json:"email,omitempty"`
}

// EntrepriseListResponse — réponse GET /api/v1/admin/entreprises
type EntrepriseListResponse struct {
	Data     []model.Entreprise `json:"data"`
	Total    int64              `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
}

// EntrepriseDetailResponse — réponse GET /api/v1/admin/entreprises/{id}
// Contient l'entreprise + compteurs + abonnement.
type EntrepriseDetailResponse struct {
	Entreprise   *model.Entreprise   `json:"entreprise"`
	Stats        map[string]any      `json:"stats"`
	Subscription *model.Subscription `json:"subscription,omitempty"`
}

// ── Admin Dashboard ─────────────────────────────────────────────────

// DashboardStatsResponse — réponse GET /api/v1/admin/dashboard
// KPIs plateforme : {totalEntreprises, totalUsers, activeSubscriptions, trialSubscriptions, mrr}
type DashboardStatsResponse struct {
	TotalEntreprises    int64   `json:"totalEntreprises"`
	TotalUsers          int64   `json:"totalUsers"`
	ActiveSubscriptions int64   `json:"activeSubscriptions"`
	TrialSubscriptions  int64   `json:"trialSubscriptions"`
	MRR                 float64 `json:"mrr"`
}

// ── Generic OK ──────────────────────────────────────────────────────

// OKResponse — réponse simple {"ok": true, "id": "..."} pour actions sans body.
type OKResponse struct {
	OK bool   `json:"ok"`
	ID string `json:"id,omitempty"`
}
