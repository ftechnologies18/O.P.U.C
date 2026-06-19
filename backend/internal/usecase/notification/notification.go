// Package notification — usecase pour les notifications utilisateur (Phase 2).
//
// Les notifications sont USER-SCOPED (filtrées par userId), pas tenant-scoped.
// Elles n'ont pas d'entrepriseId, donc RLS par tenant ne s'applique pas.
// Le repo utilise la connexion Migrations (postgres, bypass RLS) pour éviter
// tout conflit avec les policies tenant_isolation.
package notification

import (
	"context"
	"log/slog"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
)

// Repo — interface définie côté usecase. Implémentée par gorm.NotificationRepository.
//
// Note : pas de *database.AuthUser ici car les notifications sont user-scoped.
// Le userID (extrait du JWT côté handler) suffit pour le filtrage.
type Repo interface {
	ListByUser(ctx context.Context, userID string, limit int) ([]model.Notification, error)
	CountUnreadByUser(ctx context.Context, userID string) (int64, error)
}

// Usecase — cas d'usage pour les notifications.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// List — retourne les notifications d'un user, ordonnées par createdAt DESC.
// limit défaut 20 si <= 0.
func (uc *Usecase) List(ctx context.Context, userID string, limit int) ([]model.Notification, error) {
	if userID == "" {
		return nil, domain.ErrUnauthorized
	}
	if limit <= 0 {
		limit = 20
	}

	notifs, err := uc.repo.ListByUser(ctx, userID, limit)
	if err != nil {
		uc.log.Error("notification.List: repo.ListByUser", "err", err, "user_id", userID)
		return nil, domain.ErrInternal
	}
	return notifs, nil
}
