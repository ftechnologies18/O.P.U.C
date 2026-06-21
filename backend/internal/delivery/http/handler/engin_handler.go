// Package handler — engin_handler.go
// Handlers HTTP pour /api/v1/engins + /api/v1/locations (Phase B-ENGINS).
//
// Routes (cf. router.go) :
//   GET    /api/v1/engins           — list paginée + KPI (auth requis)
//   POST   /api/v1/engins           — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   PUT    /api/v1/engins/{id}      — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   DELETE /api/v1/engins/{id}      — delete (CHEF_PROJET, GERANT, SUPER_ADMIN) — 409 si locations liées
//
//   GET    /api/v1/locations        — list filtrée + KPI (auth requis)
//   POST   /api/v1/locations        — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//   PUT    /api/v1/locations/{id}   — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//                                       — utilisé aussi pour la clôture via {statut:"TERMINE"}
//   DELETE /api/v1/locations/{id}   — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//
// RBAC (router.go) : RequireAccess(model.DomainLogistique, PermLecture) pour les
// GET, RequireAccess(model.DomainLogistique, PermEcriture) pour POST/PUT/DELETE.
//
// Toutes les méthodes extraient *database.AuthUser du context (injecté par
// middleware.Auth) pour le RLS.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/engin"
)

// EnginHandler — handlers HTTP pour /api/v1/engins + /api/v1/locations.
type EnginHandler struct {
	uc  *engin.Usecase
	log *slog.Logger
}

// NewEnginHandler constructeur.
func NewEnginHandler(uc *engin.Usecase, log *slog.Logger) *EnginHandler {
	return &EnginHandler{uc: uc, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Equipement (parc engins)
// ══════════════════════════════════════════════════════════════════

// ListEngins — GET /api/v1/engins
// Query params (tous optionnels) :
//   ?search=xxx          — ILIKE sur designation, marque, modele, immatriculation
//   ?typeLocation=PROPRE — filtre par typeLocation (PROPRE | LOCATION)
//   ?chantierId=xxx      — filtre équipements ayant une location sur ce chantier
//   ?page=1              — 1-based (défaut 1)
//   ?pageSize=50         — défaut 50
func (h *EnginHandler) ListEngins(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	out, err := h.uc.ListEquipements(r.Context(), au, engin.ListEquipementsInput{
		Search:       r.URL.Query().Get("search"),
		TypeLocation: r.URL.Query().Get("typeLocation"),
		ChantierID:   r.URL.Query().Get("chantierId"),
		Page:         atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:     atoiDefault(r.URL.Query().Get("pageSize"), 50),
	})
	if err != nil {
		writeEnginError(w, h.log, "engin.ListEngins", err)
		return
	}

	// Conversion model.Equipement + counts → dto.EnginWithCount
	items := make([]dto.EnginWithCount, 0, len(out.Engins))
	for i := range out.Engins {
		e := &out.Engins[i]
		items = append(items, dto.EnginWithCount{
			Equipement: *e,
			Count:      dto.EnginCountMeta{Locations: out.Counts[e.ID]},
		})
	}

	WriteJSON(w, http.StatusOK, dto.EnginListResponse{
		Engins: items,
		KPI: dto.EnginKPIResponse{
			TotalEngins:   out.KPI.TotalEngins,
			EnginsPropres: out.KPI.EnginsPropres,
			EnginsLoues:   out.KPI.EnginsLoues,
		},
	})
}

// CreateEngin — POST /api/v1/engins
// Body JSON : { designation, typeEquipement?, marque?, modele?, immatriculation?,
//               etat?, typeLocation? }
func (h *EnginHandler) CreateEngin(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	in := parseEnginCreateInput(raw)
	e, err := h.uc.CreateEquipement(r.Context(), au, in)
	if err != nil {
		writeEnginError(w, h.log, "engin.CreateEngin", err)
		return
	}

	WriteJSON(w, http.StatusCreated, dto.EnginWithCount{
		Equipement: *e,
		Count:      dto.EnginCountMeta{Locations: 0},
	})
}

// UpdateEngin — PUT /api/v1/engins/{id}
// Body JSON : partial updates (tous les champs optionnels).
// Le frontend envoie TOUS les champs à chaque update — null = clear.
func (h *EnginHandler) UpdateEngin(w http.ResponseWriter, r *http.Request) {
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

	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	in := parseEnginUpdateInput(raw)
	e, err := h.uc.UpdateEquipement(r.Context(), au, id, in)
	if err != nil {
		writeEnginError(w, h.log, "engin.UpdateEngin", err)
		return
	}

	WriteJSON(w, http.StatusOK, dto.EnginWithCount{
		Equipement: *e,
		Count:      dto.EnginCountMeta{Locations: 0},
	})
}

// DeleteEngin — DELETE /api/v1/engins/{id}
// Renvoie 409 si des locations sont liées (le frontend doit d'abord les supprimer).
func (h *EnginHandler) DeleteEngin(w http.ResponseWriter, r *http.Request) {
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

	if err := h.uc.DeleteEquipement(r.Context(), au, id); err != nil {
		writeEnginError(w, h.log, "engin.DeleteEngin", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"id":      id,
	})
}

// ══════════════════════════════════════════════════════════════════
// Location (LocationEngin)
// ══════════════════════════════════════════════════════════════════

// ListLocations — GET /api/v1/locations
// Query params (tous optionnels) :
//   ?search=xxx       — ILIKE sur fournisseurNom, numeroContrat
//   ?statut=EN_COURS  — filtre par statut (EN_COURS | TERMINE | ANNULE)
//   ?chantierId=xxx   — filtre par chantier
//   ?page=1           — 1-based (défaut 1)
//   ?pageSize=50      — défaut 50
func (h *EnginHandler) ListLocations(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	out, err := h.uc.ListLocations(r.Context(), au, engin.ListLocationsInput{
		Search:     r.URL.Query().Get("search"),
		Statut:     r.URL.Query().Get("statut"),
		ChantierID: r.URL.Query().Get("chantierId"),
		Page:       atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:   atoiDefault(r.URL.Query().Get("pageSize"), 50),
	})
	if err != nil {
		writeEnginError(w, h.log, "engin.ListLocations", err)
		return
	}

	items := make([]dto.LocationItem, 0, len(out.Locations))
	for i := range out.Locations {
		items = append(items, dto.ToLocationItem(&out.Locations[i]))
	}

	WriteJSON(w, http.StatusOK, dto.LocationListResponse{
		Locations: items,
		KPI: dto.LocationKPIResponse{
			LocationsEnCours:    out.KPI.LocationsEnCours,
			CoutTotalEnCours:    out.KPI.CoutTotalEnCours,
			CoutJournalierMoyen: out.KPI.CoutJournalierMoyen,
			LocationsCeMois:     out.KPI.LocationsCeMois,
		},
	})
}

// CreateLocation — POST /api/v1/locations
// Body JSON : { equipementId, fournisseurId?, fournisseurNom?, fournisseurTel?,
//               numeroContrat?, chantierId?, coutJournalier, coutTransport?,
//               coutOperateur?, caution?, dateDebut, dateFin?, statut?, conditions? }
func (h *EnginHandler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	in, err := parseLocationCreateInput(raw)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	l, err := h.uc.CreateLocation(r.Context(), au, in)
	if err != nil {
		writeEnginError(w, h.log, "engin.CreateLocation", err)
		return
	}

	WriteJSON(w, http.StatusCreated, dto.ToLocationItem(l))
}

// UpdateLocation — PUT /api/v1/locations/{id}
// Body JSON : partial updates (tous les champs optionnels).
// Utilisé aussi pour le changement de statut / clôture :
//   PUT /api/v1/locations/{id}  body: { "statut": "TERMINE" }  → clôture
//   PUT /api/v1/locations/{id}  body: { "statut": "ANNULE" }   → annulation
func (h *EnginHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
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

	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	in, err := parseLocationUpdateInput(raw)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	l, err := h.uc.UpdateLocation(r.Context(), au, id, in)
	if err != nil {
		writeEnginError(w, h.log, "engin.UpdateLocation", err)
		return
	}

	WriteJSON(w, http.StatusOK, dto.ToLocationItem(l))
}

// DeleteLocation — DELETE /api/v1/locations/{id}
func (h *EnginHandler) DeleteLocation(w http.ResponseWriter, r *http.Request) {
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

	if err := h.uc.DeleteLocation(r.Context(), au, id); err != nil {
		writeEnginError(w, h.log, "engin.DeleteLocation", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"id":      id,
	})
}

// ══════════════════════════════════════════════════════════════════
// Erreurs + parsing
// ══════════════════════════════════════════════════════════════════

// writeEnginError mappe les erreurs domain → HTTP status pour les handlers engin.
func writeEnginError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "resource not found")
	case errors.Is(err, domain.ErrUnauthorized):
		WriteError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrConflict):
		WriteError(w, http.StatusConflict, err.Error())
	default:
		log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}

// parseEnginCreateInput convertit un map raw en engin.CreateEquipementInput.
// Gère la conversion null → nil pointer.
func parseEnginCreateInput(raw map[string]any) engin.CreateEquipementInput {
	var in engin.CreateEquipementInput
	if v, ok := raw["designation"].(string); ok {
		in.Designation = v
	}
	in.TypeEquipement = stringPtrFromRaw(raw, "typeEquipement")
	in.Marque = stringPtrFromRaw(raw, "marque")
	in.Modele = stringPtrFromRaw(raw, "modele")
	in.Immatriculation = stringPtrFromRaw(raw, "immatriculation")
	if v, ok := raw["etat"].(string); ok {
		in.Etat = v
	}
	in.TypeLocation = stringPtrFromRaw(raw, "typeLocation")
	return in
}

// parseEnginUpdateInput convertit un map raw en engin.UpdateEquipementInput.
// Pour PUT, le frontend envoie TOUS les champs (null = clear).
// On utilise stringPtrFromRaw qui renvoie un *string non-nil si la clé est
// présente (même si valeur = nil → *string = nil pointer pour "clear").
func parseEnginUpdateInput(raw map[string]any) engin.UpdateEquipementInput {
	var in engin.UpdateEquipementInput
	if v, ok := raw["designation"].(string); ok {
		in.Designation = &v
	}
	in.TypeEquipement = stringPtrFromRaw(raw, "typeEquipement")
	in.Marque = stringPtrFromRaw(raw, "marque")
	in.Modele = stringPtrFromRaw(raw, "modele")
	in.Immatriculation = stringPtrFromRaw(raw, "immatriculation")
	in.Etat = stringPtrFromRaw(raw, "etat")
	in.TypeLocation = stringPtrFromRaw(raw, "typeLocation")
	return in
}

// parseLocationCreateInput convertit un map raw en engin.CreateLocationInput.
func parseLocationCreateInput(raw map[string]any) (engin.CreateLocationInput, error) {
	var in engin.CreateLocationInput
	if v, ok := raw["equipementId"].(string); ok {
		in.EquipementID = v
	}
	in.FournisseurID = stringPtrFromRaw(raw, "fournisseurId")
	in.FournisseurNom = stringPtrFromRaw(raw, "fournisseurNom")
	in.FournisseurTel = stringPtrFromRaw(raw, "fournisseurTel")
	in.NumeroContrat = stringPtrFromRaw(raw, "numeroContrat")
	in.ChantierID = stringPtrFromRaw(raw, "chantierId")
	if v, ok := raw["coutJournalier"]; ok {
		in.CoutJournalier = toFloat64(v)
	}
	if v, ok := raw["coutTransport"]; ok {
		in.CoutTransport = toFloat64(v)
	}
	if v, ok := raw["coutOperateur"]; ok {
		in.CoutOperateur = toFloat64(v)
	}
	if v, ok := raw["caution"]; ok {
		in.Caution = toFloat64(v)
	}
	if v, ok := raw["dateDebut"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateDebut = t
	}
	if v, ok := raw["dateFin"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateFin = &t
	}
	if v, ok := raw["statut"].(string); ok {
		in.Statut = v
	}
	in.Conditions = stringPtrFromRaw(raw, "conditions")
	return in, nil
}

// parseLocationUpdateInput convertit un map raw en engin.UpdateLocationInput.
// Utilisé pour les updates partiels ET pour le changement de statut
// (clôture via {statut:"TERMINE"}).
func parseLocationUpdateInput(raw map[string]any) (engin.UpdateLocationInput, error) {
	var in engin.UpdateLocationInput
	in.FournisseurID = stringPtrFromRaw(raw, "fournisseurId")
	in.FournisseurNom = stringPtrFromRaw(raw, "fournisseurNom")
	in.FournisseurTel = stringPtrFromRaw(raw, "fournisseurTel")
	in.NumeroContrat = stringPtrFromRaw(raw, "numeroContrat")
	in.ChantierID = stringPtrFromRaw(raw, "chantierId")
	if v, ok := raw["coutJournalier"]; ok {
		f := toFloat64(v)
		in.CoutJournalier = &f
	}
	if v, ok := raw["coutTransport"]; ok {
		f := toFloat64(v)
		in.CoutTransport = &f
	}
	if v, ok := raw["coutOperateur"]; ok {
		f := toFloat64(v)
		in.CoutOperateur = &f
	}
	if v, ok := raw["caution"]; ok {
		f := toFloat64(v)
		in.Caution = &f
	}
	if v, ok := raw["dateDebut"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateDebut = &t
	}
	if v, ok := raw["dateFin"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateFin = &t
	}
	in.Statut = stringPtrFromRaw(raw, "statut")
	in.Conditions = stringPtrFromRaw(raw, "conditions")
	return in, nil
}

// stringPtrFromRaw extrait un *string d'un map raw JSON.
//   - clé absente       → nil (pas d'update)
//   - clé = null        → *string pointant vers "" (sera converti en NULL par GORM)
//   - clé = "value"     → *string pointant vers "value"
//
// Note : pour distinguer "null" (clear) de "absent" (no update), on vérifie la
// présence de la clé. GORM Updates avec map[string]any{"col": nil} met la colonne
// à NULL.
func stringPtrFromRaw(raw map[string]any, key string) *string {
	v, ok := raw[key]
	if !ok {
		return nil // clé absente → pas d'update
	}
	if v == nil {
		// explicit null → on envoie un pointeur vide pour signifier "clear"
		empty := ""
		return &empty
	}
	if s, ok := v.(string); ok {
		return &s
	}
	return nil
}
