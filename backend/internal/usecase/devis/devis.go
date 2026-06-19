// Package devis — usecase pour les devis (Phase 4, commercial).
//
// Opérations :
//   - List    : liste paginée avec filtres (clientId, statut, search)
//   - Get     : détail avec Client + Lignes
//   - Create  : crée un devis (numero auto-genéré, lignes, calculs totals)
//   - Update  : met à jour un devis (statut, conditions, etc.) + recompute si nécessaire
//   - Delete  : supprime un devis (cascade lignes)
//   - AddLigne / UpdateLigne / DeleteLigne : gestion des lignes + recompute totals
//   - ChangeStatut : change le statut (BROUILLON→ENVOYE→ACCEPTE/REFUSE)
//
// Toutes les requêtes sont tenant-scoped via RLS.
// La table Devis est RLS-protected ; LigneDevis ne l'est pas (JOIN Devis).
//
// Calculs :
//   - ligne.totalHT = ligne.quantite × ligne.prixUnitaire
//   - totalHT (devis) = sum(lignes.totalHT)
//   - totalHTRemise = totalHT × (1 - remiseGlobale/100)
//   - montantTVA = totalHTRemise × tauxTVA/100
//   - totalTTC = totalHTRemise + montantTVA
package devis

import (
        "context"
        "fmt"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.DevisRepository.
type Repo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Devis, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Devis, error)
        CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error)
        Create(ctx context.Context, auth *database.AuthUser, d model.Devis) (*model.Devis, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Devis, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string) error

        // LigneDevis (RLS via JOIN Devis)
        GetLigneByID(ctx context.Context, auth *database.AuthUser, ligneID string) (*model.LigneDevis, error)
        CreateLigne(ctx context.Context, auth *database.AuthUser, l model.LigneDevis) (*model.LigneDevis, error)
        UpdateLigne(ctx context.Context, auth *database.AuthUser, ligneID string, updates map[string]any) (*model.LigneDevis, error)
        DeleteLigne(ctx context.Context, auth *database.AuthUser, ligneID string) error
        ListLignesByDevis(ctx context.Context, auth *database.AuthUser, devisID string) ([]model.LigneDevis, error)
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
        ClientID string
        Statut   string
        Search   string
        Page     int
        PageSize int
}

// LigneInput — input pour créer/modifier une ligne.
type LigneInput struct {
        Designation  string
        Description  *string
        Quantite     float64
        Unite        string
        PrixUnitaire float64
        Ordre        int
}

// UpdateLigneInput — input pour UpdateLigne (tous les champs optionnels).
type UpdateLigneInput struct {
        Designation  *string
        Description  *string
        Quantite     *float64
        Unite        *string
        PrixUnitaire *float64
        Ordre        *int
}

// CreateInput — payload pour Create.
type CreateInput struct {
        ClientID      string
        DateValidite  *time.Time
        Conditions    *string
        RemiseGlobale *float64
        TauxTVA       *float64
        Notes         *string
        Lignes        []LigneInput
}

// UpdateInput — payload pour Update.
type UpdateInput struct {
        DateValidite  *time.Time
        Conditions    *string
        RemiseGlobale *float64
        TauxTVA       *float64
        Notes         *string
        Statut        *string
}

// Usecase — cas d'usage pour les devis.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// computeTotals — calcul des totaux HT/TVA/TTC à partir des lignes + remise + tauxTVA.
func computeTotals(lignes []model.LigneDevis, remiseGlobale, tauxTVA float64) (totalHT, montantTVA, totalTTC float64) {
        var sum float64
        for i := range lignes {
                // Ligne.totalHT est censé être = quantite × prixUnitaire ; on le recompute par sécurité.
                lignes[i].TotalHT = lignes[i].Quantite * lignes[i].PrixUnitaire
                sum += lignes[i].TotalHT
        }
        totalHT = sum
        if remiseGlobale > 0 {
                totalHT = sum * (1 - remiseGlobale/100.0)
        }
        montantTVA = totalHT * tauxTVA / 100.0
        totalTTC = totalHT + montantTVA
        // Round to 2 decimals.
        totalHT = round2(totalHT)
        montantTVA = round2(montantTVA)
        totalTTC = round2(totalTTC)
        return
}

// round2 arrondit à 2 décimales (banker-safe via fmt + parse).
func round2(v float64) float64 {
        // Use Printf %.2f to round half-up.
        s := fmt.Sprintf("%.2f", v)
        var out float64
        fmt.Sscanf(s, "%f", &out)
        return out
}

// generateNumero — génère un numero de devis au format DEV-YYYY-NNN.
func (uc *Usecase) generateNumero(ctx context.Context, auth *database.AuthUser) (string, error) {
        year := time.Now().UTC().Year()
        count, err := uc.repo.CountByYear(ctx, auth, year)
        if err != nil {
                return "", err
        }
        return fmt.Sprintf("DEV-%d-%03d", year, count+1), nil
}

// List — liste paginée des devis.
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Devis, int64, error) {
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
                uc.log.Error("devis.List", "err", err, "auth_uid", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// Get — détail d'un devis avec Client + Lignes.
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        d, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("devis.Get: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if d == nil {
                return nil, domain.ErrNotFound
        }
        return d, nil
}

// Create — crée un devis avec numero auto + lignes + calculs totals.
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.ClientID == "" {
                return nil, fmt.Errorf("%w: clientId is required", domain.ErrBadRequest)
        }

        numero, err := uc.generateNumero(ctx, auth)
        if err != nil {
                uc.log.Error("devis.Create: generateNumero", "err", err)
                return nil, domain.ErrInternal
        }

        // Remise + tauxTVA avec defaults.
        remiseGlobale := 0.0
        if in.RemiseGlobale != nil {
                remiseGlobale = *in.RemiseGlobale
        }
        tauxTVA := 18.0
        if in.TauxTVA != nil {
                tauxTVA = *in.TauxTVA
        }

        // Construit les lignes avec totalHT calculé.
        lignes := make([]model.LigneDevis, 0, len(in.Lignes))
        for i, li := range in.Lignes {
                if li.Designation == "" {
                        return nil, fmt.Errorf("%w: ligne[%d].designation is required", domain.ErrBadRequest, i)
                }
                totalLigne := round2(li.Quantite * li.PrixUnitaire)
                lignes = append(lignes, model.LigneDevis{
                        Designation:  li.Designation,
                        Description:  li.Description,
                        Quantite:     li.Quantite,
                        Unite:        li.Unite,
                        PrixUnitaire: li.PrixUnitaire,
                        TotalHT:      totalLigne,
                        Ordre:        li.Ordre,
                })
        }

        // Compute totals.
        totalHT, montantTVA, totalTTC := computeTotals(lignes, remiseGlobale, tauxTVA)

        now := time.Now().UTC()
        d := model.Devis{
                Numero:       numero,
                ClientID:     in.ClientID,
                Statut:       "BROUILLON",
                DateEmission: now,
                DateValidite: in.DateValidite,
                Conditions:   in.Conditions,
                RemiseGlobale: remiseGlobale,
                TotalHT:      totalHT,
                TauxTVA:      tauxTVA,
                MontantTVA:   montantTVA,
                TotalTTC:     totalTTC,
                Notes:        in.Notes,
                Lignes:       lignes,
                EntrepriseID: &auth.EntrepriseID, // RLS WITH CHECK: must match current tenant
        }
        created, err := uc.repo.Create(ctx, auth, d)
        if err != nil {
                uc.log.Error("devis.Create: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// Update — met à jour un devis (dateValidite, conditions, remise, tauxTVA, notes, statut).
// Si remiseGlobale ou tauxTVA sont modifiés, on recompute les totals à partir des lignes existantes.
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("devis.Update: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }

        updates := map[string]any{}
        needRecompute := false
        newRemise := existing.RemiseGlobale
        newTaux := existing.TauxTVA
        if in.DateValidite != nil {
                updates["dateValidite"] = *in.DateValidite
        }
        if in.Conditions != nil {
                updates["conditions"] = *in.Conditions
        }
        if in.RemiseGlobale != nil {
                updates["remiseGlobale"] = *in.RemiseGlobale
                newRemise = *in.RemiseGlobale
                needRecompute = true
        }
        if in.TauxTVA != nil {
                updates["tauxTVA"] = *in.TauxTVA
                newTaux = *in.TauxTVA
                needRecompute = true
        }
        if in.Notes != nil {
                updates["notes"] = *in.Notes
        }
        if in.Statut != nil {
                updates["statut"] = *in.Statut
        }

        if needRecompute {
                lignes, err := uc.repo.ListLignesByDevis(ctx, auth, id)
                if err != nil {
                        uc.log.Error("devis.Update: ListLignesByDevis", "err", err, "id", id)
                        return nil, domain.ErrInternal
                }
                totalHT, montantTVA, totalTTC := computeTotals(lignes, newRemise, newTaux)
                updates["totalHT"] = totalHT
                updates["montantTVA"] = montantTVA
                updates["totalTTC"] = totalTTC
        }

        if len(updates) == 0 {
                return existing, nil
        }
        updates["updatedAt"] = time.Now().UTC()

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("devis.Update: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// Delete — supprime un devis (cascade lignes).
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return domain.ErrBadRequest
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("devis.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }
        if err := uc.repo.Delete(ctx, auth, id); err != nil {
                uc.log.Error("devis.Delete: repo", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// recomputeTotals — récupère les lignes, recalcule les totals et update le devis.
func (uc *Usecase) recomputeTotals(ctx context.Context, auth *database.AuthUser, devisID string) (*model.Devis, error) {
        d, err := uc.repo.GetByID(ctx, auth, devisID)
        if err != nil {
                return nil, err
        }
        if d == nil {
                return nil, domain.ErrNotFound
        }
        lignes, err := uc.repo.ListLignesByDevis(ctx, auth, devisID)
        if err != nil {
                return nil, err
        }
        totalHT, montantTVA, totalTTC := computeTotals(lignes, d.RemiseGlobale, d.TauxTVA)
        updates := map[string]any{
                "totalHT":    totalHT,
                "montantTVA": montantTVA,
                "totalTTC":   totalTTC,
                "updatedAt":  time.Now().UTC(),
        }
        updated, err := uc.repo.Update(ctx, auth, devisID, updates)
        if err != nil {
                return nil, err
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// AddLigne — ajoute une ligne au devis puis recompute les totals.
func (uc *Usecase) AddLigne(ctx context.Context, auth *database.AuthUser, devisID string, in LigneInput) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if devisID == "" {
                return nil, domain.ErrBadRequest
        }
        if in.Designation == "" {
                return nil, fmt.Errorf("%w: designation is required", domain.ErrBadRequest)
        }
        existing, err := uc.repo.GetByID(ctx, auth, devisID)
        if err != nil {
                uc.log.Error("devis.AddLigne: GetByID", "err", err, "id", devisID)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }

        totalLigne := round2(in.Quantite * in.PrixUnitaire)
        l := model.LigneDevis{
                DevisID:      devisID,
                Designation:  in.Designation,
                Description:  in.Description,
                Quantite:     in.Quantite,
                Unite:        in.Unite,
                PrixUnitaire: in.PrixUnitaire,
                TotalHT:      totalLigne,
                Ordre:        in.Ordre,
        }
        if _, err := uc.repo.CreateLigne(ctx, auth, l); err != nil {
                uc.log.Error("devis.AddLigne: CreateLigne", "err", err, "id", devisID)
                return nil, domain.ErrInternal
        }
        // Recompute totals.
        updated, err := uc.recomputeTotals(ctx, auth, devisID)
        if err != nil {
                uc.log.Error("devis.AddLigne: recomputeTotals", "err", err, "id", devisID)
                return nil, domain.ErrInternal
        }
        return updated, nil
}

// UpdateLigne — met à jour une ligne puis recompute les totals.
// Tous les champs sont optionnels (nil = pas de changement).
func (uc *Usecase) UpdateLigne(ctx context.Context, auth *database.AuthUser, devisID, ligneID string, in UpdateLigneInput) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if devisID == "" || ligneID == "" {
                return nil, domain.ErrBadRequest
        }
        l, err := uc.repo.GetLigneByID(ctx, auth, ligneID)
        if err != nil {
                uc.log.Error("devis.UpdateLigne: GetLigneByID", "err", err, "id", ligneID)
                return nil, domain.ErrInternal
        }
        if l == nil {
                return nil, domain.ErrNotFound
        }
        if l.DevisID != devisID {
                return nil, domain.ErrBadRequest
        }

        // Merge avec valeurs existantes pour recompute totalHT si quantite/prixUnitaire changent.
        newQuantite := l.Quantite
        newPrixUnitaire := l.PrixUnitaire

        updates := map[string]any{}
        if in.Designation != nil {
                updates["designation"] = *in.Designation
        }
        if in.Description != nil {
                updates["description"] = *in.Description
        }
        if in.Quantite != nil {
                updates["quantite"] = *in.Quantite
                newQuantite = *in.Quantite
        }
        if in.Unite != nil {
                updates["unite"] = *in.Unite
        }
        if in.PrixUnitaire != nil {
                updates["prixUnitaire"] = *in.PrixUnitaire
                newPrixUnitaire = *in.PrixUnitaire
        }
        if in.Ordre != nil {
                updates["ordre"] = *in.Ordre
        }

        // Recompute totalHT si quantite ou prixUnitaire ont changé.
        if in.Quantite != nil || in.PrixUnitaire != nil {
                updates["totalHT"] = round2(newQuantite * newPrixUnitaire)
        }

        if len(updates) == 0 {
                // Rien à mettre à jour, on retourne juste le devis.
                return uc.Get(ctx, auth, devisID)
        }

        if _, err := uc.repo.UpdateLigne(ctx, auth, ligneID, updates); err != nil {
                uc.log.Error("devis.UpdateLigne: UpdateLigne", "err", err, "id", ligneID)
                return nil, domain.ErrInternal
        }
        updated, err := uc.recomputeTotals(ctx, auth, devisID)
        if err != nil {
                uc.log.Error("devis.UpdateLigne: recomputeTotals", "err", err, "id", devisID)
                return nil, domain.ErrInternal
        }
        return updated, nil
}

// DeleteLigne — supprime une ligne puis recompute les totals.
func (uc *Usecase) DeleteLigne(ctx context.Context, auth *database.AuthUser, devisID, ligneID string) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if devisID == "" || ligneID == "" {
                return nil, domain.ErrBadRequest
        }
        l, err := uc.repo.GetLigneByID(ctx, auth, ligneID)
        if err != nil {
                uc.log.Error("devis.DeleteLigne: GetLigneByID", "err", err, "id", ligneID)
                return nil, domain.ErrInternal
        }
        if l == nil {
                return nil, domain.ErrNotFound
        }
        if l.DevisID != devisID {
                return nil, domain.ErrBadRequest
        }
        if err := uc.repo.DeleteLigne(ctx, auth, ligneID); err != nil {
                uc.log.Error("devis.DeleteLigne: DeleteLigne", "err", err, "id", ligneID)
                return nil, domain.ErrInternal
        }
        updated, err := uc.recomputeTotals(ctx, auth, devisID)
        if err != nil {
                uc.log.Error("devis.DeleteLigne: recomputeTotals", "err", err, "id", devisID)
                return nil, domain.ErrInternal
        }
        return updated, nil
}

// ChangeStatut — change le statut du devis.
// Validations : BROUILLON→ENVOYE→ACCEPTE/REFUSE (les autres transitions sont flexibles ici).
func (uc *Usecase) ChangeStatut(ctx context.Context, auth *database.AuthUser, id, statut string) (*model.Devis, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" || statut == "" {
                return nil, domain.ErrBadRequest
        }
        // Validation du statut.
        validStatuts := map[string]struct{}{
                "BROUILLON": {}, "ENVOYE": {}, "ACCEPTE": {}, "REFUSE": {}, "EXPIRE": {},
        }
        if _, ok := validStatuts[statut]; !ok {
                return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, statut)
        }
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("devis.ChangeStatut: GetByID", "err", err, "id", id)
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
                uc.log.Error("devis.ChangeStatut: Update", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}
