// Package dto — notification_dto.go
// DTO pour la route /api/v1/notifications (Phase 2).
//
// Format wire (JSON) aligné sur le frontend Next.js :
//   [
//     {
//       "id": "...",
//       "userId": "...",
//       "titre": "...",
//       "message": "...",
//       "type": "info",
//       "lu": false,
//       "lien": "/chantiers/...",
//       "createdAt": "..."
//     }
//   ]
//
// Le handler peut soit retourner []NotificationResponse (conversion depuis
// []model.Notification), soit sérialiser directement []model.Notification
// (les champs JSON sont identiques grâce aux tags du model).
package dto

import "time"

// NotificationResponse — réponse GET /api/v1/notifications (un item).
type NotificationResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Titre     string    `json:"titre"`
	Message   string    `json:"message"`
	Type      string    `json:"type"`
	Lu        bool      `json:"lu"`
	Lien      *string   `json:"lien,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}
