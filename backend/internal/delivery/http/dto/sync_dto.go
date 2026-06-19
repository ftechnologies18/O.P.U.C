// Package dto — sync_dto.go
// DTOs pour la route /api/v1/sync (Phase 5, peripheral endpoints).
//
// Le endpoint /sync sert au mode offline du PWA. Quand le frontend se reconnecte,
// il envoie un batch de mutations en attente. Le backend les rejoue dans l'ordre.
//
// Format de la requête :
//
//	{
//	  "mutations": [
//	    { "id": "client-uuid-1", "entity": "pointage", "action": "create", "data": {...} },
//	    { "id": "client-uuid-2", "entity": "stock", "action": "entree_create", "data": {...} }
//	  ]
//	}
//
// Format de la réponse :
//
//	{
//	  "results": [
//	    { "id": "client-uuid-1", "success": true, "entityId": "c..." },
//	    { "id": "client-uuid-2", "success": false, "error": "stock not found" }
//	  ]
//	}
package dto

// SyncMutation — une mutation offline envoyée par le client PWA.
type SyncMutation struct {
	ID     string         `json:"id"`     // UUID client-side (pour corrélation req/réponse)
	Entity string         `json:"entity"` // pointage, stock, carburant
	Action string         `json:"action"` // create, update, entree_create, sortie_create
	Data   map[string]any `json:"data"`   // payload spécifique à l'entité
}

// SyncRequest — payload POST /api/v1/sync
type SyncRequest struct {
	Mutations []SyncMutation `json:"mutations"`
}

// SyncResult — résultat d'une mutation après replay.
type SyncResult struct {
	ID       string `json:"id"`                 // UUID client-side (corrélation)
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`    // vide si success
	EntityID string `json:"entityId,omitempty"` // ID server-side créé/found
}

// SyncResponse — réponse POST /api/v1/sync
type SyncResponse struct {
	Results []SyncResult `json:"results"`
	Total   int          `json:"total"`
	Ok      int          `json:"ok"`     // nombre de mutations réussies
	Failed  int          `json:"failed"` // nombre de mutations échouées
}
