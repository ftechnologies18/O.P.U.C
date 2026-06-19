// Package handler — notification_handler.go
// Handler HTTP pour /api/v1/notifications (Phase 2).
//
// Route :
//   GET /api/v1/notifications — liste des notifications du user courant (auth requis)
//
// Les notifications sont user-scoped (filtrées par userId du JWT), pas tenant-scoped.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/notification"
)

// NotificationHandler — handler HTTP pour /api/v1/notifications.
type NotificationHandler struct {
	uc  *notification.Usecase
	log *slog.Logger
}

// NewNotificationHandler constructeur.
func NewNotificationHandler(uc *notification.Usecase, log *slog.Logger) *NotificationHandler {
	return &NotificationHandler{uc: uc, log: log}
}

// List — GET /api/v1/notifications?limit=20
// Retourne les notifications du user courant, ordonnées par createdAt DESC.
// limit défaut 20.
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	limit := atoiDefault(r.URL.Query().Get("limit"), 20)

	notifs, err := h.uc.List(r.Context(), au.UserID, limit)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrUnauthorized):
			WriteError(w, http.StatusUnauthorized, "unauthorized")
		default:
			h.log.Error("notification.List", "err", err)
			WriteError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	// Conversion []model.Notification → []dto.NotificationResponse
	out := make([]dto.NotificationResponse, 0, len(notifs))
	for i := range notifs {
		n := &notifs[i]
		out = append(out, dto.NotificationResponse{
			ID:        n.ID,
			UserID:    n.UserID,
			Titre:     n.Titre,
			Message:   n.Message,
			Type:      n.Type,
			Lu:        n.Lu,
			Lien:      n.Lien,
			CreatedAt: n.CreatedAt,
		})
	}

	WriteJSON(w, http.StatusOK, out)
}
