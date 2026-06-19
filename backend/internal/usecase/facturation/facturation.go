// Package facturation — usecase pour les factures + paiements (Phase 4, commercial).
//
// Opérations :
//   - List    : liste paginée avec filtres (clientId, contratId, statut, typeFacture, search)
//   - Get     : détail avec Client + Contrat + Paiements
//   - Create  : crée une facture (numero auto, calculs montantTVA + totalTTC)
//   - Update  : met à jour une facture (dateEcheance, notes, modePaiement)
//   - Delete  : supprime une facture (409 si paiements liés)
//   - ChangeStatut : change le statut
//   - ListPaiements / CreatePaiement : gestion des paiements + update montantPaye/statut
//   - Stats : agrégats (total, byStatut, totalTTC, totalPaye, totalImpaye, enRetardCount)
//
// Tables :
//   - Facture (RLS-protected, filtrage direct via WithTenant)
//   - PaiementFacture (PAS de RLS direct, filtrage via JOIN sur "Facture")
//
// Calculs :
//   - montantTVA = montantHT × tauxTVA/100
//   - totalTTC = montantHT + montantTVA
//   - paiement update : montantPaye += paiement.montant ;
//     si montantPaye >= totalTTC → statut=PAYEE, datePaiement=now ;
//     sinon si montantPaye > 0 → statut=PARTIELLEMENT_PAYEE
package facturation

import (
        "context"
        "fmt"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.FacturationRepository.
type Repo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Facture, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Facture, error)
        CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error)
        Create(ctx context.Context, auth *database.AuthUser, f model.Facture) (*model.Facture, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Facture, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string) error
        HasPaiements(ctx context.Context, auth *database.AuthUser, factureID string) (bool, error)

        // PaiementFacture (RLS via JOIN Facture)
        ListPaiements(ctx context.Context, auth *database.AuthUser, factureID string) ([]model.PaiementFacture, error)
        CreatePaiement(ctx context.Context, auth *database.AuthUser, p model.PaiementFacture) (*model.PaiementFacture, error)
        SumPaiementsByFacture(ctx context.Context, auth *database.AuthUser, factureID string) (float64, error)

        // Stats
        Stats(ctx context.Context, auth *database.AuthUser) (*Stats, error)
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
        ClientID    string
        ContratID   string
        Statut      string
        TypeFacture string
        Search      string
        Page        int
        PageSize    int
}

// CreateInput — payload pour Create.
type CreateInput struct {
        ClientID     string
        ContratID    *string
        DevisID      *string
        TypeFacture  *string
        MontantHT    float64
        TauxTVA      *float64
        DateEcheance *time.Time
        Notes        *string
}

// UpdateInput — payload pour Update.
type UpdateInput struct {
        DateEcheance *time.Time
        Notes        *string
        ModePaiement *string
}

// PaiementInput — payload pour CreatePaiement.
type PaiementInput struct {
        Montant      float64
        DatePaiement time.Time
        ModePaiement string
        Reference    *string
        Notes        *string
}

// Stats — agrégats de facturation.
type Stats struct {
        Total         int64            `json:"total"`
        ByStatut      map[string]int64 `json:"byStatut"`
        TotalTTC      float64          `json:"totalTTC"`
        TotalPaye     float64          `json:"totalPaye"`
        TotalImpaye   float64          `json:"totalImpaye"`
        EnRetardCount int64            `json:"enRetardCount"`
}

// Usecase — cas d'usage pour la facturation.
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

// generateNumero — génère un numero de facture au format FAC-YYYY-NNN.
func (uc *Usecase) generateNumero(ctx context.Context, auth *database.AuthUser) (string, error) {
        year := time.Now().UTC().Year()
        count, err := uc.repo.CountByYear(ctx, auth, year)
        if err != nil {
                return "", err
        }
        return fmt.Sprintf("FAC-%d-%03d", year, count+1), nil
}

// List — liste paginée des factures.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Facture, int64, error) {
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
                uc.log.Error("facturation.List", "err", err, "auth_uid", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// Get — détail d'une facture avec Client + Contrat + Paiements.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.Facture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        f, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("facturation.Get: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if f == nil {
                return nil, domain.ErrNotFound
        }
        return f, nil
}

// Create — crée une facture avec numero auto + calculs montantTVA + totalTTC.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Facture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.ClientID == "" {
                return nil, fmt.Errorf("%w: clientId is required", domain.ErrBadRequest)
        }
        numero, err := uc.generateNumero(ctx, auth)
        if err != nil {
                uc.log.Error("facturation.Create: generateNumero", "err", err)
                return nil, domain.ErrInternal
        }

        typeFacture := "FACTURE"
        if in.TypeFacture != nil && *in.TypeFacture != "" {
                typeFacture = *in.TypeFacture
        }
        tauxTVA := 18.0
        if in.TauxTVA != nil {
                tauxTVA = *in.TauxTVA
        }
        montantTVA := round2(in.MontantHT * tauxTVA / 100.0)
        totalTTC := round2(in.MontantHT + montantTVA)

        now := time.Now().UTC()
        f := model.Facture{
                Numero:       numero,
                ClientID:     in.ClientID,
                ContratID:    in.ContratID,
                DevisID:      in.DevisID,
                TypeFacture:  typeFacture,
                Statut:       "BROUILLON",
                DateEmission: now,
                DateEcheance: in.DateEcheance,
                MontantHT:    in.MontantHT,
                TauxTVA:      tauxTVA,
                MontantTVA:   montantTVA,
                TotalTTC:     totalTTC,
                Notes:        in.Notes,
                EntrepriseID: &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
        }
        created, err := uc.repo.Create(ctx, auth, f)
        if err != nil {
                uc.log.Error("facturation.Create: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// Update — met à jour une facture (dateEcheance, notes, modePaiement).
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Facture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("facturation.Update: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }

        updates := map[string]any{}
        if in.DateEcheance != nil {
                updates["dateEcheance"] = *in.DateEcheance
        }
        if in.Notes != nil {
                updates["notes"] = *in.Notes
        }
        if in.ModePaiement != nil {
                updates["modePaiement"] = *in.ModePaiement
        }
        if len(updates) == 0 {
                return existing, nil
        }
        updates["updatedAt"] = time.Now().UTC()

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("facturation.Update: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// Delete — supprime une facture (409 si paiements liés).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("facturation.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }
        hasPaiements, err := uc.repo.HasPaiements(ctx, auth, id)
        if err != nil {
                uc.log.Error("facturation.Delete: HasPaiements", "err", err, "id", id)
                return domain.ErrInternal
        }
        if hasPaiements {
                return fmt.Errorf("%w: facture has linked paiements", domain.ErrConflict)
        }
        if err := uc.repo.Delete(ctx, auth, id); err != nil {
                uc.log.Error("facturation.Delete: repo", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// ChangeStatut — change le statut de la facture.
func (uc *Usecase) ChangeStatut(ctx context.Context, auth *database.AuthUser, id, statut string) (*model.Facture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" || statut == "" {
                return nil, domain.ErrBadRequest
        }
        validStatuts := map[string]struct{}{
                "BROUILLON": {}, "ENVOYE": {}, "PAYEE": {},
                "PARTIELLEMENT_PAYEE": {}, "ANNULEE": {}, "EN_RETARD": {},
        }
        if _, ok := validStatuts[statut]; !ok {
                return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, statut)
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("facturation.ChangeStatut: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }
        updates := map[string]any{
                "statut":    statut,
                "updatedAt": time.Now().UTC(),
        }
        // Si statut=PAYEE, on met aussi datePaiement=now si non déjà set.
        if statut == "PAYEE" && existing.DatePaiement == nil {
                now := time.Now().UTC()
                updates["datePaiement"] = now
        }
        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("facturation.ChangeStatut: Update", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// ListPaiements — liste les paiements d'une facture.
func (uc *Usecase) ListPaiements(ctx context.Context, auth *database.AuthUser, factureID string) ([]model.PaiementFacture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if factureID == "" {
                return nil, domain.ErrBadRequest
        }
        // Vérifie que la facture existe (et est accessible au tenant).
        f, err := uc.repo.GetByID(ctx, auth, factureID)
        if err != nil {
                uc.log.Error("facturation.ListPaiements: GetByID", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }
        if f == nil {
                return nil, domain.ErrNotFound
        }
        items, err := uc.repo.ListPaiements(ctx, auth, factureID)
        if err != nil {
                uc.log.Error("facturation.ListPaiements: ListPaiements", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// CreatePaiement — ajoute un paiement, update montantPaye + statut.
func (uc *Usecase) CreatePaiement(ctx context.Context, auth *database.AuthUser, factureID string, in PaiementInput) (*model.Facture, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if factureID == "" {
                return nil, domain.ErrBadRequest
        }
        if in.Montant <= 0 {
                return nil, fmt.Errorf("%w: montant must be > 0", domain.ErrBadRequest)
        }
        if in.DatePaiement.IsZero() {
                return nil, fmt.Errorf("%w: datePaiement is required", domain.ErrBadRequest)
        }
        if in.ModePaiement == "" {
                return nil, fmt.Errorf("%w: modePaiement is required", domain.ErrBadRequest)
        }
        validModes := map[string]struct{}{
                "ESPECES": {}, "VIREMENT": {}, "MOBILE_MONEY": {}, "CHEQUE": {},
        }
        if _, ok := validModes[in.ModePaiement]; !ok {
                return nil, fmt.Errorf("%w: invalid modePaiement %q", domain.ErrBadRequest, in.ModePaiement)
        }

        f, err := uc.repo.GetByID(ctx, auth, factureID)
        if err != nil {
                uc.log.Error("facturation.CreatePaiement: GetByID", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }
        if f == nil {
                return nil, domain.ErrNotFound
        }
        if f.Statut == "ANNULEE" {
                return nil, fmt.Errorf("%w: cannot add paiement to ANNULEE facture", domain.ErrBadRequest)
        }

        // Crée le paiement.
        p := model.PaiementFacture{
                FactureID:    factureID,
                Montant:      in.Montant,
                DatePaiement: in.DatePaiement,
                ModePaiement: in.ModePaiement,
                Reference:    in.Reference,
                Notes:        in.Notes,
        }
        if _, err := uc.repo.CreatePaiement(ctx, auth, p); err != nil {
                uc.log.Error("facturation.CreatePaiement: CreatePaiement", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }

        // Recompute montantPaye via SUM (évite les race conditions).
        totalPaye, err := uc.repo.SumPaiementsByFacture(ctx, auth, factureID)
        if err != nil {
                uc.log.Error("facturation.CreatePaiement: SumPaiements", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }
        totalPaye = round2(totalPaye)

        updates := map[string]any{
                "montantPaye": totalPaye,
                "updatedAt":   time.Now().UTC(),
        }
        // Détermine le statut en fonction du montant payé.
        if totalPaye >= f.TotalTTC {
                updates["statut"] = "PAYEE"
                now := time.Now().UTC()
                updates["datePaiement"] = now
                if f.ModePaiement == nil {
                        updates["modePaiement"] = in.ModePaiement
                }
        } else if totalPaye > 0 {
                updates["statut"] = "PARTIELLEMENT_PAYEE"
                if f.ModePaiement == nil {
                        updates["modePaiement"] = in.ModePaiement
                }
        }

        updated, err := uc.repo.Update(ctx, auth, factureID, updates)
        if err != nil {
                uc.log.Error("facturation.CreatePaiement: Update facture", "err", err, "id", factureID)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// Stats — agrégats de facturation.
func (uc *Usecase) Stats(ctx context.Context, auth *database.AuthUser) (*Stats, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        s, err := uc.repo.Stats(ctx, auth)
        if err != nil {
                uc.log.Error("facturation.Stats", "err", err)
                return nil, domain.ErrInternal
        }
        return s, nil
}
