// Package stock — usecase pour le stock de matériel (Phase 3, write métier).
//
// Opérations :
//   - List    : liste paginée avec quantiteDisponible calculée par stock
//   - Get     : détail avec entrees + sorties + quantiteDisponible
//   - Create  : crée un StockMateriel
//   - Update  : met à jour un StockMateriel
//   - Delete  : supprime un StockMateriel
//   - ListEntrees / CreateEntree : gestion des entrées de stock
//   - ListSorties / CreateSortie : gestion des sorties de stock
//
// Toutes les requêtes sont tenant-scoped via RLS. Les tables StockMateriel,
// EntreeStock, SortieStock n'ont pas de RLS direct : filtrage via JOIN sur
// "Chantier" (RLS-protected).
package stock

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.StockRepository.
type Repo interface {
	// StockMateriel
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.StockMateriel, int64, error)
	GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.StockMateriel, error)
	Create(ctx context.Context, auth *database.AuthUser, s model.StockMateriel) (*model.StockMateriel, error)
	Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.StockMateriel, error)
	Delete(ctx context.Context, auth *database.AuthUser, id string) error
	// Quantities (batch for efficiency)
	QuantitesDisponibles(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error)
	QuantiteDisponible(ctx context.Context, auth *database.AuthUser, stockID string) (float64, error)
	// Entrees + Sorties for detail view
	ListEntreesByStock(ctx context.Context, auth *database.AuthUser, stockID string) ([]model.EntreeStock, error)
	ListSortiesByStock(ctx context.Context, auth *database.AuthUser, stockID string) ([]model.SortieStock, error)

	// EntreeStock
	ListEntrees(ctx context.Context, auth *database.AuthUser, filter EntreeSortieListInput) ([]model.EntreeStock, int64, error)
	CreateEntree(ctx context.Context, auth *database.AuthUser, e model.EntreeStock) (*model.EntreeStock, error)

	// SortieStock
	ListSorties(ctx context.Context, auth *database.AuthUser, filter EntreeSortieListInput) ([]model.SortieStock, int64, error)
	CreateSortie(ctx context.Context, auth *database.AuthUser, s model.SortieStock) (*model.SortieStock, error)
}

// ListInput — critères de filtrage pour List (StockMateriel).
type ListInput struct {
	ChantierID string
	Categorie  string
	Search     string
	Page       int
	PageSize   int
}

// EntreeSortieListInput — critères de filtrage pour ListEntrees/ListSorties.
type EntreeSortieListInput struct {
	ChantierID string
	StockID    string
	Page       int
	PageSize   int
}

// CreateStockInput — payload pour Create (StockMateriel).
type CreateStockInput struct {
	Reference   *string
	Designation string
	Categorie   *string
	Unite       *string
	SeuilAlerte float64
	ChantierID  *string
}

// UpdateStockInput — payload pour Update (StockMateriel).
type UpdateStockInput struct {
	Designation *string
	Categorie   *string
	Unite       *string
	SeuilAlerte *float64
}

// CreateEntreeInput — payload pour CreateEntree.
type CreateEntreeInput struct {
	StockID      string
	ChantierID   string
	Quantite     float64
	PrixUnitaire float64
	Fournisseur  *string
	NumeroBL     *string
	DateEntree   time.Time
}

// CreateSortieInput — payload pour CreateSortie.
type CreateSortieInput struct {
	StockID    string
	ChantierID string
	Quantite   float64
	TacheID    *string
	Operateur  *string
	Motif      *string
	DateSortie time.Time
}

// StockWithQuantite — stock + quantiteDisponible calculée.
type StockWithQuantite struct {
	model.StockMateriel
	QuantiteDisponible float64 `json:"quantiteDisponible"`
}

// StockDetail — détail d'un stock avec entrees + sorties + quantiteDisponible.
type StockDetail struct {
	model.StockMateriel
	QuantiteDisponible float64             `json:"quantiteDisponible"`
	Entrees            []model.EntreeStock `json:"entrees"`
	Sorties            []model.SortieStock `json:"sorties"`
}

// Usecase — cas d'usage pour le stock de matériel.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// List — liste paginée des stocks avec quantiteDisponible.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]StockWithQuantite, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	stocks, total, err := uc.repo.List(ctx, auth, in)
	if err != nil {
		uc.log.Error("stock.List", "err", err)
		return nil, 0, domain.ErrInternal
	}

	// Batch: compute quantiteDisponible for all stocks in one query
	ids := make([]string, 0, len(stocks))
	for i := range stocks {
		ids = append(ids, stocks[i].ID)
	}
	quantites := make(map[string]float64, len(ids))
	if len(ids) > 0 {
		quantites, err = uc.repo.QuantitesDisponibles(ctx, auth, ids)
		if err != nil {
			uc.log.Error("stock.List: QuantitesDisponibles", "err", err)
			return nil, 0, domain.ErrInternal
		}
	}

	out := make([]StockWithQuantite, 0, len(stocks))
	for i := range stocks {
		out = append(out, StockWithQuantite{
			StockMateriel:      stocks[i],
			QuantiteDisponible: quantites[stocks[i].ID],
		})
	}
	return out, total, nil
}

// Get — détail d'un stock avec entrees + sorties + quantiteDisponible.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*StockDetail, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	s, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("stock.Get: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if s == nil {
		return nil, domain.ErrNotFound
	}

	quantite, err := uc.repo.QuantiteDisponible(ctx, auth, id)
	if err != nil {
		uc.log.Error("stock.Get: QuantiteDisponible", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	entrees, err := uc.repo.ListEntreesByStock(ctx, auth, id)
	if err != nil {
		uc.log.Error("stock.Get: ListEntreesByStock", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	sorties, err := uc.repo.ListSortiesByStock(ctx, auth, id)
	if err != nil {
		uc.log.Error("stock.Get: ListSortiesByStock", "err", err, "id", id)
		return nil, domain.ErrInternal
	}

	return &StockDetail{
		StockMateriel:      *s,
		QuantiteDisponible: quantite,
		Entrees:            entrees,
		Sorties:            sorties,
	}, nil
}

// Create — crée un StockMateriel.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateStockInput) (*model.StockMateriel, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.Designation == "" {
		return nil, fmt.Errorf("%w: designation is required", domain.ErrBadRequest)
	}
	s := model.StockMateriel{
		Reference:   in.Reference,
		Designation: in.Designation,
		Categorie:   in.Categorie,
		Unite:       in.Unite,
		SeuilAlerte: in.SeuilAlerte,
		ChantierID:  in.ChantierID,
	}
	created, err := uc.repo.Create(ctx, auth, s)
	if err != nil {
		uc.log.Error("stock.Create: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Update — met à jour un StockMateriel.
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateStockInput) (*model.StockMateriel, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	updates := map[string]any{}
	if in.Designation != nil {
		updates["designation"] = *in.Designation
	}
	if in.Categorie != nil {
		updates["categorie"] = *in.Categorie
	}
	if in.Unite != nil {
		updates["unite"] = *in.Unite
	}
	if in.SeuilAlerte != nil {
		updates["seuilAlerte"] = *in.SeuilAlerte
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("stock.Update: GetByID", "err", err, "id", id)
			return nil, domain.ErrInternal
		}
		if existing == nil {
			return nil, domain.ErrNotFound
		}
		return existing, nil
	}
	updates["updatedAt"] = time.Now().UTC()
	updated, err := uc.repo.Update(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("stock.Update: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// Delete — supprime un StockMateriel.
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return domain.ErrBadRequest
	}
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("stock.Delete: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}
	if err := uc.repo.Delete(ctx, auth, id); err != nil {
		uc.log.Error("stock.Delete: repo", "err", err, "id", id)
		return domain.ErrInternal
	}
	return nil
}

// ListEntrees — liste paginée des entrées de stock.
func (uc *Usecase) ListEntrees(ctx context.Context, auth *database.AuthUser, in EntreeSortieListInput) ([]model.EntreeStock, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListEntrees(ctx, auth, in)
	if err != nil {
		uc.log.Error("stock.ListEntrees", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// CreateEntree — crée une entrée de stock.
func (uc *Usecase) CreateEntree(ctx context.Context, auth *database.AuthUser, in CreateEntreeInput) (*model.EntreeStock, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.StockID == "" || in.ChantierID == "" {
		return nil, fmt.Errorf("%w: stockId and chantierId are required", domain.ErrBadRequest)
	}
	if in.DateEntree.IsZero() {
		return nil, fmt.Errorf("%w: dateEntree is required", domain.ErrBadRequest)
	}
	e := model.EntreeStock{
		StockID:      in.StockID,
		ChantierID:   in.ChantierID,
		Quantite:     in.Quantite,
		PrixUnitaire: in.PrixUnitaire,
		Fournisseur:  in.Fournisseur,
		NumeroBL:     in.NumeroBL,
		DateEntree:   in.DateEntree,
	}
	created, err := uc.repo.CreateEntree(ctx, auth, e)
	if err != nil {
		uc.log.Error("stock.CreateEntree: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// ListSorties — liste paginée des sorties de stock.
func (uc *Usecase) ListSorties(ctx context.Context, auth *database.AuthUser, in EntreeSortieListInput) ([]model.SortieStock, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListSorties(ctx, auth, in)
	if err != nil {
		uc.log.Error("stock.ListSorties", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// CreateSortie — crée une sortie de stock.
func (uc *Usecase) CreateSortie(ctx context.Context, auth *database.AuthUser, in CreateSortieInput) (*model.SortieStock, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.StockID == "" || in.ChantierID == "" {
		return nil, fmt.Errorf("%w: stockId and chantierId are required", domain.ErrBadRequest)
	}
	if in.DateSortie.IsZero() {
		return nil, fmt.Errorf("%w: dateSortie is required", domain.ErrBadRequest)
	}
	s := model.SortieStock{
		StockID:    in.StockID,
		ChantierID: in.ChantierID,
		Quantite:   in.Quantite,
		TacheID:    in.TacheID,
		Operateur:  in.Operateur,
		Motif:      in.Motif,
		DateSortie: in.DateSortie,
	}
	created, err := uc.repo.CreateSortie(ctx, auth, s)
	if err != nil {
		uc.log.Error("stock.CreateSortie: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}
