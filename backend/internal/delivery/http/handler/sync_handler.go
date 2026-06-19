// Package handler — sync_handler.go
// Handler HTTP pour /api/v1/sync (Phase 5, peripheral endpoints).
//
// Route (cf. router.go) :
//   POST /api/v1/sync — sync offline mutations (auth requis)
//
// Le endpoint /sync sert au mode offline du PWA. Le client envoie un batch de
// mutations en attente, le backend les rejoue une à une (best-effort) et
// retourne un résultat par mutation.
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/usecase/sync"
)

// SyncHandler — handler HTTP pour /api/v1/sync.
type SyncHandler struct {
	uc  *sync.Usecase
	log *slog.Logger
}

// NewSyncHandler constructeur.
func NewSyncHandler(uc *sync.Usecase, log *slog.Logger) *SyncHandler {
	return &SyncHandler{uc: uc, log: log}
}

// Sync — POST /api/v1/sync
//
// Body:
//
//	{
//	  "mutations": [
//	    { "id": "uuid1", "entity": "pointage", "action": "create", "data": {...} },
//	    { "id": "uuid2", "entity": "stock", "action": "entree_create", "data": {...} }
//	  ]
//	}
//
// Response:
//
//	{
//	  "results": [
//	    { "id": "uuid1", "success": true, "entityId": "c..." },
//	    { "id": "uuid2", "success": false, "error": "stock not found" }
//	  ],
//	  "total": 2, "ok": 1, "failed": 1
//	}
func (h *SyncHandler) Sync(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	// Convertit dto.SyncMutation → sync.Mutation (pour découpler DTO de l'usecase).
	mutations := make([]sync.Mutation, 0, len(req.Mutations))
	for _, m := range req.Mutations {
		mutations = append(mutations, sync.Mutation{
			ID:     m.ID,
			Entity: m.Entity,
			Action: m.Action,
			Data:   m.Data,
		})
	}
	results := h.uc.Sync(r.Context(), au, mutations)

	// Convertit sync.Result → dto.SyncResult.
	out := make([]dto.SyncResult, 0, len(results))
	ok, failed := 0, 0
	for _, r := range results {
		if r.Success {
			ok++
		} else {
			failed++
		}
		out = append(out, dto.SyncResult{
			ID:       r.ID,
			Success:  r.Success,
			Error:    r.Error,
			EntityID: r.EntityID,
		})
	}
	// HTTP 207 Multi-Status serait plus sémantique, mais on garde 200 pour
	// simplifier le client (le détail est dans results[].success).
	WriteJSON(w, http.StatusOK, dto.SyncResponse{
		Results: out,
		Total:   len(out),
		Ok:      ok,
		Failed:  failed,
	})
}
