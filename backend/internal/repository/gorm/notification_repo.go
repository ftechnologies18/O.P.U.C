// Package gorm — notification_repo.go
// Repository pour les notifications utilisateur (Phase 2).
//
// Les notifications sont USER-SCOPED (filtrées par userId), pas tenant-scoped.
// Elles n'ont pas d'entrepriseId, donc RLS par tenant ne s'applique pas.
//
// On utilise la connexion Migrations (postgres, bypass RLS) pour éviter tout
// conflit avec les policies tenant_isolation. Le userID (extrait du JWT côté
// handler) garantit l'isolation par utilisateur.
package gorm

import (
        "context"
        "fmt"
        "time"

        "opuc/internal/domain/model"
        "opuc/internal/usecase/notification"

        "gorm.io/gorm"
)

// NotificationRepository — repository user-scoped pour les notifications.
type NotificationRepository struct {
        db *gorm.DB // Migrations (postgres, bypass RLS)
}

// NewNotificationRepository constructeur.
// db = dbm.Migrations (bypass RLS) car les notifications sont user-scoped.
func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
        return &NotificationRepository{db: db}
}

// compile-time check : NotificationRepository implémente notification.Repo.
var _ notification.Repo = (*NotificationRepository)(nil)

// ListByUser — retourne les notifications d'un user, ordonnées par createdAt DESC.
// limit défaut 20 si <= 0 (le usecase applique aussi ce défaut).
func (r *NotificationRepository) ListByUser(ctx context.Context, userID string, limit int) ([]model.Notification, error) {
        if limit <= 0 {
                limit = 20
        }

        var notifs []model.Notification
        err := r.db.WithContext(ctx).
                Where(`"userId" = ?`, userID).
                Order(`"createdAt" DESC`).
                Limit(limit).
                Find(&notifs).Error
        if err != nil {
                return nil, fmt.Errorf("list notifications: %w", err)
        }
        return notifs, nil
}

// CountUnreadByUser — count Notification où userId=? AND lu=false.
func (r *NotificationRepository) CountUnreadByUser(ctx context.Context, userID string) (int64, error) {
        var n int64
        err := r.db.WithContext(ctx).
                Model(&model.Notification{}).
                Where(`"userId" = ? AND lu = false`, userID).
                Count(&n).Error
        if err != nil {
                return 0, fmt.Errorf("count unread notifications: %w", err)
        }
        return n, nil
}

// Create — insère une nouvelle notification. L'ID est généré si vide.
// Utilise la connexion Migrations (bypass RLS) car les notifications sont
// user-scoped (pas d'entrepriseId).
//
// Phase 4 : utilisée pour notifier un user quand une tâche lui est assignée.
func (r *NotificationRepository) Create(ctx context.Context, n model.Notification) (*model.Notification, error) {
        if n.ID == "" {
                n.ID = newCuidLikeID()
        }
        if n.CreatedAt.IsZero() {
                n.CreatedAt = time.Now().UTC()
        }
        if err := r.db.WithContext(ctx).Create(&n).Error; err != nil {
                return nil, fmt.Errorf("create notification: %w", err)
        }
        return &n, nil
}
