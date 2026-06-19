// Package handler — stock_handler.go
// Handlers HTTP pour /api/v1/stocks/* (Phase 3, write métier).
//
// Routes (cf. router.go) :
//   GET    /api/v1/stocks              — list paginée avec quantiteDisponible
//   POST   /api/v1/stocks              — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/stocks/entrees      — list entrees (auth requis)
//   POST   /api/v1/stocks/entrees      — create entree (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/stocks/sorties      — list sorties (auth requis)
//   POST   /api/v1/stocks/sorties      — create sortie (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   GET    /api/v1/stocks/{id}         — détail avec entrees + sorties
//   PUT    /api/v1/stocks/{id}         — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/stocks/{id}         — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//
// IMPORTANT : les routes statiques /stocks/entrees et /stocks/sorties doivent
// être enregistrées AVANT /stocks/{id} sinon chi les interprète comme un ID.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/stock"
)

// StockHandler — handlers HTTP pour /api/v1/stocks/*.
type StockHandler struct {
	uc  *stock.Usecase
	log *slog.Logger
}

// NewStockHandler constructeur.
func NewStockHandler(uc *stock.Usecase, log *slog.Logger) *StockHandler {
	return &StockHandler{uc: uc, log: log}
}

// List — GET /api/v1/stocks
func (h *StockHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := stock.ListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		Categorie:  r.URL.Query().Get("categorie"),
		Search:     r.URL.Query().Get("search"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.List(r.Context(), au, in)
	if err != nil {
		writeStockError(w, h.log, "stock.List", err)
		return
	}
	out := make([]dto.StockWithQuantite, 0, len(items))
	for i := range items {
		out = append(out, dto.StockWithQuantite{
			StockMateriel:      items[i].StockMateriel,
			QuantiteDisponible: items[i].QuantiteDisponible,
		})
	}
	WriteJSON(w, http.StatusOK, dto.StockListResponse{
		Data:     out,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Get — GET /api/v1/stocks/{id}
func (h *StockHandler) Get(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	d, err := h.uc.Get(r.Context(), au, id)
	if err != nil {
		writeStockError(w, h.log, "stock.Get", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.StockDetailResponse{
		StockMateriel:      d.StockMateriel,
		QuantiteDisponible: d.QuantiteDisponible,
		Entrees:            d.Entrees,
		Sorties:            d.Sorties,
	})
}

// Create — POST /api/v1/stocks
func (h *StockHandler) Create(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s, err := h.uc.Create(r.Context(), au, stock.CreateStockInput{
		Reference:   req.Reference,
		Designation: req.Designation,
		Categorie:   req.Categorie,
		Unite:       req.Unite,
		SeuilAlerte: req.SeuilAlerte,
		ChantierID:  req.ChantierID,
	})
	if err != nil {
		writeStockError(w, h.log, "stock.Create", err)
		return
	}
	WriteJSON(w, http.StatusCreated, s)
}

// Update — PUT /api/v1/stocks/{id}
func (h *StockHandler) Update(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	var req dto.UpdateStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	s, err := h.uc.Update(r.Context(), au, id, stock.UpdateStockInput{
		Designation: req.Designation,
		Categorie:   req.Categorie,
		Unite:       req.Unite,
		SeuilAlerte: req.SeuilAlerte,
	})
	if err != nil {
		writeStockError(w, h.log, "stock.Update", err)
		return
	}
	WriteJSON(w, http.StatusOK, s)
}

// Delete — DELETE /api/v1/stocks/{id}
func (h *StockHandler) Delete(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		WriteError(w, http.StatusBadRequest, "missing id")
		return
	}
	if err := h.uc.Delete(r.Context(), au, id); err != nil {
		writeStockError(w, h.log, "stock.Delete", err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

// ListEntrees — GET /api/v1/stocks/entrees
func (h *StockHandler) ListEntrees(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := stock.EntreeSortieListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		StockID:    r.URL.Query().Get("stockId"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListEntrees(r.Context(), au, in)
	if err != nil {
		writeStockError(w, h.log, "stock.ListEntrees", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.EntreeStockListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// CreateEntree — POST /api/v1/stocks/entrees
func (h *StockHandler) CreateEntree(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateEntreeStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	dateEntree, err := parseDate(req.DateEntree)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateEntree (use RFC3339 or YYYY-MM-DD)")
		return
	}
	e, err := h.uc.CreateEntree(r.Context(), au, stock.CreateEntreeInput{
		StockID:      req.StockID,
		ChantierID:   req.ChantierID,
		Quantite:     req.Quantite,
		PrixUnitaire: req.PrixUnitaire,
		Fournisseur:  req.Fournisseur,
		NumeroBL:     req.NumeroBL,
		DateEntree:   dateEntree,
	})
	if err != nil {
		writeStockError(w, h.log, "stock.CreateEntree", err)
		return
	}
	WriteJSON(w, http.StatusCreated, e)
}

// ListSorties — GET /api/v1/stocks/sorties
func (h *StockHandler) ListSorties(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	in := stock.EntreeSortieListInput{
		ChantierID: r.URL.Query().Get("chantierId"),
		StockID:    r.URL.Query().Get("stockId"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	}
	items, total, err := h.uc.ListSorties(r.Context(), au, in)
	if err != nil {
		writeStockError(w, h.log, "stock.ListSorties", err)
		return
	}
	WriteJSON(w, http.StatusOK, dto.SortieStockListResponse{
		Data:     items,
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// CreateSortie — POST /api/v1/stocks/sorties
func (h *StockHandler) CreateSortie(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req dto.CreateSortieStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	dateSortie, err := parseDate(req.DateSortie)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid dateSortie (use RFC3339 or YYYY-MM-DD)")
		return
	}
	s, err := h.uc.CreateSortie(r.Context(), au, stock.CreateSortieInput{
		StockID:    req.StockID,
		ChantierID: req.ChantierID,
		Quantite:   req.Quantite,
		TacheID:    req.TacheID,
		Operateur:  req.Operateur,
		Motif:      req.Motif,
		DateSortie: dateSortie,
	})
	if err != nil {
		writeStockError(w, h.log, "stock.CreateSortie", err)
		return
	}
	WriteJSON(w, http.StatusCreated, s)
}

// writeStockError mappe les erreurs domain → HTTP status.
func writeStockError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "stock not found")
	case errors.Is(err, domain.ErrConflict):
		WriteError(w, http.StatusConflict, "stock already exists")
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}
