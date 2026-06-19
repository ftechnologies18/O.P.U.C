// Package support — usecase pour les tickets de support et leurs messages
// (Phase 5, peripheral endpoints).
//
// Opérations :
//   - List    : liste paginée avec filtres (statut, priorite, categorie, clientId,
//     assigneAId, search sur titre)
//   - Get     : détail avec Messages pré-loadés
//   - Create  : crée un ticket (RLS WITH CHECK → force EntrepriseID). Statut = OUVERT.
//   - Update  : met à jour un ticket (titre, description, priorite, categorie, assigneAId)
//   - ChangeStatut : change statut. Si RESOLU/FERME, set resoluLe=now + resoluParId=auth.UserID.
//   - ListMessages / CreateMessage : gestion des messages
//   - Stats   : agrégats (total, byStatut, byPriorite, byCategorie, openCount, resolvedCount)
//
// Toutes les requêtes sont tenant-scoped via RLS. La table TicketSupport est
// RLS-protected (policy tenant_isolation sur entrepriseId). La table
// TicketMessage n'a pas de RLS direct : filtrage via JOIN sur "TicketSupport".
package support

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Statuts valides pour un ticket.
const (
	StatutOuvert   = "OUVERT"
	StatutEnCours  = "EN_COURS"
	StatutResolu   = "RESOLU"
	StatutFerme    = "FERME"
)

// validStatuts est la liste blanche des statuts autorisés.
var validStatuts = map[string]struct{}{
	StatutOuvert:  {},
	StatutEnCours: {},
	StatutResolu:  {},
	StatutFerme:   {},
}

// columns autorisées pour CountByColumn (protection anti-injection SQL).
var allowedStatColumns = map[string]bool{
	"statut":   true,
	"priorite": true,
	"categorie": true,
}

// Repo — interface définie côté usecase. Implémentée par gorm.SupportRepository.
type Repo interface {
	List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.TicketSupport, int64, error)
	GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.TicketSupport, error)
	Create(ctx context.Context, auth *database.AuthUser, t model.TicketSupport) (*model.TicketSupport, error)
	Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.TicketSupport, error)

	ListMessagesByTicket(ctx context.Context, auth *database.AuthUser, ticketID string) ([]model.TicketMessage, error)
	CreateMessage(ctx context.Context, auth *database.AuthUser, m model.TicketMessage) (*model.TicketMessage, error)

	// Stats
	CountByColumn(ctx context.Context, auth *database.AuthUser, column string) (map[string]int64, error)
	CountTotal(ctx context.Context, auth *database.AuthUser) (int64, error)
	CountByStatutIn(ctx context.Context, auth *database.AuthUser, statuts []string) (int64, error)
}

// ListInput — critères de filtrage pour List (TicketSupport).
type ListInput struct {
	Statut     string
	Priorite   string
	Categorie  string
	ClientID   string
	AssigneAID string
	Search     string
	Page       int
	PageSize   int
}

// CreateInput — payload pour Create (TicketSupport).
type CreateInput struct {
	Titre       string
	Description string
	Priorite    string
	Categorie   *string
	ClientID    *string
}

// UpdateInput — payload pour Update (TicketSupport). Tous optionnels.
type UpdateInput struct {
	Titre       *string
	Description *string
	Priorite    *string
	Categorie   *string
	AssigneAID  *string
}

// CreateMessageInput — payload pour CreateMessage.
type CreateMessageInput struct {
	TicketID    string
	Contenu     string
	PieceJointe *string
}

// Stats — agrégats tickets de support.
type Stats struct {
	Total         int64            `json:"total"`
	ByStatut      map[string]int64 `json:"byStatut"`
	ByPriorite    map[string]int64 `json:"byPriorite"`
	ByCategorie   map[string]int64 `json:"byCategorie"`
	OpenCount     int64            `json:"openCount"`
	ResolvedCount int64            `json:"resolvedCount"`
}

// Usecase — cas d'usage pour les tickets de support.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// List — liste paginée des tickets.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.TicketSupport, int64, error) {
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
		uc.log.Error("support.List", "err", err, "auth_uid", auth.UserID)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// Get — détail d'un ticket avec Messages pré-loadés.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.TicketSupport, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	t, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("support.Get: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if t == nil {
		return nil, domain.ErrNotFound
	}
	return t, nil
}

// Create — crée un ticket. Force EntrepriseID = auth.EntrepriseID (RLS WITH CHECK).
// Statut par défaut : OUVERT.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.TicketSupport, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.Titre == "" || in.Description == "" {
		return nil, fmt.Errorf("%w: titre and description are required", domain.ErrBadRequest)
	}
	prio := in.Priorite
	if prio == "" {
		prio = "MOYENNE"
	}
	t := model.TicketSupport{
		Titre:        in.Titre,
		Description:  in.Description,
		Priorite:     prio,
		Statut:       StatutOuvert,
		Categorie:    in.Categorie,
		ClientID:     in.ClientID,
		EntrepriseID: &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
	}
	created, err := uc.repo.Create(ctx, auth, t)
	if err != nil {
		uc.log.Error("support.Create: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Update — met à jour un ticket (titre, description, priorite, categorie, assigneAId).
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.TicketSupport, error) {
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
	if in.Description != nil {
		updates["description"] = *in.Description
	}
	if in.Priorite != nil {
		updates["priorite"] = *in.Priorite
	}
	if in.Categorie != nil {
		updates["categorie"] = *in.Categorie
	}
	if in.AssigneAID != nil {
		updates["assigneAId"] = *in.AssigneAID
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("support.Update: GetByID", "err", err, "id", id)
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
		uc.log.Error("support.Update: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// ChangeStatut — change le statut d'un ticket.
// Si RESOLU ou FERME, set resoluLe=now + resoluParId=auth.UserID.
func (uc *Usecase) ChangeStatut(ctx context.Context, auth *database.AuthUser, id, statut string) (*model.TicketSupport, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}
	if _, ok := validStatuts[statut]; !ok {
		return nil, fmt.Errorf("%w: invalid statut %q (allowed: OUVERT, EN_COURS, RESOLU, FERME)", domain.ErrBadRequest, statut)
	}
	// Vérifie que le ticket existe (RLS)
	existing, err := uc.repo.GetByID(ctx, auth, id)
	if err != nil {
		uc.log.Error("support.ChangeStatut: GetByID", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if existing == nil {
		return nil, domain.ErrNotFound
	}
	updates := map[string]any{
		"statut":    statut,
		"updatedAt": time.Now().UTC(),
	}
	if statut == StatutResolu || statut == StatutFerme {
		now := time.Now().UTC()
		updates["resoluLe"] = &now
		uid := auth.UserID
		updates["resoluParId"] = &uid
	}
	updated, err := uc.repo.Update(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("support.ChangeStatut: Update", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// ListMessages — tous les messages d'un ticket.
func (uc *Usecase) ListMessages(ctx context.Context, auth *database.AuthUser, ticketID string) ([]model.TicketMessage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if ticketID == "" {
		return nil, domain.ErrBadRequest
	}
	// Vérifie que le ticket existe (RLS)
	t, err := uc.repo.GetByID(ctx, auth, ticketID)
	if err != nil {
		uc.log.Error("support.ListMessages: GetByID", "err", err, "id", ticketID)
		return nil, domain.ErrInternal
	}
	if t == nil {
		return nil, domain.ErrNotFound
	}
	items, err := uc.repo.ListMessagesByTicket(ctx, auth, ticketID)
	if err != nil {
		uc.log.Error("support.ListMessages: repo", "err", err, "id", ticketID)
		return nil, domain.ErrInternal
	}
	return items, nil
}

// CreateMessage — ajoute un message à un ticket. Force auteurId = auth.UserID.
func (uc *Usecase) CreateMessage(ctx context.Context, auth *database.AuthUser, in CreateMessageInput) (*model.TicketMessage, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.TicketID == "" {
		return nil, fmt.Errorf("%w: ticketId is required", domain.ErrBadRequest)
	}
	if in.Contenu == "" {
		return nil, fmt.Errorf("%w: contenu is required", domain.ErrBadRequest)
	}
	// Vérifie que le ticket existe (RLS)
	t, err := uc.repo.GetByID(ctx, auth, in.TicketID)
	if err != nil {
		uc.log.Error("support.CreateMessage: GetByID", "err", err, "id", in.TicketID)
		return nil, domain.ErrInternal
	}
	if t == nil {
		return nil, domain.ErrNotFound
	}
	uid := auth.UserID
	m := model.TicketMessage{
		TicketID:    in.TicketID,
		AuteurID:    &uid,
		Contenu:     in.Contenu,
		PieceJointe: in.PieceJointe,
	}
	created, err := uc.repo.CreateMessage(ctx, auth, m)
	if err != nil {
		uc.log.Error("support.CreateMessage: repo", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// Stats — agrégats tickets de support.
func (uc *Usecase) Stats(ctx context.Context, auth *database.AuthUser) (*Stats, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	total, err := uc.repo.CountTotal(ctx, auth)
	if err != nil {
		uc.log.Error("support.Stats: CountTotal", "err", err)
		return nil, domain.ErrInternal
	}
	byStatut, err := uc.repo.CountByColumn(ctx, auth, "statut")
	if err != nil {
		uc.log.Error("support.Stats: CountByColumn(statut)", "err", err)
		return nil, domain.ErrInternal
	}
	byPriorite, err := uc.repo.CountByColumn(ctx, auth, "priorite")
	if err != nil {
		uc.log.Error("support.Stats: CountByColumn(priorite)", "err", err)
		return nil, domain.ErrInternal
	}
	byCategorie, err := uc.repo.CountByColumn(ctx, auth, "categorie")
	if err != nil {
		uc.log.Error("support.Stats: CountByColumn(categorie)", "err", err)
		return nil, domain.ErrInternal
	}
	openCount, err := uc.repo.CountByStatutIn(ctx, auth, []string{StatutOuvert, StatutEnCours})
	if err != nil {
		uc.log.Error("support.Stats: CountByStatutIn(open)", "err", err)
		return nil, domain.ErrInternal
	}
	resolvedCount, err := uc.repo.CountByStatutIn(ctx, auth, []string{StatutResolu, StatutFerme})
	if err != nil {
		uc.log.Error("support.Stats: CountByStatutIn(resolved)", "err", err)
		return nil, domain.ErrInternal
	}
	return &Stats{
		Total:         total,
		ByStatut:      byStatut,
		ByPriorite:    byPriorite,
		ByCategorie:   byCategorie,
		OpenCount:     openCount,
		ResolvedCount: resolvedCount,
	}, nil
}

// IsAllowedStatColumn — exported helper for tests/validation.
// Returns true if the column name is in the safe list for CountByColumn.
func IsAllowedStatColumn(col string) bool {
	return allowedStatColumns[col]
}
