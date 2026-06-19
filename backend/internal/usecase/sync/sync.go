// Package sync — usecase pour la réconciliation offline (Phase 5, peripheral).
//
// Le endpoint /sync sert au mode offline du PWA. Quand le frontend se reconnecte,
// il envoie un batch de mutations en attente. Le backend les rejoue dans l'ordre.
//
// Cette implémentation est best-effort : si une mutation échoue, on continue
// avec les autres. Chaque mutation retourne un résultat individuel.
//
// Entités supportées :
//   - pointage + create   → pointage.Usecase.Create
//   - pointage + update   → pointage.Usecase.Update
//   - stock + entree_create → stock.Usecase.CreateEntree
//   - stock + sortie_create → stock.Usecase.CreateSortie
//   - carburant + entree_create → carburant.Usecase.CreateEntree
//   - carburant + sortie_create → carburant.Usecase.CreateSortie
//
// Pour toute autre combinaison entity/action, on retourne { success: false,
// error: "unsupported entity/action" }.
package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/carburant"
	"opuc/internal/usecase/pointage"
	"opuc/internal/usecase/stock"
)

// Usecase — cas d'usage pour la sync offline.
type Usecase struct {
	pointage *pointage.Usecase
	stock    *stock.Usecase
	carburant *carburant.Usecase
	log      *slog.Logger
}

// NewUsecase constructeur. Injecte les usecases métiers nécessaires au dispatch.
func NewUsecase(p *pointage.Usecase, s *stock.Usecase, c *carburant.Usecase, log *slog.Logger) *Usecase {
	return &Usecase{
		pointage:  p,
		stock:     s,
		carburant: c,
		log:       log,
	}
}

// Mutation — une mutation offline à rejouer (DTO interne, miroir de dto.SyncMutation).
type Mutation struct {
	ID     string
	Entity string
	Action string
	Data   map[string]any
}

// Result — résultat d'une mutation après replay.
type Result struct {
	ID       string
	Success  bool
	Error    string
	EntityID string
}

// Sync — rejoue un batch de mutations. Best-effort : si une mutation échoue,
// continue avec les autres. Retourne un résultat par mutation.
func (uc *Usecase) Sync(ctx context.Context, auth *database.AuthUser, mutations []Mutation) []Result {
	results := make([]Result, 0, len(mutations))
	for _, m := range mutations {
		r := uc.applyMutation(ctx, auth, m)
		results = append(results, r)
	}
	return results
}

// applyMutation — dispatch une mutation vers le bon usecase.
func (uc *Usecase) applyMutation(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	if auth == nil {
		return Result{ID: m.ID, Error: "unauthorized"}
	}
	switch m.Entity + "/" + m.Action {
	case "pointage/create":
		return uc.applyPointageCreate(ctx, auth, m)
	case "pointage/update":
		return uc.applyPointageUpdate(ctx, auth, m)
	case "stock/entree_create":
		return uc.applyStockEntreeCreate(ctx, auth, m)
	case "stock/sortie_create":
		return uc.applyStockSortieCreate(ctx, auth, m)
	case "carburant/entree_create":
		return uc.applyCarburantEntreeCreate(ctx, auth, m)
	case "carburant/sortie_create":
		return uc.applyCarburantSortieCreate(ctx, auth, m)
	default:
		return Result{ID: m.ID, Error: "unsupported entity/action"}
	}
}

// applyPointageCreate — pointage + create.
// data: { journalierId, chantierId, dateTravail, tauxJournalier, present, observation? }
func (uc *Usecase) applyPointageCreate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	in := pointage.CreateInput{
		JournalierID:   getString(m.Data, "journalierId"),
		ChantierID:     getString(m.Data, "chantierId"),
		TauxJournalier: getFloat64(m.Data, "tauxJournalier"),
		Present:        getBool(m.Data, "present"),
		Observation:    getPtrString(m.Data, "observation"),
	}
	if t, err := getTime(m.Data, "dateTravail"); err == nil {
		in.DateTravail = t
	} else {
		return Result{ID: m.ID, Error: "invalid dateTravail: " + err.Error()}
	}
	p, err := uc.pointage.Create(ctx, auth, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: p.ID}
}

// applyPointageUpdate — pointage + update.
// data: { tauxJournalier?, present?, observation? }
// Requiert un id externe (m.Data["id"]) qui est l'ID serveur du pointage à updater.
func (uc *Usecase) applyPointageUpdate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	id := getString(m.Data, "id")
	if id == "" {
		return Result{ID: m.ID, Error: "id is required for pointage update"}
	}
	in := pointage.UpdateInput{
		TauxJournalier: getPtrFloat64(m.Data, "tauxJournalier"),
		Observation:    getPtrString(m.Data, "observation"),
	}
	if v, ok := m.Data["present"]; ok {
		b, _ := v.(bool)
		in.Present = &b
	}
	p, err := uc.pointage.Update(ctx, auth, id, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: p.ID}
}

// applyStockEntreeCreate — stock + entree_create.
// data: { stockId, chantierId, quantite, prixUnitaire, fournisseur?, numeroBL?, dateEntree }
func (uc *Usecase) applyStockEntreeCreate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	in := stock.CreateEntreeInput{
		StockID:      getString(m.Data, "stockId"),
		ChantierID:   getString(m.Data, "chantierId"),
		Quantite:     getFloat64(m.Data, "quantite"),
		PrixUnitaire: getFloat64(m.Data, "prixUnitaire"),
		Fournisseur:  getPtrString(m.Data, "fournisseur"),
		NumeroBL:     getPtrString(m.Data, "numeroBL"),
	}
	if t, err := getTime(m.Data, "dateEntree"); err == nil {
		in.DateEntree = t
	} else {
		return Result{ID: m.ID, Error: "invalid dateEntree: " + err.Error()}
	}
	e, err := uc.stock.CreateEntree(ctx, auth, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: e.ID}
}

// applyStockSortieCreate — stock + sortie_create.
// data: { stockId, chantierId, quantite, tacheId?, operateur?, motif?, dateSortie }
func (uc *Usecase) applyStockSortieCreate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	in := stock.CreateSortieInput{
		StockID:    getString(m.Data, "stockId"),
		ChantierID: getString(m.Data, "chantierId"),
		Quantite:   getFloat64(m.Data, "quantite"),
		TacheID:    getPtrString(m.Data, "tacheId"),
		Operateur:  getPtrString(m.Data, "operateur"),
		Motif:      getPtrString(m.Data, "motif"),
	}
	if t, err := getTime(m.Data, "dateSortie"); err == nil {
		in.DateSortie = t
	} else {
		return Result{ID: m.ID, Error: "invalid dateSortie: " + err.Error()}
	}
	s, err := uc.stock.CreateSortie(ctx, auth, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: s.ID}
}

// applyCarburantEntreeCreate — carburant + entree_create.
// data: { stockCarburantId, chantierId, dateEntree, quantite, prixUnitaire, fournisseur?, numeroBL? }
func (uc *Usecase) applyCarburantEntreeCreate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	in := carburant.CreateEntreeInput{
		StockCarburantID: getString(m.Data, "stockCarburantId"),
		ChantierID:       getString(m.Data, "chantierId"),
		Quantite:         getFloat64(m.Data, "quantite"),
		PrixUnitaire:     getFloat64(m.Data, "prixUnitaire"),
		Fournisseur:      getPtrString(m.Data, "fournisseur"),
		NumeroBL:         getPtrString(m.Data, "numeroBL"),
	}
	if t, err := getTime(m.Data, "dateEntree"); err == nil {
		in.DateEntree = t
	} else {
		return Result{ID: m.ID, Error: "invalid dateEntree: " + err.Error()}
	}
	e, err := uc.carburant.CreateEntree(ctx, auth, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: e.ID}
}

// applyCarburantSortieCreate — carburant + sortie_create.
// data: { stockCarburantId, chantierId, dateSortie, quantite, equipementId?, operateur?,
//         compteurHeuresAvant?, compteurHeuresApres? }
func (uc *Usecase) applyCarburantSortieCreate(ctx context.Context, auth *database.AuthUser, m Mutation) Result {
	in := carburant.CreateSortieInput{
		StockCarburantID:    getString(m.Data, "stockCarburantId"),
		ChantierID:          getString(m.Data, "chantierId"),
		Quantite:            getFloat64(m.Data, "quantite"),
		EquipementID:        getPtrString(m.Data, "equipementId"),
		Operateur:           getPtrString(m.Data, "operateur"),
		CompteurHeuresAvant: getPtrFloat64(m.Data, "compteurHeuresAvant"),
		CompteurHeuresApres: getPtrFloat64(m.Data, "compteurHeuresApres"),
	}
	if t, err := getTime(m.Data, "dateSortie"); err == nil {
		in.DateSortie = t
	} else {
		return Result{ID: m.ID, Error: "invalid dateSortie: " + err.Error()}
	}
	s, err := uc.carburant.CreateSortie(ctx, auth, in)
	if err != nil {
		return Result{ID: m.ID, Error: errString(err)}
	}
	return Result{ID: m.ID, Success: true, EntityID: s.ID}
}

// ── helpers (extract typed values from map[string]any) ─────────

func getString(m map[string]any, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	switch s := v.(type) {
	case string:
		return s
	default:
		// Tente une conversion JSON → string (ex: nombres, booléens).
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func getPtrString(m map[string]any, key string) *string {
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	s := getString(m, key)
	if s == "" {
		return nil
	}
	return &s
}

func getFloat64(m map[string]any, key string) float64 {
	v, ok := m[key]
	if !ok {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case json.Number:
		f, _ := n.Float64()
		return f
	default:
		return 0
	}
}

func getPtrFloat64(m map[string]any, key string) *float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	f := getFloat64(m, key)
	return &f
}

func getBool(m map[string]any, key string) bool {
	v, ok := m[key]
	if !ok {
		return false
	}
	switch b := v.(type) {
	case bool:
		return b
	default:
		return false
	}
}

func getTime(m map[string]any, key string) (time.Time, error) {
	s := getString(m, key)
	if s == "" {
		return time.Time{}, fmt.Errorf("missing %s", key)
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid format for %s (use RFC3339 or YYYY-MM-DD)", key)
}

// errString retourne un message d'erreur user-friendly pour les erreurs domain.
func errString(err error) string {
	if err == nil {
		return ""
	}
	switch {
	case err == domain.ErrNotFound:
		return "resource not found"
	case err == domain.ErrConflict:
		return "conflict: resource already exists"
	case err == domain.ErrUnauthorized:
		return "unauthorized"
	case err == domain.ErrBadRequest:
		return "bad request: " + err.Error()
	default:
		return err.Error()
	}
}
