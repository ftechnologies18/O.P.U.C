// Package handler — personnel_handler.go
// Handlers HTTP pour /api/v1/personnel/* (module PHASE-B-PERSONNEL).
//
// Routes (cf. router.go) :
//
//	GET    /api/v1/personnel                                — list paginée + KPI
//	POST   /api/v1/personnel                                — create journalier
//	PUT    /api/v1/personnel/{id}                           — update journalier (partial)
//	DELETE /api/v1/personnel/{id}                           — delete journalier
//	GET    /api/v1/personnel/{id}/affectations              — list affectations
//	POST   /api/v1/personnel/{id}/affectations              — create affectation
//	DELETE /api/v1/personnel/{id}/affectations/{affectationId} — delete affectation (by id)
//	DELETE /api/v1/personnel/{id}/affectations?chantierId=X    — delete affectation (by chantier)
//
// RBAC : RequireAccess(DomainRH, PermLecture) pour les GET, PermEcriture
// pour POST/PUT/DELETE (déclaré dans router.go).
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

	"opuc/internal/domain"
	"opuc/internal/usecase/personnel"
)

// PersonnelHandler — handlers HTTP pour /api/v1/personnel.
type PersonnelHandler struct {
	uc  *personnel.Usecase
	log *slog.Logger
}

// NewPersonnelHandler constructeur.
func NewPersonnelHandler(uc *personnel.Usecase, log *slog.Logger) *PersonnelHandler {
	return &PersonnelHandler{uc: uc, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Journalier CRUD
// ══════════════════════════════════════════════════════════════════

// List — GET /api/v1/personnel
//
// Query params (tous optionnels) :
//
//	?search=xxx              — ILIKE sur nom, prenom, telephone
//	?statut=ACTIF            — alias pour statutContrat (compat task brief)
//	?statutContrat=ACTIF     — filtre sur statutContrat
//	?typeContrat=JOURNALIER  — filtre sur typeContrat
//	?specialite=Maçon        — filtre sur specialite (single)
//	?specialites=Maçon&specialites=Ferrailleur — filtre sur specialite (multiple)
//	?chantierId=xxx          — journaliers ayant une affectation active sur ce chantier
//	?page=1                  — 1-based (défaut 1)
//	?pageSize=50             — défaut 50
//
// Réponse : { journaliers: [...with affectations.chantier preloaded], kpi: {...}, total, page, pageSize }
func (h *PersonnelHandler) List(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// statutContrat : supporte à la fois "statut" (alias) et "statutContrat"
	statutContrat := r.URL.Query().Get("statutContrat")
	if statutContrat == "" {
		statutContrat = r.URL.Query().Get("statut")
	}

	out, err := h.uc.List(r.Context(), au, personnel.ListInput{
		Search:        r.URL.Query().Get("search"),
		StatutContrat: statutContrat,
		TypeContrat:   r.URL.Query().Get("typeContrat"),
		Specialite:    r.URL.Query().Get("specialite"),
		Specialites:   r.URL.Query()["specialites"],
		ChantierID:    r.URL.Query().Get("chantierId"),
		Page:          atoiDefault(r.URL.Query().Get("page"), 1),
		PageSize:      atoiDefault(r.URL.Query().Get("pageSize"), 50),
	})
	if err != nil {
		writePersonnelError(w, h.log, "personnel.List", err)
		return
	}

	WriteJSON(w, http.StatusOK, out)
}

// Create — POST /api/v1/personnel
//
// Body JSON : { nom, prenom, telephone?, specialite?, photo?, typeContrat?,
//
//	tauxJournalier?, salaireMensuel?, dateDebutContrat?,
//	dateFinContrat?, statutContrat?, numeroCNPS?, nbCongesRestants?,
//	poste?, departement? }
//
// Les dates sont envoyées comme strings ("2025-01-30" ou RFC3339) par le
// frontend Next.js.
func (h *PersonnelHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	in, err := parsePersonnelCreateInput(raw)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	created, err := h.uc.Create(r.Context(), au, in)
	if err != nil {
		writePersonnelError(w, h.log, "personnel.Create", err)
		return
	}

	WriteJSON(w, http.StatusCreated, created)
}

// Update — PUT /api/v1/personnel/{id}
//
// Body JSON : partial updates (tous les champs optionnels, mêmes que Create).
func (h *PersonnelHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	in, err := parsePersonnelUpdateInput(raw)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	updated, err := h.uc.Update(r.Context(), au, id, in)
	if err != nil {
		writePersonnelError(w, h.log, "personnel.Update", err)
		return
	}

	WriteJSON(w, http.StatusOK, updated)
}

// Delete — DELETE /api/v1/personnel/{id}
func (h *PersonnelHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
		writePersonnelError(w, h.log, "personnel.Delete", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"id":      id,
	})
}

// ══════════════════════════════════════════════════════════════════
// Affectations
// ══════════════════════════════════════════════════════════════════

// ListAffectations — GET /api/v1/personnel/{id}/affectations
// Retourne les affectations d'un journalier avec Chantier préloadé.
func (h *PersonnelHandler) ListAffectations(w http.ResponseWriter, r *http.Request) {
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

	items, err := h.uc.ListAffectations(r.Context(), au, id)
	if err != nil {
		writePersonnelError(w, h.log, "personnel.ListAffectations", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"data":  items,
		"total": len(items),
	})
}

// CreateAffectation — POST /api/v1/personnel/{id}/affectations
//
// Body JSON : { chantierId, dateDebut?, dateFin? }
// (dateDebut est optionnel — si non fournie, la DB stocke NULL)
func (h *PersonnelHandler) CreateAffectation(w http.ResponseWriter, r *http.Request) {
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

	in := personnel.CreateAffectationInput{
		JournalierID: id,
	}

	if v, ok := raw["chantierId"].(string); ok {
		in.ChantierID = v
	}
	if v, ok := raw["dateDebut"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateDebut (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateDebut = &t
	}
	if v, ok := raw["dateFin"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "invalid dateFin (use RFC3339 or YYYY-MM-DD)")
			return
		}
		in.DateFin = &t
	}

	created, err := h.uc.CreateAffectation(r.Context(), au, in)
	if err != nil {
		writePersonnelError(w, h.log, "personnel.CreateAffectation", err)
		return
	}

	WriteJSON(w, http.StatusCreated, created)
}

// DeleteAffectation — DELETE /api/v1/personnel/{id}/affectations/{affectationId}
// OU DELETE /api/v1/personnel/{id}/affectations?chantierId={chantierId}
//
// Le frontend utilise la 2e forme (passage du chantierId en query param),
// mais on supporte aussi la 1re (passage de l'affectationId en path) pour
// l'API publique documentée dans le task brief.
//
// Si affectationId est présent dans le path → delete by id.
// Sinon, si chantierId est présent en query → delete by (journalierId, chantierId).
func (h *PersonnelHandler) DeleteAffectation(w http.ResponseWriter, r *http.Request) {
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

	affectationID := chi.URLParam(r, "affectationId")
	chantierID := r.URL.Query().Get("chantierId")

	if affectationID == "" && chantierID == "" {
		WriteError(w, http.StatusBadRequest, "missing affectationId (path) or chantierId (query)")
		return
	}

	var err error
	if affectationID != "" {
		err = h.uc.DeleteAffectation(r.Context(), au, affectationID)
	} else {
		err = h.uc.DeleteAffectationByChantier(r.Context(), au, id, chantierID)
	}
	if err != nil {
		writePersonnelError(w, h.log, "personnel.DeleteAffectation", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"id":      affectationID,
	})
}

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

// writePersonnelError mappe les erreurs domain → HTTP status.
func writePersonnelError(w http.ResponseWriter, log *slog.Logger, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "personnel not found")
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

// parsePersonnelCreateInput convertit un map raw (JSON décodé sans typage)
// en personnel.CreateInput. Gère la conversion des dates string → *time.Time.
func parsePersonnelCreateInput(raw map[string]any) (personnel.CreateInput, error) {
	var in personnel.CreateInput

	if v, ok := raw["nom"].(string); ok {
		in.Nom = v
	}
	if v, ok := raw["prenom"].(string); ok {
		in.Prenom = v
	}
	if v, ok := raw["telephone"].(string); ok && v != "" {
		in.Telephone = &v
	}
	if v, ok := raw["specialite"].(string); ok && v != "" {
		in.Specialite = &v
	}
	if v, ok := raw["photo"].(string); ok && v != "" {
		in.Photo = &v
	}
	if v, ok := raw["typeContrat"].(string); ok {
		in.TypeContrat = v
	}
	if v, ok := raw["statutContrat"].(string); ok {
		in.StatutContrat = v
	}
	if v, ok := raw["numeroCNPS"].(string); ok && v != "" {
		in.NumeroCNPS = &v
	}
	if v, ok := raw["poste"].(string); ok && v != "" {
		in.Poste = &v
	}
	if v, ok := raw["departement"].(string); ok && v != "" {
		in.Departement = &v
	}

	if v, ok := raw["tauxJournalier"]; ok {
		f := toFloat64(v)
		in.TauxJournalier = &f
	}
	if v, ok := raw["salaireMensuel"]; ok {
		f := toFloat64(v)
		in.SalaireMensuel = &f
	}
	if v, ok := raw["nbCongesRestants"]; ok {
		n := int(toInt64(v))
		in.NbCongesRestants = &n
	}

	if v, ok := raw["dateDebutContrat"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateDebutContrat = &t
	}
	if v, ok := raw["dateFinContrat"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateFinContrat = &t
	}

	return in, nil
}

// parsePersonnelUpdateInput convertit un map raw en personnel.UpdateInput.
// Tous les champs sont optionnels. Si une clé est présente dans le map mais
// que la valeur est null, on ne met PAS le champ dans l'update (pour préserver
// le comportement "partial update" du frontend qui envoie souvent null pour
// signifier "ne pas changer").
//
// ⚠️ Note : si l'utilisateur veut explicitement vider un champ, il doit envoyer
// une string vide (pour les strings) ou 0 (pour les nombres).
func parsePersonnelUpdateInput(raw map[string]any) (personnel.UpdateInput, error) {
	var in personnel.UpdateInput

	if v, ok := raw["nom"].(string); ok {
		in.Nom = &v
	}
	if v, ok := raw["prenom"].(string); ok {
		in.Prenom = &v
	}
	if v, ok := raw["telephone"].(string); ok {
		in.Telephone = &v
	}
	if v, ok := raw["specialite"].(string); ok {
		in.Specialite = &v
	}
	if v, ok := raw["photo"].(string); ok {
		in.Photo = &v
	}
	if v, ok := raw["typeContrat"].(string); ok {
		in.TypeContrat = &v
	}
	if v, ok := raw["statutContrat"].(string); ok {
		in.StatutContrat = &v
	}
	if v, ok := raw["numeroCNPS"].(string); ok {
		in.NumeroCNPS = &v
	}
	if v, ok := raw["poste"].(string); ok {
		in.Poste = &v
	}
	if v, ok := raw["departement"].(string); ok {
		in.Departement = &v
	}

	if v, ok := raw["tauxJournalier"]; ok {
		f := toFloat64(v)
		in.TauxJournalier = &f
	}
	if v, ok := raw["salaireMensuel"]; ok {
		f := toFloat64(v)
		in.SalaireMensuel = &f
	}
	if v, ok := raw["nbCongesRestants"]; ok {
		n := int(toInt64(v))
		in.NbCongesRestants = &n
	}

	if v, ok := raw["dateDebutContrat"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateDebutContrat = &t
	}
	if v, ok := raw["dateFinContrat"].(string); ok && v != "" {
		t, err := parseDate(v)
		if err != nil {
			return in, err
		}
		in.DateFinContrat = &t
	}

	return in, nil
}
