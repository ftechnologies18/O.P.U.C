// Package dashboard — usecase pour le tableau de bord (KPIs agrégés, Phase 2).
//
// Calcule les KPIs du dashboard :
//   - chantiersActifs      : count Chantier statut=EN_COURS
//   - journaliersSurSite   : count JournalierAffectation actif=true
//   - pointagesAujourdhui  : count Pointage dateTravail=today
//   - tachesEnRetard       : count Tache statut=EN_RETARD
//   - alertesActives       : unreadNotifications + stockAlerts (somme des alertes)
//   - unreadNotifications  : count Notification userId=current AND lu=false
//   - stockAlerts          : count StockMateriel seuilAlerte > 0
//   - budgetData           : pour chaque chantier : id, nom, budgetPrevisionnel, coutReel=0
//
// Toutes les requêtes sont tenant-scoped via RLS (Row-Level Security), sauf
// unreadNotifications qui est user-scoped (le repo utilise la connexion Migrations
// pour bypass RLS — les notifications n'ont pas d'entrepriseId).
package dashboard

import (
	"context"
	"log/slog"

	"opuc/internal/domain"
	"opuc/internal/infrastructure/database"
)

// BudgetItem — ligne du budget dashboard (un chantier).
// Défini côté usecase (pas dans le repo) pour éviter une dépendance circulaire
// (le repo importe le usecase pour l'interface + ce type, comme le pattern iam).
//
// Note Phase 2 : coutReel est simplifié à 0 (le calcul complet — somme des
// Pointage.tauxJournalier où present=true AND valide=true — est prévu en Phase 3).
type BudgetItem struct {
	ID                 string  `json:"id"`
	Nom                string  `json:"nom"`
	BudgetPrevisionnel float64 `json:"budgetPrevisionnel"`
	CoutReel           float64 `json:"coutReel"`
	Statut             string  `json:"statut"`
}

// Repo — interface définie côté usecase. Implémentée par gorm.DashboardRepository.
//
// Toutes les méthodes (sauf CountUnreadNotifications) utilisent WithTenant pour
// le filtrage RLS. CountUnreadNotifications filtre par userID (pas de tenant).
type Repo interface {
	CountChantiersByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error)
	CountJournaliersActive(ctx context.Context, auth *database.AuthUser) (int64, error)
	CountPointagesToday(ctx context.Context, auth *database.AuthUser) (int64, error)
	CountTachesEnRetard(ctx context.Context, auth *database.AuthUser) (int64, error)
	CountUnreadNotifications(ctx context.Context, auth *database.AuthUser, userID string) (int64, error)
	CountStockAlerts(ctx context.Context, auth *database.AuthUser) (int64, error)
	GetBudgetData(ctx context.Context, auth *database.AuthUser) ([]BudgetItem, error)
}

// DashboardOutput — résultat du Get (tous les KPIs + budgetData).
type DashboardOutput struct {
	ChantiersActifs     int64        `json:"chantiersActifs"`
	JournaliersSurSite  int64        `json:"journaliersSurSite"`
	PointagesAujourdhui int64        `json:"pointagesAujourdhui"`
	TachesEnRetard      int64        `json:"tachesEnRetard"`
	AlertesActives      int64        `json:"alertesActives"`
	UnreadNotifications int64        `json:"unreadNotifications"`
	StockAlerts         int64        `json:"stockAlerts"`
	BudgetData          []BudgetItem `json:"budgetData"`
}

// Usecase — cas d'usage pour le dashboard.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// Get — calcule tous les KPIs + budgetData pour le dashboard.
// userID est l'ID du user courant (extrait du JWT) pour les notifications.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, userID string) (*DashboardOutput, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}

	// 1. Statuts chantiers (KPI chantiersActifs)
	statutCounts, err := uc.repo.CountChantiersByStatut(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: CountChantiersByStatut", "err", err)
		return nil, domain.ErrInternal
	}
	chantiersActifs := statutCounts["EN_COURS"]

	// 2. Journaliers actifs
	journaliersSurSite, err := uc.repo.CountJournaliersActive(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: CountJournaliersActive", "err", err)
		return nil, domain.ErrInternal
	}

	// 3. Pointages du jour
	pointagesAujourdhui, err := uc.repo.CountPointagesToday(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: CountPointagesToday", "err", err)
		return nil, domain.ErrInternal
	}

	// 4. Tâches en retard
	tachesEnRetard, err := uc.repo.CountTachesEnRetard(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: CountTachesEnRetard", "err", err)
		return nil, domain.ErrInternal
	}

	// 5. Notifications non lues (user-scoped)
	unread, err := uc.repo.CountUnreadNotifications(ctx, auth, userID)
	if err != nil {
		uc.log.Error("dashboard.Get: CountUnreadNotifications", "err", err)
		return nil, domain.ErrInternal
	}

	// 6. Alertes stock
	stockAlerts, err := uc.repo.CountStockAlerts(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: CountStockAlerts", "err", err)
		return nil, domain.ErrInternal
	}

	// 7. Budget data
	budgetData, err := uc.repo.GetBudgetData(ctx, auth)
	if err != nil {
		uc.log.Error("dashboard.Get: GetBudgetData", "err", err)
		return nil, domain.ErrInternal
	}

	// alertesActives = unreadNotifications + stockAlerts
	// (somme des alertes actives : notifs non lues + alertes de stock)
	alertesActives := unread + stockAlerts

	return &DashboardOutput{
		ChantiersActifs:     chantiersActifs,
		JournaliersSurSite:  journaliersSurSite,
		PointagesAujourdhui: pointagesAujourdhui,
		TachesEnRetard:      tachesEnRetard,
		AlertesActives:      alertesActives,
		UnreadNotifications: unread,
		StockAlerts:         stockAlerts,
		BudgetData:          budgetData,
	}, nil
}
