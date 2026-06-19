// Package pointage — usecase pour le pointage des journaliers (Phase 3).
//
// Opérations (CRUD + validate + summary) :
//   - List    : liste paginée filtrée (chantierId, journalierId, date)
//   - Get     : détail d'un pointage
//   - Create  : crée un pointage (valide chantier + check @@unique [journalierId, chantierId, dateTravail])
//   - Update  : met à jour tauxJournalier, present, observation
//   - Delete  : supprime un pointage
//   - Validate: marque valide=true (RBAC: CHEF_PROJET, GERANT, SUPER_ADMIN)
//   - Summary : agrégats par chantier + plage de dates
//
// Toutes les requêtes sont tenant-scoped via RLS (Row-Level Security).
// La table Pointage n'a pas de RLS direct : filtrage via JOIN sur "Chantier"
// (RLS-protected).
package pointage

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.PointageRepository.
type Repo interface {
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Pointage, int64, error)
	GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Pointage, error)
	ExistsDuplicate(ctx context.Context, auth *database.AuthUser, journalierID, chantierID string, date time.Time, excludeID string) (bool, error)
	ChantierAccessible(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error)
	Create(ctx context.Context, auth *database.AuthUser, p model.Pointage) (*model.Pointage, error)
	Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Pointage, error)
	Delete(ctx context.Context, auth *database.AuthUser, id string) error
	Summary(ctx context.Context, auth *database.AuthUser, chantierID string, dateDebut, dateFin time.Time) (*Summary, error)
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
	ChantierID   string
	JournalierID string
	Date         time.Time // zero = no filter
	Page         int
	PageSize     int
}

// CreateInput — payload pour Create.
type CreateInput struct {
	JournalierID   string
	ChantierID     string
	DateTravail    time.Time
	TauxJournalier float64
	Present        bool
	Observation    *string
}

// UpdateInput — payload pour Update (tous optionnels).
type UpdateInput struct {
	TauxJournalier *float64
	Present        *bool
	Observation    *string
}

// Summary — agrégats par chantier + plage de dates.
type Summary struct {
	ChantierID   string    `json:"chantierId"`
	DateDebut    time.Time `json:"dateDebut"`
	DateFin      time.Time `json:"dateFin"`
	Total        int64     `json:"total"`
	PresentCount int64     `json:"presentCount"`
	AbsentCount  int64     `json:"absentCount"`
	TotalCost    float64   `json:"totalCost"`
}

// Usecase — cas d'usage pour les pointages.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// List — liste paginée des pointages.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Pointage, int64, error) {
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
		uc.log.Error("pointage.List", "err", err, "auth_uid", auth.UserID)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// Get — retourne un pointage par ID.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.Pointage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	p, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("pointage.Get", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if p == nil {
		return nil, domain.ErrNotFound
	}
	return p, nil
}

// Create — crée un pointage (valide chantier accessible + check unique).
// chefChantierId est forcé à auth.UserID.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Pointage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.JournalierID == "" || in.ChantierID == "" {
		return nil, fmt.Errorf("%w: journalierId and chantierId are required", domain.ErrBadRequest)
	}
	if in.DateTravail.IsZero() {
		return nil, fmt.Errorf("%w: dateTravail is required", domain.ErrBadRequest)
	}

	// Vérifie que le chantier est accessible au tenant (RLS via Chantier)
	ok, err := uc.repo.ChantierAccessible(ctx, auth, in.ChantierID)
	if err != nil {
		uc.log.Error("pointage.Create: ChantierAccessible", "err", err)
		return nil, domain.ErrInternal
	}
	if !ok {
		return nil, fmt.Errorf("%w: chantier not found or not accessible", domain.ErrBadRequest)
	}

	// Check @@unique [journalierId, chantierId, dateTravail]
	dup, err := uc.repo.ExistsDuplicate(ctx, auth, in.JournalierID, in.ChantierID, in.DateTravail, "")
	if err != nil {
		uc.log.Error("pointage.Create: ExistsDuplicate", "err", err)
		return nil, domain.ErrInternal
	}
	if dup {
		return nil, domain.ErrConflict
	}

	chef := auth.UserID
	p := model.Pointage{
		JournalierID:   in.JournalierID,
		ChantierID:     in.ChantierID,
		ChefChantierID: &chef,
		DateTravail:    in.DateTravail,
		TauxJournalier: in.TauxJournalier,
		Present:        in.Present,
		Observation:    in.Observation,
	}

	created, err := uc.repo.Create(ctx, auth, p)
	if err != nil {
		uc.log.Error("pointage.Create: repo.Create", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Update — met à jour un pointage (tauxJournalier, present, observation).
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Pointage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}

	updates := map[string]any{}
	if in.TauxJournalier != nil {
		updates["tauxJournalier"] = *in.TauxJournalier
	}
	if in.Present != nil {
		updates["present"] = *in.Present
	}
	if in.Observation != nil {
		updates["observation"] = *in.Observation
	}
	if len(updates) == 0 {
		return uc.Get(ctx, auth, id)
	}
	updates["updatedAt"] = time.Now().UTC()

	updated, err := uc.repo.Update(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("pointage.Update", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// Delete — supprime un pointage.
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return domain.ErrBadRequest
	}
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("pointage.Delete: GetByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}
	if err := uc.repo.Delete(ctx, auth, id); err != nil {
		uc.log.Error("pointage.Delete: repo.Delete", "err", err, "id", id)
		return domain.ErrInternal
	}
	return nil
}

// Validate — marque valide=true (RBAC: CHEF_PROJET, GERANT, SUPER_ADMIN).
func (uc *Usecase) Validate(ctx context.Context, auth *database.AuthUser, id string) (*model.Pointage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("pointage.Validate: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}
	updated, err := uc.repo.Update(ctx, auth, id, map[string]any{
		"valide":    true,
		"updatedAt": time.Now().UTC(),
	})
	if err != nil {
		uc.log.Error("pointage.Validate: Update", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// Summary — agrégats par chantier + plage de dates.
func (uc *Usecase) Summary(ctx context.Context, auth *database.AuthUser, chantierID string, dateDebut, dateFin time.Time) (*Summary, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if chantierID == "" {
		return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
	}
	if dateDebut.IsZero() || dateFin.IsZero() {
		return nil, fmt.Errorf("%w: dateDebut and dateFin are required", domain.ErrBadRequest)
	}
	if dateFin.Before(dateDebut) {
		return nil, fmt.Errorf("%w: dateFin must be >= dateDebut", domain.ErrBadRequest)
	}
	s, err := uc.repo.Summary(ctx, auth, chantierID, dateDebut, dateFin)
	if err != nil {
		uc.log.Error("pointage.Summary", "err", err, "chantierId", chantierID)
		return nil, domain.ErrInternal
	}
	return s, nil
}
