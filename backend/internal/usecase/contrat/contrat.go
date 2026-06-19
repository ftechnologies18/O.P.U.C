// Package contrat — usecase pour les contrats (Phase 4, commercial).
//
// Opérations :
//   - List    : liste paginée avec filtres (clientId, statut, typeContrat, search)
//   - Get     : détail avec Client + Factures
//   - Create  : crée un contrat (numero auto, calcul montantTTC)
//   - Update  : met à jour un contrat (objet, typeContrat, montantHT, tauxTVA, etc.)
//   - Delete  : supprime un contrat (409 si factures liées)
//   - ChangeStatut : change le statut (EN_PREPARATION→ACTIF→TERMINE/RESILIE)
//
// Toutes les requêtes sont tenant-scoped via RLS.
// La table Contrat est RLS-protected (filtrage direct par entrepriseId).
//
// Calcul : montantTTC = montantHT × (1 + tauxTVA/100)
package contrat

import (
        "context"
        "fmt"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.ContratRepository.
type Repo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Contrat, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Contrat, error)
        CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error)
        Create(ctx context.Context, auth *database.AuthUser, c model.Contrat) (*model.Contrat, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Contrat, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string) error
        HasLinkedFactures(ctx context.Context, auth *database.AuthUser, contratID string) (bool, error)
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
        ClientID    string
        Statut      string
        TypeContrat string
        Search      string
        Page        int
        PageSize    int
}

// CreateInput — payload pour Create.
type CreateInput struct {
        ClientID      string
        Objet         string
        TypeContrat   *string
        MontantHT     float64
        TauxTVA       *float64
        DateDebut     *time.Time
        DateFin       *time.Time
        Conditions    *string
        PenaltyRetard *float64
}

// UpdateInput — payload pour Update.
type UpdateInput struct {
        Objet         *string
        TypeContrat   *string
        MontantHT     *float64
        TauxTVA       *float64
        DateDebut     *time.Time
        DateFin       *time.Time
        Conditions    *string
        PenaltyRetard *float64
}

// Usecase — cas d'usage pour les contrats.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// round2 arrondit à 2 décimales.
func round2(v float64) float64 {
        s := fmt.Sprintf("%.2f", v)
        var out float64
        fmt.Sscanf(s, "%f", &out)
        return out
}

// computeMontantTTC = montantHT × (1 + tauxTVA/100)
func computeMontantTTC(montantHT, tauxTVA float64) float64 {
        return round2(montantHT * (1 + tauxTVA/100.0))
}

// generateNumero — génère un numero de contrat au format CON-YYYY-NNN.
func (uc *Usecase) generateNumero(ctx context.Context, auth *database.AuthUser) (string, error) {
        year := time.Now().UTC().Year()
        count, err := uc.repo.CountByYear(ctx, auth, year)
        if err != nil {
                return "", err
        }
        return fmt.Sprintf("CON-%d-%03d", year, count+1), nil
}

// List — liste paginée des contrats.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Contrat, int64, error) {
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
                uc.log.Error("contrat.List", "err", err, "auth_uid", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// Get — détail d'un contrat avec Client + Factures.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.Contrat, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        c, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("contrat.Get: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if c == nil {
                return nil, domain.ErrNotFound
        }
        return c, nil
}

// Create — crée un contrat avec numero auto + calcul montantTTC.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Contrat, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.ClientID == "" {
                return nil, fmt.Errorf("%w: clientId is required", domain.ErrBadRequest)
        }
        if in.Objet == "" {
                return nil, fmt.Errorf("%w: objet is required", domain.ErrBadRequest)
        }
        numero, err := uc.generateNumero(ctx, auth)
        if err != nil {
                uc.log.Error("contrat.Create: generateNumero", "err", err)
                return nil, domain.ErrInternal
        }

        typeContrat := "TRAVAUX"
        if in.TypeContrat != nil && *in.TypeContrat != "" {
                typeContrat = *in.TypeContrat
        }
        tauxTVA := 18.0
        if in.TauxTVA != nil {
                tauxTVA = *in.TauxTVA
        }
        penaltyRetard := 0.0
        if in.PenaltyRetard != nil {
                penaltyRetard = *in.PenaltyRetard
        }
        montantTTC := computeMontantTTC(in.MontantHT, tauxTVA)

        c := model.Contrat{
                Numero:        numero,
                ClientID:      in.ClientID,
                Objet:         in.Objet,
                TypeContrat:   typeContrat,
                MontantHT:     in.MontantHT,
                TauxTVA:       tauxTVA,
                MontantTTC:    montantTTC,
                DateDebut:     in.DateDebut,
                DateFin:       in.DateFin,
                Conditions:    in.Conditions,
                Statut:        "EN_PREPARATION",
                PenaltyRetard: penaltyRetard,
                EntrepriseID:  &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
        }
        created, err := uc.repo.Create(ctx, auth, c)
        if err != nil {
                uc.log.Error("contrat.Create: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// Update — met à jour un contrat + recompute montantTTC si montantHT/tauxTVA changent.
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Contrat, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("contrat.Update: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }

        updates := map[string]any{}
        needRecompute := false
        newMontantHT := existing.MontantHT
        newTauxTVA := existing.TauxTVA
        if in.Objet != nil {
                updates["objet"] = *in.Objet
        }
        if in.TypeContrat != nil {
                updates["typeContrat"] = *in.TypeContrat
        }
        if in.MontantHT != nil {
                updates["montantHT"] = *in.MontantHT
                newMontantHT = *in.MontantHT
                needRecompute = true
        }
        if in.TauxTVA != nil {
                updates["tauxTVA"] = *in.TauxTVA
                newTauxTVA = *in.TauxTVA
                needRecompute = true
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
        if in.PenaltyRetard != nil {
                updates["penaltyRetard"] = *in.PenaltyRetard
        }

        if needRecompute {
                updates["montantTTC"] = computeMontantTTC(newMontantHT, newTauxTVA)
        }
        if len(updates) == 0 {
                return existing, nil
        }
        updates["updatedAt"] = time.Now().UTC()

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("contrat.Update: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// Delete — supprime un contrat (409 si factures liées).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("contrat.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }
        hasFactures, err := uc.repo.HasLinkedFactures(ctx, auth, id)
        if err != nil {
                uc.log.Error("contrat.Delete: HasLinkedFactures", "err", err, "id", id)
                return domain.ErrInternal
        }
        if hasFactures {
                return fmt.Errorf("%w: contrat has linked factures", domain.ErrConflict)
        }
        if err := uc.repo.Delete(ctx, auth, id); err != nil {
                uc.log.Error("contrat.Delete: repo", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// ChangeStatut — change le statut du contrat.
func (uc *Usecase) ChangeStatut(ctx context.Context, auth *database.AuthUser, id, statut string) (*model.Contrat, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" || statut == "" {
                return nil, domain.ErrBadRequest
        }
        validStatuts := map[string]struct{}{
                "EN_PREPARATION": {}, "ACTIF": {}, "EXPIRE": {}, "RESILIE": {}, "TERMINE": {},
        }
        if _, ok := validStatuts[statut]; !ok {
                return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, statut)
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("contrat.ChangeStatut: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }
        updates := map[string]any{
                "statut":    statut,
                "updatedAt": time.Now().UTC(),
        }
        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("contrat.ChangeStatut: Update", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}
