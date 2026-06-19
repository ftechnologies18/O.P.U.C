// Package dto — dashboard_dto.go
// DTO pour la route /api/v1/dashboard (Phase 2).
//
// Format wire (JSON) aligné sur le frontend Next.js :
//   {
//     "chantiersActifs": 4,
//     "journaliersSurSite": 12,
//     "pointagesAujourdhui": 28,
//     "tachesEnRetard": 2,
//     "alertesActives": 5,        // = unreadNotifications + stockAlerts
//     "unreadNotifications": 3,
//     "stockAlerts": 2,
//     "budgetData": [
//       { "id": "...", "nom": "...", "budgetPrevisionnel": 50000000, "coutReel": 0, "statut": "EN_COURS" }
//     ]
//   }
package dto

// BudgetItemDTO — ligne du budget dashboard (un chantier).
// coutReel = 0 en Phase 2 (calcul complet prévu en Phase 3).
type BudgetItemDTO struct {
	ID                 string  `json:"id"`
	Nom                string  `json:"nom"`
	BudgetPrevisionnel float64 `json:"budgetPrevisionnel"`
	CoutReel           float64 `json:"coutReel"`
	Statut             string  `json:"statut"`
}

// DashboardResponse — réponse GET /api/v1/dashboard.
type DashboardResponse struct {
	ChantiersActifs     int64          `json:"chantiersActifs"`
	JournaliersSurSite  int64          `json:"journaliersSurSite"`
	PointagesAujourdhui int64          `json:"pointagesAujourdhui"`
	TachesEnRetard      int64          `json:"tachesEnRetard"`
	AlertesActives      int64          `json:"alertesActives"`
	UnreadNotifications int64          `json:"unreadNotifications"`
	StockAlerts         int64          `json:"stockAlerts"`
	BudgetData          []BudgetItemDTO `json:"budgetData"`
}
