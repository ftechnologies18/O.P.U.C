// Package client — usecase pour les clients (Phase 4, commercial).
//
// Opérations :
//   - List    : liste paginée avec filtres (type, statut, search)
//   - Get     : détail avec compteurs (chantiers, devis, factures)
//   - Create  : crée un client
//   - Update  : met à jour un client (tous champs optionnels)
//   - Delete  : supprime un client (409 si devis/contrats/factures liés)
//   - Stats   : agrégats (total, byType, byStatut, recentCount)
//
// Toutes les requêtes sont tenant-scoped via RLS (Row-Level Security).
// La table Client est RLS-protected (filtrage direct par entrepriseId).
package client

import (
        "context"
        "fmt"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.ClientRepository.
type Repo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Client, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Client, error)
        Create(ctx context.Context, auth *database.AuthUser, c model.Client) (*model.Client, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Client, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string) error

        // Counters (for detail view)
        CountChantiersByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error)
        CountDevisByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error)
        CountFacturesByClient(ctx context.Context, auth *database.AuthUser, clientID string) (int64, error)

        // Delete checks
        HasLinkedDevis(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error)
        HasLinkedContrats(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error)
        HasLinkedFactures(ctx context.Context, auth *database.AuthUser, clientID string) (bool, error)

        // Stats
        CountByType(ctx context.Context, auth *database.AuthUser) (map[string]int64, error)
        CountByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error)
        CountRecent(ctx context.Context, auth *database.AuthUser, days int) (int64, error)
        CountTotal(ctx context.Context, auth *database.AuthUser) (int64, error)
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
        Type     string
        Statut   string
        Search   string
        Page     int
        PageSize int
}

// CreateInput — payload pour Create.
type CreateInput struct {
        RaisonSociale string
        NomContact    *string
        Telephone     *string
        Email         *string
        Adresse       *string
        RCCM          *string
        NIF           *string
        Type          *string
        Statut        *string
        Notes         *string
}

// UpdateInput — payload pour Update (tous optionnels).
type UpdateInput struct {
        RaisonSociale *string
        NomContact    *string
        Telephone     *string
        Email         *string
        Adresse       *string
        RCCM          *string
        NIF           *string
        Type          *string
        Statut        *string
        Notes         *string
}

// Detail — détail d'un client avec compteurs.
type Detail struct {
        model.Client
        ChantiersCount int64 `json:"chantiersCount"`
        DevisCount     int64 `json:"devisCount"`
        FacturesCount  int64 `json:"facturesCount"`
}

// Stats — agrégats clients.
type Stats struct {
        Total       int64            `json:"total"`
        ByType      map[string]int64 `json:"byType"`
        ByStatut    map[string]int64 `json:"byStatut"`
        RecentCount int64            `json:"recentCount"`
}

// Usecase — cas d'usage pour les clients.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// List — liste paginée des clients.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Client, int64, error) {
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
                uc.log.Error("client.List", "err", err, "auth_uid", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// Get — détail d'un client avec compteurs.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*Detail, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        c, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Get: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if c == nil {
                return nil, domain.ErrNotFound
        }
        chantiersCount, err := uc.repo.CountChantiersByClient(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Get: CountChantiers", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        devisCount, err := uc.repo.CountDevisByClient(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Get: CountDevis", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        facturesCount, err := uc.repo.CountFacturesByClient(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Get: CountFactures", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        return &Detail{
                Client:         *c,
                ChantiersCount: chantiersCount,
                DevisCount:     devisCount,
                FacturesCount:  facturesCount,
        }, nil
}

// Create — crée un client.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Client, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.RaisonSociale == "" {
                return nil, fmt.Errorf("%w: raisonSociale is required", domain.ErrBadRequest)
        }
        c := model.Client{
                RaisonSociale: in.RaisonSociale,
                NomContact:    in.NomContact,
                Telephone:     in.Telephone,
                Email:         in.Email,
                Adresse:       in.Adresse,
                RCCM:          in.RCCM,
                NIF:           in.NIF,
                Notes:         in.Notes,
                EntrepriseID:  &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
        }
        if in.Type != nil && *in.Type != "" {
                c.Type = *in.Type
        } else {
                c.Type = "ENTREPRISE"
        }
        if in.Statut != nil && *in.Statut != "" {
                c.Statut = *in.Statut
        } else {
                c.Statut = "ACTIF"
        }
        created, err := uc.repo.Create(ctx, auth, c)
        if err != nil {
                uc.log.Error("client.Create: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// Update — met à jour un client (tous champs optionnels).
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Client, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        updates := map[string]any{}
        if in.RaisonSociale != nil {
                updates["raisonSociale"] = *in.RaisonSociale
        }
        if in.NomContact != nil {
                updates["nomContact"] = *in.NomContact
        }
        if in.Telephone != nil {
                updates["telephone"] = *in.Telephone
        }
        if in.Email != nil {
                updates["email"] = *in.Email
        }
        if in.Adresse != nil {
                updates["adresse"] = *in.Adresse
        }
        if in.RCCM != nil {
                updates["rccm"] = *in.RCCM
        }
        if in.NIF != nil {
                updates["nif"] = *in.NIF
        }
        if in.Type != nil {
                updates["type"] = *in.Type
        }
        if in.Statut != nil {
                updates["statut"] = *in.Statut
        }
        if in.Notes != nil {
                updates["notes"] = *in.Notes
        }
        if len(updates) == 0 {
                // No updates : just return the existing client.
                existing, err := uc.repo.GetByID(ctx, auth, id)
                if err != nil {
                        uc.log.Error("client.Update: GetByID", "err", err, "id", id)
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
                uc.log.Error("client.Update: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// Delete — supprime un client (409 si devis/contrats/factures liés).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }
        // Check linked resources
        hasDevis, err := uc.repo.HasLinkedDevis(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Delete: HasLinkedDevis", "err", err, "id", id)
                return domain.ErrInternal
        }
        if hasDevis {
                return fmt.Errorf("%w: client has linked devis", domain.ErrConflict)
        }
        hasContrats, err := uc.repo.HasLinkedContrats(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Delete: HasLinkedContrats", "err", err, "id", id)
                return domain.ErrInternal
        }
        if hasContrats {
                return fmt.Errorf("%w: client has linked contrats", domain.ErrConflict)
        }
        hasFactures, err := uc.repo.HasLinkedFactures(ctx, auth, id)
        if err != nil {
                uc.log.Error("client.Delete: HasLinkedFactures", "err", err, "id", id)
                return domain.ErrInternal
        }
        if hasFactures {
                return fmt.Errorf("%w: client has linked factures", domain.ErrConflict)
        }
        if err := uc.repo.Delete(ctx, auth, id); err != nil {
                uc.log.Error("client.Delete: repo", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// Stats — agrégats clients.
func (uc *Usecase) Stats(ctx context.Context, auth *database.AuthUser) (*Stats, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        total, err := uc.repo.CountTotal(ctx, auth)
        if err != nil {
                uc.log.Error("client.Stats: CountTotal", "err", err)
                return nil, domain.ErrInternal
        }
        byType, err := uc.repo.CountByType(ctx, auth)
        if err != nil {
                uc.log.Error("client.Stats: CountByType", "err", err)
                return nil, domain.ErrInternal
        }
        byStatut, err := uc.repo.CountByStatut(ctx, auth)
        if err != nil {
                uc.log.Error("client.Stats: CountByStatut", "err", err)
                return nil, domain.ErrInternal
        }
        recent, err := uc.repo.CountRecent(ctx, auth, 30)
        if err != nil {
                uc.log.Error("client.Stats: CountRecent", "err", err)
                return nil, domain.ErrInternal
        }
        return &Stats{
                Total:       total,
                ByType:      byType,
                ByStatut:    byStatut,
                RecentCount: recent,
        }, nil
}
