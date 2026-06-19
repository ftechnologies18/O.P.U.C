// Package document — usecase pour les documents, photos et rapports journaliers
// (Phase 5, peripheral endpoints).
//
// Opérations :
//   - Documents  : List, Get, Create, Update, Delete
//   - Photos     : List, Create, Delete
//   - Rapports   : List, Get (with Photos), Create, Update
//
// Toutes les tables (DocumentChantier, Photo, RapportJournalier) n'ont pas de
// RLS direct : filtrage via JOIN sur "Chantier" (RLS-protected).
//
// Champs auto-set côté usecase :
//   - DocumentChantier.auteurId = auth.UserID
//   - Photo.priseParId = auth.UserID
//   - RapportJournalier.auteurId = auth.UserID
package document

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.DocumentRepository.
type Repo interface {
	// DocumentChantier
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.DocumentChantier, int64, error)
	GetDocumentByID(ctx context.Context, auth *database.AuthUser, id string) (*model.DocumentChantier, error)
	CreateDocument(ctx context.Context, auth *database.AuthUser, d model.DocumentChantier) (*model.DocumentChantier, error)
	UpdateDocument(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.DocumentChantier, error)
	DeleteDocument(ctx context.Context, auth *database.AuthUser, id string) error

	// Photo
	ListPhotos(ctx context.Context, auth *database.AuthUser, filter PhotoListInput) ([]model.Photo, int64, error)
	CreatePhoto(ctx context.Context, auth *database.AuthUser, p model.Photo) (*model.Photo, error)
	DeletePhoto(ctx context.Context, auth *database.AuthUser, id string) error

	// RapportJournalier
	ListRapports(ctx context.Context, auth *database.AuthUser, filter RapportListInput) ([]model.RapportJournalier, int64, error)
	GetRapportByID(ctx context.Context, auth *database.AuthUser, id string) (*model.RapportJournalier, error)
	CreateRapport(ctx context.Context, auth *database.AuthUser, rp model.RapportJournalier) (*model.RapportJournalier, error)
	UpdateRapport(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.RapportJournalier, error)
}

// ListInput — critères de filtrage pour List (DocumentChantier).
type ListInput struct {
	ChantierID string
	Type       string
	Statut     string
	Search     string
	Page       int
	PageSize   int
}

// PhotoListInput — critères de filtrage pour ListPhotos.
type PhotoListInput struct {
	ChantierID string
	Categorie  string
	Page       int
	PageSize   int
}

// RapportListInput — critères de filtrage pour ListRapports.
type RapportListInput struct {
	ChantierID string
	Date       time.Time // zero = no filter
	Page       int
	PageSize   int
}

// CreateDocumentInput — payload pour CreateDocument.
type CreateDocumentInput struct {
	Titre         string
	Type          string
	Categorie     *string
	NumeroRef     *string
	FichierNom    string
	FichierUrl    string
	FichierTaille int
	FichierType   *string
	Description   *string
	ChantierID    string
	PhaseID       *string
	DateDocument  *time.Time
}

// UpdateDocumentInput — payload pour UpdateDocument. Tous optionnels.
type UpdateDocumentInput struct {
	Titre       *string
	Type        *string
	Description *string
	Statut      *string
	Tags        *string
}

// CreatePhotoInput — payload pour CreatePhoto.
type CreatePhotoInput struct {
	ChantierID   string
	PhaseID      *string
	TacheID      *string
	RapportID    *string
	DatePrise    time.Time
	Legende      *string
	Categorie    string
	UrlOriginale string
	UrlThumbnail *string
}

// CreateRapportInput — payload pour CreateRapport.
type CreateRapportInput struct {
	ChantierID      string
	DateRapport     time.Time
	Meteo           *string
	EffectifPresent *int
	TravauxRealises string
	Incidents       *string
	Observations    *string
}

// UpdateRapportInput — payload pour UpdateRapport. Tous optionnels.
type UpdateRapportInput struct {
	Meteo           *string
	EffectifPresent *int
	TravauxRealises *string
	Incidents       *string
	Observations    *string
}

// Usecase — cas d'usage pour documents/photos/rapports.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// ── Documents ──────────────────────────────────────────────────

// List — liste paginée des documents.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.DocumentChantier, int64, error) {
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
		uc.log.Error("document.List", "err", err, "auth_uid", auth.UserID)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// Get — détail d'un document.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.DocumentChantier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	d, err := uc.repo.GetDocumentByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("document.Get", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if d == nil {
		return nil, domain.ErrNotFound
	}
	return d, nil
}

// Create — crée un document. Force auteurId = auth.UserID.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateDocumentInput) (*model.DocumentChantier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.Titre == "" || in.ChantierID == "" {
		return nil, fmt.Errorf("%w: titre and chantierId are required", domain.ErrBadRequest)
	}
	if in.FichierNom == "" || in.FichierUrl == "" {
		return nil, fmt.Errorf("%w: fichierNom and fichierUrl are required", domain.ErrBadRequest)
	}
	t := in.Type
	if t == "" {
		t = "autre"
	}
	d := model.DocumentChantier{
		Titre:         in.Titre,
		Type:          t,
		Categorie:     in.Categorie,
		NumeroReference: in.NumeroRef,
		FichierNom:    in.FichierNom,
		FichierUrl:    in.FichierUrl,
		FichierTaille: in.FichierTaille,
		FichierType:   in.FichierType,
		Description:   in.Description,
		ChantierID:    in.ChantierID,
		PhaseID:       in.PhaseID,
		AuteurID:      auth.UserID,
		DateDocument:  in.DateDocument,
	}
	created, err := uc.repo.CreateDocument(ctx, auth, d)
	if err != nil {
		uc.log.Error("document.Create: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Update — met à jour un document.
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateDocumentInput) (*model.DocumentChantier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	updates := map[string]any{}
	if in.Titre != nil {
		updates["titre"] = *in.Titre
	}
	if in.Type != nil {
		updates["type"] = *in.Type
	}
	if in.Description != nil {
		updates["description"] = *in.Description
	}
	if in.Statut != nil {
		updates["statut"] = *in.Statut
	}
	if in.Tags != nil {
		updates["tags"] = *in.Tags
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetDocumentByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("document.Update: GetDocumentByID", "err", err, "id", id)
			return nil, domain.ErrInternal
		}
		if existing == nil {
			return nil, domain.ErrNotFound
		}
		return existing, nil
	}
	updates["updatedAt"] = time.Now().UTC()
	updated, err := uc.repo.UpdateDocument(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("document.Update: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// Delete — supprime un document.
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return domain.ErrBadRequest
	}
	existing, err := uc.repo.GetDocumentByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("document.Delete: GetDocumentByID", "err", err, "id", id)
		return domain.ErrInternal
	}
	if existing == nil {
		return domain.ErrNotFound
	}
	if err := uc.repo.DeleteDocument(ctx, auth, id); err != nil {
		uc.log.Error("document.Delete: repo", "err", err, "id", id)
		return domain.ErrInternal
	}
	return nil
}

// ── Photos ─────────────────────────────────────────────────────

// ListPhotos — liste paginée des photos.
func (uc *Usecase) ListPhotos(ctx context.Context, auth *database.AuthUser, in PhotoListInput) ([]model.Photo, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListPhotos(ctx, auth, in)
	if err != nil {
		uc.log.Error("document.ListPhotos", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// CreatePhoto — crée une photo. Force priseParId = auth.UserID.
func (uc *Usecase) CreatePhoto(ctx context.Context, auth *database.AuthUser, in CreatePhotoInput) (*model.Photo, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.ChantierID == "" {
		return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
	}
	if in.UrlOriginale == "" {
		return nil, fmt.Errorf("%w: urlOriginale is required", domain.ErrBadRequest)
	}
	if in.DatePrise.IsZero() {
		return nil, fmt.Errorf("%w: datePrise is required", domain.ErrBadRequest)
	}
	cat := in.Categorie
	if cat == "" {
		cat = "avancement"
	}
	p := model.Photo{
		ChantierID:   in.ChantierID,
		PhaseID:      in.PhaseID,
		TacheID:      in.TacheID,
		RapportID:    in.RapportID,
		PriseParID:   auth.UserID,
		DatePrise:    in.DatePrise,
		Legende:      in.Legende,
		Categorie:    cat,
		UrlOriginale: in.UrlOriginale,
		UrlThumbnail: in.UrlThumbnail,
	}
	created, err := uc.repo.CreatePhoto(ctx, auth, p)
	if err != nil {
		uc.log.Error("document.CreatePhoto: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// DeletePhoto — supprime une photo.
func (uc *Usecase) DeletePhoto(ctx context.Context, auth *database.AuthUser, id string) error {
	if auth == nil {
		return domain.ErrUnauthorized
	}
	if id == "" {
		return domain.ErrBadRequest
	}
	if err := uc.repo.DeletePhoto(ctx, auth, id); err != nil {
		uc.log.Error("document.DeletePhoto: repo", "err", err, "id", id)
		return domain.ErrInternal
	}
	return nil
}

// ── Rapports ───────────────────────────────────────────────────

// ListRapports — liste paginée des rapports journaliers.
func (uc *Usecase) ListRapports(ctx context.Context, auth *database.AuthUser, in RapportListInput) ([]model.RapportJournalier, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListRapports(ctx, auth, in)
	if err != nil {
		uc.log.Error("document.ListRapports", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// GetRapport — détail d'un rapport avec Photos pré-loadées.
func (uc *Usecase) GetRapport(ctx context.Context, auth *database.AuthUser, id string) (*model.RapportJournalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	rp, err := uc.repo.GetRapportByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("document.GetRapport", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if rp == nil {
		return nil, domain.ErrNotFound
	}
	return rp, nil
}

// CreateRapport — crée un rapport journalier. Force auteurId = auth.UserID.
func (uc *Usecase) CreateRapport(ctx context.Context, auth *database.AuthUser, in CreateRapportInput) (*model.RapportJournalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.ChantierID == "" {
		return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
	}
	if in.DateRapport.IsZero() {
		return nil, fmt.Errorf("%w: dateRapport is required", domain.ErrBadRequest)
	}
	if in.TravauxRealises == "" {
		return nil, fmt.Errorf("%w: travauxRealises is required", domain.ErrBadRequest)
	}
	rp := model.RapportJournalier{
		ChantierID:      in.ChantierID,
		AuteurID:        auth.UserID,
		DateRapport:     in.DateRapport,
		Meteo:           in.Meteo,
		EffectifPresent: in.EffectifPresent,
		TravauxRealises: in.TravauxRealises,
		Incidents:       in.Incidents,
		Observations:    in.Observations,
	}
	created, err := uc.repo.CreateRapport(ctx, auth, rp)
	if err != nil {
		uc.log.Error("document.CreateRapport: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// UpdateRapport — met à jour un rapport.
func (uc *Usecase) UpdateRapport(ctx context.Context, auth *database.AuthUser, id string, in UpdateRapportInput) (*model.RapportJournalier, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	updates := map[string]any{}
	if in.Meteo != nil {
		updates["meteo"] = *in.Meteo
	}
	if in.EffectifPresent != nil {
		updates["effectifPresent"] = *in.EffectifPresent
	}
	if in.TravauxRealises != nil {
		updates["travauxRealises"] = *in.TravauxRealises
	}
	if in.Incidents != nil {
		updates["incidents"] = *in.Incidents
	}
	if in.Observations != nil {
		updates["observations"] = *in.Observations
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetRapportByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("document.UpdateRapport: GetRapportByID", "err", err, "id", id)
			return nil, domain.ErrInternal
		}
		if existing == nil {
			return nil, domain.ErrNotFound
		}
		return existing, nil
	}
	updates["updatedAt"] = time.Now().UTC()
	updated, err := uc.repo.UpdateRapport(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("document.UpdateRapport: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}
