// Package handler — saas_handler.go
// Handlers HTTP pour les routes SaaS :
//
//   SUPER_ADMIN only (sous /api/v1/admin/*) :
//     GET    /admin/dashboard                       — KPIs plateforme
//     GET    /admin/entreprises                     — liste paginée
//     POST   /admin/entreprises                     — create tenant
//     GET    /admin/entreprises/{id}                — détail + stats + abonnement
//     PUT    /admin/entreprises/{id}                — update tenant
//     POST   /admin/entreprises/{id}/suspend        — suspend tenant
//     POST   /admin/entreprises/{id}/reactivate     — reactivate tenant
//     GET    /admin/subscriptions                   — list subscriptions
//     POST   /admin/subscriptions                   — create subscription
//     PUT    /admin/subscriptions/{id}              — change plan
//     POST   /admin/subscriptions/{id}/cancel       — cancel subscription
//     GET    /admin/support-access                  — list requests (all)
//     POST   /admin/support-access/request          — request access
//     POST   /admin/support-access/{id}/revoke      — revoke access
//
//   GERANT (sous /api/v1/support-access/*) :
//     GET    /support-access                        — list requests for own entreprise
//     POST   /support-access/{id}/approve           — approve request
//     POST   /support-access/{id}/refuse            — refuse request
//     POST   /support-access/{id}/revoke            — revoke active access
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par
// middleware.Auth) pour l'autorisation (le usecase fait le check de rôle).
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/admin"
)

// SaaSHandler — handlers HTTP pour /api/v1/admin/* et /api/v1/support-access/*.
type SaaSHandler struct {
	uc  *admin.Usecase
	log *slog.Logger
}

// NewSaaSHandler constructeur.
func NewSaaSHandler(uc *admin.Usecase, log *slog.Logger) *SaaSHandler {
	return &SaaSHandler{uc: uc, log: log}
}

// ── Admin Dashboard ─────────────────────────────────────────────────

// Dashboard — GET /api/v1/admin/dashboard
// KPIs plateforme : {totalEntreprises, totalUsers, activeSubscriptions, trialSubscriptions, mrr}
func (h *SaaSHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	stats, err := h.uc.GetDashboardStats(r.Context(), au)
	if err != nil {
		writeSaaSError(w, h.log, "saas.Dashboard", err)
		return
	}
	// Conversion map[string]any → typed DTO (avec defaults défensifs)
	resp := dto.DashboardStatsResponse{
		TotalEntreprises:    toInt64(stats["totalEntreprises"]),
		TotalUsers:          toInt64(stats["totalUsers"]),
		ActiveSubscriptions: toInt64(stats["activeSubscriptions"]),
		TrialSubscriptions:  toInt64(stats["trialSubscriptions"]),
		MRR:                 toFloat64(stats["mrr"]),
	}
	WriteJSON(w, http.StatusOK, resp)
}

// ── Admin Entreprises ───────────────────────────────────────────────

// ListEntreprises — GET /api/v1/admin/entreprises
// Query: ?search=xxx&status=active&page=1&pageSize=50
func (h *SaaSHandler) ListEntreprises(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := admin.EntrepriseListInput{
		Search:   r.URL.Query().Get("search"),
		Status:   r.URL.Query().Get("status"),
		Page:     atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListEntreprises(r.Context(), au, in)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ListEntreprises", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.EntrepriseListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// CreateEntreprise — POST /api/v1/admin/entreprises
func (h *SaaSHandler) CreateEntreprise(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateEntrepriseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	e, err := h.uc.CreateEntreprise(r.Context(), au, admin.CreateEntrepriseInput{
		Nom:       req.Nom,
		Adresse:   req.Adresse,
		Telephone: req.Telephone,
		Email:     req.Email,
		Status:    req.Status,
	})
	if err != nil {
		writeSaaSError(w, h.log, "saas.CreateEntreprise", err)
		return
	}
	WriteJSON(w, http.StatusCreated, e)
}

// GetEntreprise — GET /api/v1/admin/entreprises/{id}
// Retourne l'entreprise + compteurs + abonnement.
func (h *SaaSHandler) GetEntreprise(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	detail, err := h.uc.GetEntrepriseDetail(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.GetEntreprise", err)
		return
	}
	if detail == nil {
		WriteError(w, http.StatusNotFound, "entreprise not found")
		return
	}
	WriteJSON(w, http.StatusOK, dto.EntrepriseDetailResponse{
		Entreprise:   detail.Entreprise,
		Stats:        detail.Stats,
		Subscription: detail.Subscription,
	})
}

// UpdateEntreprise — PUT /api/v1/admin/entreprises/{id}
func (h *SaaSHandler) UpdateEntreprise(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	var req dto.UpdateEntrepriseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	e, err := h.uc.UpdateEntreprise(r.Context(), au, id, admin.UpdateEntrepriseInput{
		Nom:       req.Nom,
		Adresse:   req.Adresse,
		Telephone: req.Telephone,
		Email:     req.Email,
	})
	if err != nil {
		writeSaaSError(w, h.log, "saas.UpdateEntreprise", err)
		return
	}
	WriteJSON(w, http.StatusOK, e)
}

// SuspendEntreprise — POST /api/v1/admin/entreprises/{id}/suspend
func (h *SaaSHandler) SuspendEntreprise(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	if err := h.uc.SuspendEntreprise(r.Context(), au, id); err != nil {
		writeSaaSError(w, h.log, "saas.SuspendEntreprise", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.OKResponse{OK: true, ID: id})
}

// ReactivateEntreprise — POST /api/v1/admin/entreprises/{id}/reactivate
func (h *SaaSHandler) ReactivateEntreprise(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	if err := h.uc.ReactivateEntreprise(r.Context(), au, id); err != nil {
		writeSaaSError(w, h.log, "saas.ReactivateEntreprise", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.OKResponse{OK: true, ID: id})
}

// ── Admin Subscriptions ─────────────────────────────────────────────

// ListSubscriptions — GET /api/v1/admin/subscriptions
// Query: ?plan=PRO&statut=ACTIVE&entrepriseId=xxx&page=1&pageSize=50
func (h *SaaSHandler) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := admin.SubscriptionListInput{
		Plan:         r.URL.Query().Get("plan"),
		Statut:       r.URL.Query().Get("statut"),
		EntrepriseID: r.URL.Query().Get("entrepriseId"),
		Page:         atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListSubscriptions(r.Context(), au, in)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ListSubscriptions", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SubscriptionListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// CreateSubscription — POST /api/v1/admin/subscriptions
// Body: {entrepriseId, plan}
func (h *SaaSHandler) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.EntrepriseID == "" || req.Plan == "" {
		WriteError(w, http.StatusBadRequest, "entrepriseId and plan are required")
		return
	}
	sub, err := h.uc.CreateSubscription(r.Context(), au, req.EntrepriseID, req.Plan)
	if err != nil {
		writeSaaSError(w, h.log, "saas.CreateSubscription", err)
		return
	}
	WriteJSON(w, http.StatusCreated, sub)
}

// ChangePlan — PUT /api/v1/admin/subscriptions/{id}
// Body: {plan}
func (h *SaaSHandler) ChangePlan(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	var req dto.ChangePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Plan == "" {
		WriteError(w, http.StatusBadRequest, "plan is required")
		return
	}
	sub, err := h.uc.ChangePlan(r.Context(), au, id, req.Plan)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ChangePlan", err)
		return
	}
	WriteJSON(w, http.StatusOK, sub)
}

// CancelSubscription — POST /api/v1/admin/subscriptions/{id}/cancel
func (h *SaaSHandler) CancelSubscription(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	sub, err := h.uc.CancelSubscription(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.CancelSubscription", err)
		return
	}
	WriteJSON(w, http.StatusOK, sub)
}

// ── Admin Support Access (SUPER_ADMIN) ──────────────────────────────

// ListSupportAccess — GET /api/v1/admin/support-access
// Query: ?statut=DEMANDE&entrepriseId=xxx&superAdminId=xxx&page=1&pageSize=50
func (h *SaaSHandler) ListSupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := admin.SupportAccessListInput{
		Statut:       r.URL.Query().Get("statut"),
		EntrepriseID: r.URL.Query().Get("entrepriseId"),
		SuperAdminID: r.URL.Query().Get("superAdminId"),
		Page:         atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListRequests(r.Context(), au, in)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ListSupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SupportAccessListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// RequestSupportAccess — POST /api/v1/admin/support-access/request
// Body: {entrepriseId, raison}
func (h *SaaSHandler) RequestSupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.SupportAccessRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.EntrepriseID == "" || req.Raison == "" {
		WriteError(w, http.StatusBadRequest, "entrepriseId and raison are required")
		return
	}
	sa, err := h.uc.RequestAccess(r.Context(), au, req.EntrepriseID, req.Raison)
	if err != nil {
		writeSaaSError(w, h.log, "saas.RequestSupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusCreated, sa)
}

// RevokeSupportAccess — POST /api/v1/admin/support-access/{id}/revoke
func (h *SaaSHandler) RevokeSupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	sa, err := h.uc.RevokeAccess(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.RevokeSupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, sa)
}

// ── GERANT Support Access (approval flow) ──────────────────────────

// ListMySupportAccess — GET /api/v1/support-access
// Liste les demandes d'accès pour l'entreprise du user courant.
// (auth requis, tous rôles — le usecase force EntrepriseID = auth.EntrepriseID
// pour les non-SUPER_ADMIN).
func (h *SaaSHandler) ListMySupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := admin.SupportAccessListInput{
		Statut:   r.URL.Query().Get("statut"),
		Page:     atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize: atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListRequests(r.Context(), au, in)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ListMySupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SupportAccessListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// ApproveSupportAccess — POST /api/v1/support-access/{id}/approve
// GERANT approves a support access request for their entreprise.
func (h *SaaSHandler) ApproveSupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	sa, err := h.uc.ApproveAccess(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.ApproveSupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, sa)
}

// RefuseSupportAccess — POST /api/v1/support-access/{id}/refuse
// GERANT refuses a support access request for their entreprise.
func (h *SaaSHandler) RefuseSupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	sa, err := h.uc.RefuseAccess(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.RefuseSupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, sa)
}

// RevokeMySupportAccess — POST /api/v1/support-access/{id}/revoke
// GERANT revokes an active support access on their entreprise.
func (h *SaaSHandler) RevokeMySupportAccess(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	sa, err := h.uc.RevokeAccess(r.Context(), au, id)
	if err != nil {
		writeSaaSError(w, h.log, "saas.RevokeMySupportAccess", err)
		return
	}
	WriteJSON(w, http.StatusOK, sa)
}

// ── helpers ─────────────────────────────────────────────────────────

// writeSaaSError mappe les erreurs domain → HTTP status pour les handlers SaaS.
func writeSaaSError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "resource not found")
	case errors.Is(err, domain.ErrForbidden):
		WriteError(w, http.StatusForbidden, "insufficient permissions")
	case errors.Is(err, domain.ErrConflict):
		WriteError(w, http.StatusConflict, "resource already exists")
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}

// toInt64 — conversion défensive pour map[string]any → int64.
// Gère les cas où la valeur est int, int64, float64, ou nil.
func toInt64(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int:
		return int64(n)
	case float64:
		return int64(n)
	case uint64:
		return int64(n)
	default:
		return 0
	}
}

// toFloat64 — conversion défensive pour map[string]any → float64.
func toFloat64(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int64:
		return float64(n)
	case int:
		return float64(n)
	default:
		return 0
	}
}
