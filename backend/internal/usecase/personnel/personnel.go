// Package personnel — usecase pour la gestion du personnel (journaliers +
// affectations) — module PHASE-B-PERSONNEL.
//
// Opérations :
//   - List    : liste paginée avec filtres (search, statutContrat, typeContrat,
//     specialite, specialites[], chantierId) + KPI agrégés
//   - Get     : détail d'un journalier avec affectations préloadées
//   - Create  : crée un journalier (RLS WITH CHECK → force EntrepriseID)
//   - Update  : met à jour un journalier (partial updates)
//   - Delete  : supprime un journalier (hard delete)
//   - ListAffectations / CreateAffectation / DeleteAffectation : gestion des
//     affectations journalier ↔ chantier
//
// Toutes les requêtes sont tenant-scoped via RLS. La table Journalier est
// RLS-protected (policy tenant_isolation sur entrepriseId). La table
// JournalierAffectation n'a pas de RLS direct : filtrage via JOIN sur Chantier
// (RLS-protected) ou via la contrainte journalierId = j.id (implicitement
// tenant-scoped quand le journalier est filtré par RLS).
package personnel

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// ══════════════════════════════════════════════════════════════════
// Repo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.PersonnelRepository.
// ══════════════════════════════════════════════════════════════════

type Repo interface {
	// ── Journalier ───────────────────────────────────────────────
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Journalier, int64, error)
	GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Journalier, error)
	Create(ctx context.Context, auth *database.AuthUser, j model.Journalier) (*model.Journalier, error)
	Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Journalier, error)
	Delete(ctx context.Context, auth *database.AuthUser, id string) error

	// KPI agrégés
	CountKPI(ctx context.Context, auth *database.AuthUser) (KPICounts, error)
	CountNonAffecte(ctx context.Context, auth *database.AuthUser) (int64, error)

	// ── JournalierAffectation ────────────────────────────────────
	ListAffectationsByJournalier(ctx context.Context, auth *database.AuthUser, journalierID string) ([]model.JournalierAffectation, error)
	CreateAffectation(ctx context.Context, auth *database.AuthUser, a model.JournalierAffectation) (*model.JournalierAffectation, error)
	DeleteAffectation(ctx context.Context, auth *database.AuthUser, affectationID string) error
	DeleteAffectationByChantier(ctx context.Context, auth *database.AuthUser, journalierID, chantierID string) error

	// existence pour FK checks
	ChantierExists(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error)
}

// ══════════════════════════════════════════════════════════════════
// Inputs / Outputs
// ══════════════════════════════════════════════════════════════════

// ListInput — critères de filtrage pour List.
type ListInput struct {
	Search        string   // ILIKE sur nom, prenom, telephone
	StatutContrat string   // filtre sur statutContrat (ACTIF, ESSAI, TERMINE, SUSPENDU)
	TypeContrat   string   // filtre sur typeContrat (JOURNALIER, CDD, CDI, STAGIAIRE)
	Specialite    string   // filtre sur specialite (single value)
	Specialites   []string // filtre sur specialite (multiple values, OR)
	ChantierID    string   // journaliers ayant une affectation active sur ce chantier
	Page          int      // 1-based, défaut 1
	PageSize      int      // défaut 50
}

// CreateInput — payload pour la création d'un journalier.
// Les champs optionnels sont des pointeurs.
type CreateInput struct {
	Nom              string
	Prenom           string
	Telephone        *string
	Specialite       *string
	Photo            *string
	TypeContrat      string
	TauxJournalier   *float64
	SalaireMensuel   *float64
	DateDebutContrat *time.Time
	DateFinContrat   *time.Time
	StatutContrat    string
	NumeroCNPS       *string
	NbCongesRestants *int
	Poste            *string
	Departement      *string
}

// UpdateInput — payload pour la mise à jour d'un journalier.
// Tous les champs sont optionnels (partial update).
type UpdateInput struct {
	Nom              *string
	Prenom           *string
	Telephone        *string
	Specialite       *string
	Photo            *string
	TypeContrat      *string
	TauxJournalier   *float64
	SalaireMensuel   *float64
	DateDebutContrat *time.Time
	DateFinContrat   *time.Time
	StatutContrat    *string
	NumeroCNPS       *string
	NbCongesRestants *int
	Poste            *string
	Departement      *string
}

// CreateAffectationInput — payload pour la création d'une affectation.
type CreateAffectationInput struct {
	JournalierID string
	ChantierID   string
	DateDebut    *time.Time
	DateFin      *time.Time
}

// KPICounts — compteurs agrégés pour les KPI de la liste.
// Les tags gorm column permettent le Scan direct depuis une query SQL
// avec des colonnes aliasées.
type KPICounts struct {
	Total        int64 `json:"total" gorm:"column:total"`
	Journaliers  int64 `json:"journaliers" gorm:"column:journaliers"`
	CDD          int64 `json:"cdd" gorm:"column:cdd"`
	CDI          int64 `json:"cdi" gorm:"column:cdi"`
	Stagiaires   int64 `json:"stagiaires" gorm:"column:stagiaires"`
	GrosOeuvre   int64 `json:"grosOeuvre" gorm:"column:grosOeuvre"`
	Enveloppe    int64 `json:"enveloppe" gorm:"column:enveloppe"`
	SecondOeuvre int64 `json:"secondOeuvre" gorm:"column:secondOeuvre"`
}

// KPI — structure complète retournée au frontend (avec nonAffecte).
type KPI struct {
	Total        int64 `json:"total"`
	GrosOeuvre   int64 `json:"grosOeuvre"`
	Enveloppe    int64 `json:"enveloppe"`
	SecondOeuvre int64 `json:"secondOeuvre"`
	NonAffecte   int64 `json:"nonAffecte"`
	Journaliers  int64 `json:"journaliers"`
	CDD          int64 `json:"cdd"`
	CDI          int64 `json:"cdi"`
	Stagiaires   int64 `json:"stagiaires"`
}

// ListOutput — résultat de List (journaliers paginés + KPI agrégés).
type ListOutput struct {
	Journaliers []model.Journalier `json:"journaliers"`
	KPI         KPI                `json:"kpi"`
	Total       int64              `json:"total"`
	Page        int                `json:"page"`
	PageSize    int                `json:"pageSize"`
}

// ══════════════════════════════════════════════════════════════════
// Usecase
// ══════════════════════════════════════════════════════════════════

// Usecase — cas d'usage pour le personnel.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Constantes de validation
// ══════════════════════════════════════════════════════════════════

// validTypeContrats — types de contrat autorisés (cf. Prisma schema).
var validTypeContrats = map[string]struct{}{
	"JOURNALIER": {},
	"CDD":        {},
	"CDI":        {},
	"STAGIAIRE":  {},
}

// validStatutsContrat — statuts de contrat autorisés.
var validStatutsContrat = map[string]struct{}{
	"ACTIF":    {},
	"ESSAI":    {},
	"TERMINE":  {},
	"SUSPENDU": {},
}

// specialitesByPhase — mapping spécialité → groupe de phase BTP
// (aligné sur PHASE_GROUPS du frontend personnel-view.tsx).
// Utilisé pour les KPI grosOeuvre / enveloppe / secondOeuvre.
var specialitesByPhase = map[string]string{
	// GROS_OEUVRE
	"Terrassier":             "GROS_OEUVRE",
	"Canalisateur VRD":       "GROS_OEUVRE",
	"Maçon":                  "GROS_OEUVRE",
	"Coffreur-bancheur":      "GROS_OEUVRE",
	"Ferrailleur":            "GROS_OEUVRE",
	"Monteur d'échafaudages": "GROS_OEUVRE",
	"Grutier":                "GROS_OEUVRE",
	// ENVELOPPE
	"Charpentier":         "ENVELOPPE",
	"Couvreur / Zingueur": "ENVELOPPE",
	"Étancheur":           "ENVELOPPE",
	"Menuisier extérieur": "ENVELOPPE",
	"Façadier / Bardeur":  "ENVELOPPE",
	// SECOND_OEUVRE
	"Isolation":           "SECOND_OEUVRE",
	"Plâtrier":            "SECOND_OEUVRE",
	"Plombier":            "SECOND_OEUVRE",
	"CVC":                 "SECOND_OEUVRE",
	"Électricien":         "SECOND_OEUVRE",
	"Menuisier intérieur": "SECOND_OEUVRE",
	"Carreleur":           "SECOND_OEUVRE",
	"Peintre":             "SECOND_OEUVRE",
	"Agenceur":            "SECOND_OEUVRE",
}

// SpecialitesForPhase retourne la liste des spécialités pour un groupe de phase.
// Utilisé pour construire la clause IN (?) du SQL KPI.
func SpecialitesForPhase(phase string) []string {
	out := make([]string, 0, 9)
	for spec, p := range specialitesByPhase {
		if p == phase {
			out = append(out, spec)
		}
	}
	return out
}

// isValidTypeContrat vérifie qu'un type de contrat est valide.
func isValidTypeContrat(t string) bool {
	_, ok := validTypeContrats[t]
	return ok
}

// isValidStatutContrat vérifie qu'un statut de contrat est valide.
func isValidStatutContrat(s string) bool {
	_, ok := validStatutsContrat[s]
	return ok
}

// ══════════════════════════════════════════════════════════════════
// List — liste paginée + KPI agrégés
// ══════════════════════════════════════════════════════════════════

// List — retourne une page de journaliers (avec affectations préloadées) + KPI.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) (*ListOutput, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}

	// Defaults pagination
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}

	// Normalisation : si specialite single est fournie, l'ajouter à specialites
	if in.Specialite != "" {
		in.Specialites = append(in.Specialites, in.Specialite)
	}

	journaliers, total, err := uc.repo.List(ctx, auth, in)
	if err != nil {
		uc.log.Error("personnel.List: repo.List", "err", err, "auth_uid", auth.UserID)
		return nil, domain.ErrInternal
	}

	// KPI agrégés (sur TOUS les journaliers du tenant, sans filtres)
	counts, err := uc.repo.CountKPI(ctx, auth)
	if err != nil {
		uc.log.Error("personnel.List: CountKPI", "err", err)
		return nil, domain.ErrInternal
	}
	nonAffecte, err := uc.repo.CountNonAffecte(ctx, auth)
	if err != nil {
		uc.log.Error("personnel.List: CountNonAffecte", "err", err)
		return nil, domain.ErrInternal
	}

	return &ListOutput{
		Journaliers: journaliers,
		KPI: KPI{
			Total:        counts.Total,
			GrosOeuvre:   counts.GrosOeuvre,
			Enveloppe:    counts.Enveloppe,
			SecondOeuvre: counts.SecondOeuvre,
			NonAffecte:   nonAffecte,
			Journaliers:  counts.Journaliers,
			CDD:          counts.CDD,
			CDI:          counts.CDI,
			Stagiaires:   counts.Stagiaires,
		},
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	}, nil
}

// Get — retourne un journalier par ID avec affectations préloadées.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.Journalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}

	j, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("personnel.Get: repo.GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if j == nil {
		return nil, domain.ErrNotFound
	}
	return j, nil
}

// ══════════════════════════════════════════════════════════════════
// Create — crée un nouveau journalier (RLS WITH CHECK → force EntrepriseID)
// ══════════════════════════════════════════════════════════════════

func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Journalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}

	// ── Validation ─────────────────────────────────────────────
	in.Nom = strings.TrimSpace(in.Nom)
	if in.Nom == "" {
		return nil, fmt.Errorf("%w: nom is required", domain.ErrBadRequest)
	}
	in.Prenom = strings.TrimSpace(in.Prenom)
	if in.Prenom == "" {
		return nil, fmt.Errorf("%w: prenom is required", domain.ErrBadRequest)
	}

	typeContrat := in.TypeContrat
	if typeContrat == "" {
		typeContrat = "JOURNALIER"
	}
	if !isValidTypeContrat(typeContrat) {
		return nil, fmt.Errorf("%w: invalid typeContrat %q", domain.ErrBadRequest, typeContrat)
	}

	statutContrat := in.StatutContrat
	if statutContrat == "" {
		statutContrat = "ACTIF"
	}
	if !isValidStatutContrat(statutContrat) {
		return nil, fmt.Errorf("%w: invalid statutContrat %q", domain.ErrBadRequest, statutContrat)
	}

	// Règle métier : dateFinContrat ne peut être antérieure à dateDebutContrat
	if in.DateDebutContrat != nil && in.DateFinContrat != nil && in.DateFinContrat.Before(*in.DateDebutContrat) {
		return nil, fmt.Errorf("%w: dateFinContrat cannot be before dateDebutContrat", domain.ErrBadRequest)
	}

	// ── Résolution entrepriseId ────────────────────────────────
	var entrepriseID *string
	if auth.Role == "SUPER_ADMIN" {
		// SUPER_ADMIN peut créer dans n'importe quelle entreprise (entrepriseId non forcé)
		entrepriseID = nil
	} else {
		if auth.EntrepriseID == "" {
			return nil, fmt.Errorf("%w: non-admin user has no entrepriseId", domain.ErrBadRequest)
		}
		eid := auth.EntrepriseID
		entrepriseID = &eid
	}

	// ── Construction du modèle ─────────────────────────────────
	j := model.Journalier{
		Nom:              in.Nom,
		Prenom:           in.Prenom,
		Telephone:        in.Telephone,
		Specialite:       in.Specialite,
		Photo:            in.Photo,
		TypeContrat:      typeContrat,
		TauxJournalier:   in.TauxJournalier,
		SalaireMensuel:   in.SalaireMensuel,
		DateDebutContrat: in.DateDebutContrat,
		DateFinContrat:   in.DateFinContrat,
		StatutContrat:    statutContrat,
		NumeroCNPS:       in.NumeroCNPS,
		Poste:            in.Poste,
		Departement:      in.Departement,
		EntrepriseID:     entrepriseID,
	}
	if in.NbCongesRestants != nil {
		j.NbCongesRestants = *in.NbCongesRestants
	}

	created, err := uc.repo.Create(ctx, auth, j)
	if err != nil {
		uc.log.Error("personnel.Create: repo", "err", err, "nom", in.Nom)
		return nil, domain.ErrInternal
	}

	uc.log.Info("journalier created",
		"id", created.ID,
		"nom", created.Nom,
		"prenom", created.Prenom,
		"typeContrat", created.TypeContrat,
		"by", auth.UserID,
	)

	return created, nil
}

// ══════════════════════════════════════════════════════════════════
// Update — met à jour un journalier (partial updates)
// ══════════════════════════════════════════════════════════════════

func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Journalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}

	updates := map[string]any{}

	if in.Nom != nil {
		v := strings.TrimSpace(*in.Nom)
		if v == "" {
			return nil, fmt.Errorf("%w: nom cannot be empty", domain.ErrBadRequest)
		}
		updates["nom"] = v
	}
	if in.Prenom != nil {
		v := strings.TrimSpace(*in.Prenom)
		if v == "" {
			return nil, fmt.Errorf("%w: prenom cannot be empty", domain.ErrBadRequest)
		}
		updates["prenom"] = v
	}
	if in.Telephone != nil {
		updates["telephone"] = *in.Telephone
	}
	if in.Specialite != nil {
		updates["specialite"] = *in.Specialite
	}
	if in.Photo != nil {
		updates["photo"] = *in.Photo
	}
	if in.TypeContrat != nil {
		if !isValidTypeContrat(*in.TypeContrat) {
			return nil, fmt.Errorf("%w: invalid typeContrat %q", domain.ErrBadRequest, *in.TypeContrat)
		}
		updates["typeContrat"] = *in.TypeContrat
	}
	if in.TauxJournalier != nil {
		updates["tauxJournalier"] = *in.TauxJournalier
	}
	if in.SalaireMensuel != nil {
		updates["salaireMensuel"] = *in.SalaireMensuel
	}
	if in.DateDebutContrat != nil {
		updates["dateDebutContrat"] = *in.DateDebutContrat
	}
	if in.DateFinContrat != nil {
		updates["dateFinContrat"] = *in.DateFinContrat
	}
	if in.StatutContrat != nil {
		if !isValidStatutContrat(*in.StatutContrat) {
			return nil, fmt.Errorf("%w: invalid statutContrat %q", domain.ErrBadRequest, *in.StatutContrat)
		}
		updates["statutContrat"] = *in.StatutContrat
	}
	if in.NumeroCNPS != nil {
		updates["numeroCNPS"] = *in.NumeroCNPS
	}
	if in.NbCongesRestants != nil {
		updates["nbCongesRestants"] = *in.NbCongesRestants
	}
	if in.Poste != nil {
		updates["poste"] = *in.Poste
	}
	if in.Departement != nil {
		updates["departement"] = *in.Departement
	}

	// Vérification dateFin >= dateDebut si les deux sont fournis dans cet update
	if in.DateDebutContrat != nil && in.DateFinContrat != nil && in.DateFinContrat.Before(*in.DateDebutContrat) {
		return nil, fmt.Errorf("%w: dateFinContrat cannot be before dateDebutContrat", domain.ErrBadRequest)
	}

	if len(updates) == 0 {
		// Pas d'updates → on retourne le journalier courant
		return uc.Get(ctx, auth, id)
	}

	updated, err := uc.repo.Update(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("personnel.Update: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}

	uc.log.Info("journalier updated", "id", id, "by", auth.UserID, "fields", keysOf(updates))
	return updated, nil
}

// ══════════════════════════════════════════════════════════════════
// Delete — supprime un journalier (hard delete)
// ══════════════════════════════════════════════════════════════════

// Delete supprime un journalier par ID.
// Renvoie ErrNotFound si l'ID n'existe pas ou n'est pas visible (RLS).
// Les affectations liées sont supprimées explicitement par le repo avant la
// suppression du journalier (cascade manuelle).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
	}

	// Vérifie que le journalier existe (pour 404)
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("personnel.Delete: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}

	if err := uc.repo.Delete(ctx, auth, id); err != nil {
		uc.log.Error("personnel.Delete: repo", "err", err, "id", id)
		return domain.ErrInternal
	}

	uc.log.Info("journalier deleted", "id", id, "by", auth.UserID)
	return nil
}

// ══════════════════════════════════════════════════════════════════
// Affectations
// ══════════════════════════════════════════════════════════════════

// ListAffectations — liste les affectations d'un journalier (RLS via JOIN Chantier).
func (uc *Usecase) ListAffectations(ctx context.Context, auth *database.AuthUser, journalierID string) ([]model.JournalierAffectation, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if journalierID == "" {
		return nil, fmt.Errorf("%w: journalierId is required", domain.ErrBadRequest)
	}

	// Vérifie que le journalier existe (pour 404)
	j, err := uc.repo.GetByID(ctx, auth, journalierID)
	if err != nil {
		uc.log.Error("personnel.ListAffectations: GetByID", "err", err, "id", journalierID)
		return nil, domain.ErrInternal
	}
	if j == nil {
		return nil, domain.ErrNotFound
	}

	items, err := uc.repo.ListAffectationsByJournalier(ctx, auth, journalierID)
	if err != nil {
		uc.log.Error("personnel.ListAffectations: repo", "err", err, "id", journalierID)
		return nil, domain.ErrInternal
	}
	return items, nil
}

// CreateAffectation — crée une affectation journalier ↔ chantier.
// Vérifie que le journalier ET le chantier sont visibles par le tenant (RLS).
func (uc *Usecase) CreateAffectation(ctx context.Context, auth *database.AuthUser, in CreateAffectationInput) (*model.JournalierAffectation, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.JournalierID == "" {
		return nil, fmt.Errorf("%w: journalierId is required", domain.ErrBadRequest)
	}
	if in.ChantierID == "" {
		return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
	}

	// Vérifie que le journalier existe (RLS direct sur Journalier)
	j, err := uc.repo.GetByID(ctx, auth, in.JournalierID)
	if err != nil {
		uc.log.Error("personnel.CreateAffectation: GetByID journalier", "err", err, "id", in.JournalierID)
		return nil, domain.ErrInternal
	}
	if j == nil {
		return nil, domain.ErrNotFound
	}

	// Vérifie que le chantier existe (RLS direct sur Chantier)
	chantierExists, err := uc.repo.ChantierExists(ctx, auth, in.ChantierID)
	if err != nil {
		uc.log.Error("personnel.CreateAffectation: ChantierExists", "err", err, "id", in.ChantierID)
		return nil, domain.ErrInternal
	}
	if !chantierExists {
		return nil, fmt.Errorf("%w: chantier not found", domain.ErrNotFound)
	}

	// Validation dates
	if in.DateDebut != nil && in.DateFin != nil && in.DateFin.Before(*in.DateDebut) {
		return nil, fmt.Errorf("%w: dateFin cannot be before dateDebut", domain.ErrBadRequest)
	}

	a := model.JournalierAffectation{
		JournalierID: in.JournalierID,
		ChantierID:   in.ChantierID,
		DateDebut:    in.DateDebut,
		DateFin:      in.DateFin,
		Actif:        true,
	}

	created, err := uc.repo.CreateAffectation(ctx, auth, a)
	if err != nil {
		uc.log.Error("personnel.CreateAffectation: repo", "err", err,
			"journalierId", in.JournalierID, "chantierId", in.ChantierID)
		return nil, domain.ErrInternal
	}

	uc.log.Info("affectation created",
		"id", created.ID,
		"journalierId", in.JournalierID,
		"chantierId", in.ChantierID,
		"by", auth.UserID,
	)
	return created, nil
}

// DeleteAffectation — supprime une affectation par ID.
func (uc *Usecase) DeleteAffectation(ctx context.Context, auth *database.AuthUser, affectationID string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if affectationID == "" {
		return fmt.Errorf("%w: affectationId is required", domain.ErrBadRequest)
	}

	if err := uc.repo.DeleteAffectation(ctx, auth, affectationID); err != nil {
		uc.log.Error("personnel.DeleteAffectation: repo", "err", err, "id", affectationID)
		return domain.ErrInternal
	}

	uc.log.Info("affectation deleted", "id", affectationID, "by", auth.UserID)
	return nil
}

// DeleteAffectationByChantier — supprime l'affectation d'un journalier à un
// chantier (identifiée par la paire journalierId + chantierId).
// Utilisé par le frontend qui passe ?chantierId= en query param.
func (uc *Usecase) DeleteAffectationByChantier(ctx context.Context, auth *database.AuthUser, journalierID, chantierID string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if journalierID == "" || chantierID == "" {
		return fmt.Errorf("%w: journalierId and chantierId are required", domain.ErrBadRequest)
	}

	if err := uc.repo.DeleteAffectationByChantier(ctx, auth, journalierID, chantierID); err != nil {
		uc.log.Error("personnel.DeleteAffectationByChantier: repo", "err", err,
			"journalierId", journalierID, "chantierId", chantierID)
		return domain.ErrInternal
	}

	uc.log.Info("affectation deleted by chantier pair",
		"journalierId", journalierID, "chantierId", chantierID, "by", auth.UserID)
	return nil
}

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

// keysOf retourne les clés d'un map (pour logging).
func keysOf(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
