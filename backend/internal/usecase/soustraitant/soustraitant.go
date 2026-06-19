// Package soustraitant — usecase pour les sous-traitants et leurs contrats
// (Phase 5, peripheral endpoints).
//
// Opérations :
//   - List    : liste paginée avec filtres (type, search)
//   - Get     : détail avec Contrats pré-loadés
//   - Create  : crée un sous-traitant (RLS WITH CHECK → force EntrepriseID)
//   - Update  : met à jour un sous-traitant (tous champs optionnels)
//   - Delete  : supprime un sous-traitant (409 si contrats liés)
//   - ListContrats / CreateContrat / UpdateContrat / DeleteContrat : gestion des contrats ST
//
// Toutes les requêtes sont tenant-scoped via RLS. La table SousTraitant est
// RLS-protected (policy tenant_isolation sur entrepriseId). La table ContratST
// n'a pas de RLS direct : filtrage via JOIN sur "SousTraitant".
package soustraitant

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.SousTraitantRepository.
type Repo interface {
	// SousTraitant
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.SousTraitant, int64, error)
	GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.SousTraitant, error)
	Create(ctx context.Context, auth *database.AuthUser, st model.SousTraitant) (*model.SousTraitant, error)
	Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.SousTraitant, error)
	Delete(ctx context.Context, auth *database.AuthUser, id string) error
	HasLinkedContrats(ctx context.Context, auth *database.AuthUser, sousTraitantID string) (bool, error)

	// ContratST
	ListContratsBySousTraitant(ctx context.Context, auth *database.AuthUser, sousTraitantID string) ([]model.ContratST, error)
	GetContratByID(ctx context.Context, auth *database.AuthUser, contratID string) (*model.ContratST, error)
	CreateContrat(ctx context.Context, auth *database.AuthUser, c model.ContratST) (*model.ContratST, error)
	UpdateContrat(ctx context.Context, auth *database.AuthUser, contratID string, updates map[string]any) (*model.ContratST, error)
	DeleteContrat(ctx context.Context, auth *database.AuthUser, contratID string) error
}

// ListInput — critères de filtrage pour List (SousTraitant).
type ListInput struct {
	Type     string
	Search   string
	Page     int
	PageSize int
}

// CreateInput — payload pour Create (SousTraitant).
type CreateInput struct {
	Type                string
	RaisonSociale       *string
	Nom                 *string
	Prenom              *string
	RCCM                *string
	NIF                 *string
	TypePieceIdentite   *string
	NumeroPieceIdentite *string
	Contact             *string
	Email               *string
	Adresse             *string
	Specialite          *string
	RIB                 *string
}

// UpdateInput — payload pour Update (SousTraitant). Tous optionnels.
type UpdateInput struct {
	Type                *string
	RaisonSociale       *string
	Nom                 *string
	Prenom              *string
	RCCM                *string
	NIF                 *string
	TypePieceIdentite   *string
	NumeroPieceIdentite *string
	Contact             *string
	Email               *string
	Adresse             *string
	Specialite          *string
	RIB                 *string
}

// CreateContratInput — payload pour CreateContrat.
type CreateContratInput struct {
	SousTraitantID string
	ChantierID     string
	ObjetTravaux   string
	MontantHT      float64
	DateDebut      *time.Time
	DateFin        *time.Time
	Conditions     *string
	Statut         string // default EN_COURS if empty
}

// UpdateContratInput — payload pour UpdateContrat. Tous optionnels.
type UpdateContratInput struct {
	ObjetTravaux *string
	MontantHT    *float64
	DateDebut    *time.Time
	DateFin      *time.Time
	Conditions   *string
	Statut       *string
}

// Usecase — cas d'usage pour les sous-traitants.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// List — liste paginée des sous-traitants.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.SousTraitant, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.List(ctx, auth, in)
	if err != nil {
		uc.log.Error("soustraitant.List", "err", err, "auth_uid", auth.UserID)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// Get — détail d'un sous-traitant avec Contrats pré-loadés.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.SousTraitant, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	st, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("soustraitant.Get: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if st == nil {
		return nil, domain.ErrNotFound
	}
	return st, nil
}

// Create — crée un sous-traitant. Force EntrepriseID = auth.EntrepriseID (RLS WITH CHECK).
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.SousTraitant, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	// Validation : type ENTREPRISE → raisonSociale requis ; PARTICULIER → nom+prenom requis.
	t := in.Type
	if t == "" {
		t = "ENTREPRISE"
	}
	if t == "ENTREPRISE" || t == "FOURNISSEUR" {
		if in.RaisonSociale == nil || *in.RaisonSociale == "" {
			return nil, fmt.Errorf("%w: raisonSociale is required for type %s", domain.ErrBadRequest, t)
		}
	}
	if t == "PARTICULIER" {
		if in.Nom == nil || *in.Nom == "" {
			return nil, fmt.Errorf("%w: nom is required for type PARTICULIER", domain.ErrBadRequest)
		}
	}
	st := model.SousTraitant{
		Type:                t,
		RaisonSociale:       in.RaisonSociale,
		Nom:                 in.Nom,
		Prenom:              in.Prenom,
		RCCM:                in.RCCM,
		NIF:                 in.NIF,
		TypePieceIdentite:   in.TypePieceIdentite,
		NumeroPieceIdentite: in.NumeroPieceIdentite,
		Contact:             in.Contact,
		Email:               in.Email,
		Adresse:             in.Adresse,
		Specialite:          in.Specialite,
		RIB:                 in.RIB,
		EntrepriseID:        &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
	}
	created, err := uc.repo.Create(ctx, auth, st)
	if err != nil {
		uc.log.Error("soustraitant.Create: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Update — met à jour un sous-traitant (tous champs optionnels).
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.SousTraitant, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	updates := map[string]any{}
	if in.Type != nil {
		updates["type"] = *in.Type
	}
	if in.RaisonSociale != nil {
		updates["raisonSociale"] = *in.RaisonSociale
	}
	if in.Nom != nil {
		updates["nom"] = *in.Nom
	}
	if in.Prenom != nil {
		updates["prenom"] = *in.Prenom
	}
	if in.RCCM != nil {
		updates["rccm"] = *in.RCCM
	}
	if in.NIF != nil {
		updates["nif"] = *in.NIF
	}
	if in.TypePieceIdentite != nil {
		updates["typePieceIdentite"] = *in.TypePieceIdentite
	}
	if in.NumeroPieceIdentite != nil {
		updates["numeroPieceIdentite"] = *in.NumeroPieceIdentite
	}
	if in.Contact != nil {
		updates["contact"] = *in.Contact
	}
	if in.Email != nil {
		updates["email"] = *in.Email
	}
	if in.Adresse != nil {
		updates["adresse"] = *in.Adresse
	}
	if in.Specialite != nil {
		updates["specialite"] = *in.Specialite
	}
	if in.RIB != nil {
		updates["rib"] = *in.RIB
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("soustraitant.Update: GetByID", "err", err, "id", id)
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
		uc.log.Error("soustraitant.Update: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// Delete — supprime un sous-traitant (409 si contrats liés).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return domain.ErrBadRequest
	}
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("soustraitant.Delete: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}
	has, err := uc.repo.HasLinkedContrats(ctx, auth, id)
	if err != nil {
		uc.log.Error("soustraitant.Delete: HasLinkedContrats", "err", err, "id", id)
		return domain.ErrInternal
	}
	if has {
		return fmt.Errorf("%w: sous-traitant has linked contrats", domain.ErrConflict)
	}
	if err := uc.repo.Delete(ctx, auth, id); err != nil {
		uc.log.Error("soustraitant.Delete: repo", "err", err, "id", id)
		return domain.ErrInternal
	}
	return nil
}

// ListContrats — tous les contrats d'un sous-traitant.
func (uc *Usecase) ListContrats(ctx context.Context, auth *database.AuthUser, sousTraitantID string) ([]model.ContratST, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if sousTraitantID == "" {
		return nil, domain.ErrBadRequest
	}
	// Vérifie que le sous-traitant existe (RLS)
	st, err := uc.repo.GetByID(ctx, auth, sousTraitantID)
	if err != nil {
		uc.log.Error("soustraitant.ListContrats: GetByID", "err", err, "id", sousTraitantID)
		return nil, domain.ErrInternal
	}
	if st == nil {
		return nil, domain.ErrNotFound
	}
	items, err := uc.repo.ListContratsBySousTraitant(ctx, auth, sousTraitantID)
	if err != nil {
		uc.log.Error("soustraitant.ListContrats: repo", "err", err, "id", sousTraitantID)
		return nil, domain.ErrInternal
	}
	return items, nil
}

// CreateContrat — crée un contrat ST pour un sous-traitant.
func (uc *Usecase) CreateContrat(ctx context.Context, auth *database.AuthUser, in CreateContratInput) (*model.ContratST, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.SousTraitantID == "" || in.ChantierID == "" {
		return nil, fmt.Errorf("%w: sousTraitantId and chantierId are required", domain.ErrBadRequest)
	}
	if in.ObjetTravaux == "" {
		return nil, fmt.Errorf("%w: objetTravaux is required", domain.ErrBadRequest)
	}
	// Vérifie que le sous-traitant existe (RLS)
	st, err := uc.repo.GetByID(ctx, auth, in.SousTraitantID)
	if err != nil {
		uc.log.Error("soustraitant.CreateContrat: GetByID", "err", err, "id", in.SousTraitantID)
		return nil, domain.ErrInternal
	}
	if st == nil {
		return nil, domain.ErrNotFound
	}
	statut := in.Statut
	if statut == "" {
		statut = "EN_COURS"
	}
	c := model.ContratST{
		SousTraitantID: in.SousTraitantID,
		ChantierID:     in.ChantierID,
		ObjetTravaux:   in.ObjetTravaux,
		MontantHT:      in.MontantHT,
		DateDebut:      in.DateDebut,
		DateFin:        in.DateFin,
		Conditions:     in.Conditions,
		Statut:         statut,
	}
	created, err := uc.repo.CreateContrat(ctx, auth, c)
	if err != nil {
		uc.log.Error("soustraitant.CreateContrat: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// UpdateContrat — met à jour un contrat ST (tous champs optionnels).
func (uc *Usecase) UpdateContrat(ctx context.Context, auth *database.AuthUser, sousTraitantID, contratID string, in UpdateContratInput) (*model.ContratST, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if sousTraitantID == "" || contratID == "" {
		return nil, domain.ErrBadRequest
	}
	// Vérifie que le sous-traitant existe
	st, err := uc.repo.GetByID(ctx, auth, sousTraitantID)
	if err != nil {
		uc.log.Error("soustraitant.UpdateContrat: GetByID", "err", err, "id", sousTraitantID)
		return nil, domain.ErrInternal
	}
	if st == nil {
		return nil, domain.ErrNotFound
	}
	// Vérifie que le contrat existe et appartient bien au sous-traitant
	existing, err := uc.repo.GetContratByID(ctx, auth, contratID)
	if err != nil {
		uc.log.Error("soustraitant.UpdateContrat: GetContratByID", "err", err, "id", contratID)
		return nil, domain.ErrInternal
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}
	if existing.SousTraitantID != sousTraitantID {
		return nil, domain.ErrNotFound
	}
	updates := map[string]any{}
	if in.ObjetTravaux != nil {
		updates["objetTravaux"] = *in.ObjetTravaux
	}
	if in.MontantHT != nil {
		updates["montantHT"] = *in.MontantHT
	}
	if in.DateDebut != nil {
		updates["dateDebut"] = *in.DateDebut
	}
	if in.DateFin != nil {
		updates["dateFin"] = *in.DateFin
	}
	if in.Conditions != nil {
		updates["conditions"] = *in.Conditions
	}
	if in.Statut != nil {
		updates["statut"] = *in.Statut
	}
	if len(updates) == 0 {
		return existing, nil
	}
	updates["updatedAt"] = time.Now().UTC()
	updated, err := uc.repo.UpdateContrat(ctx, auth, contratID, updates)
	if err != nil {
		uc.log.Error("soustraitant.UpdateContrat: repo", "err", err, "id", contratID)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// DeleteContrat — supprime un contrat ST.
func (uc *Usecase) DeleteContrat(ctx context.Context, auth *database.AuthUser, sousTraitantID, contratID string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if sousTraitantID == "" || contratID == "" {
		return domain.ErrBadRequest
	}
	// Vérifie que le sous-traitant existe
	st, err := uc.repo.GetByID(ctx, auth, sousTraitantID)
	if err != nil {
		uc.log.Error("soustraitant.DeleteContrat: GetByID", "err", err, "id", sousTraitantID)
		return domain.ErrInternal
	}
	if st == nil {
		return domain.ErrNotFound
	}
	// Vérifie que le contrat existe et appartient bien au sous-traitant
	existing, err := uc.repo.GetContratByID(ctx, auth, contratID)
	if err != nil {
		uc.log.Error("soustraitant.DeleteContrat: GetContratByID", "err", err, "id", contratID)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}
	if existing.SousTraitantID != sousTraitantID {
		return domain.ErrNotFound
	}
	if err := uc.repo.DeleteContrat(ctx, auth, contratID); err != nil {
		uc.log.Error("soustraitant.DeleteContrat: repo", "err", err, "id", contratID)
		return domain.ErrInternal
	}
	return nil
}
