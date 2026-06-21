// Package carburant — usecase pour la gestion du carburant (Phase 3, write métier).
//
// Sous-domaines : StockCarburant, EntreeCarburant, SortieCarburant,
// BonAchatCarburant, ReleveCompteurEngin.
//
// Toutes les requêtes sont tenant-scoped via RLS. Aucune des tables carburant
// n'a de RLS direct : filtrage via JOIN sur "Chantier" (RLS-protected) pour les
// tables avec chantierId.
//
// Calculs :
//   - quantiteDisponible (stock carburant) = sum(EntreeCarburant.quantite) - sum(SortieCarburant.quantite)
//   - prixTotal (entrees, achats) = quantite * prixUnitaire
package carburant

import (
        "context"
        "fmt"
        "log/slog"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.CarburantRepository.
type Repo interface {
        // StockCarburant
        ListStock(ctx context.Context, auth *database.AuthUser, chantierID, typeCarburant string) ([]model.StockCarburant, error)
        GetStockByID(ctx context.Context, auth *database.AuthUser, id string) (*model.StockCarburant, error)
        CreateStock(ctx context.Context, auth *database.AuthUser, s model.StockCarburant) (*model.StockCarburant, error)
        UpdateStock(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.StockCarburant, error)
        DeleteStock(ctx context.Context, auth *database.AuthUser, id string) error
        QuantitesDisponiblesStock(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error)
        QuantiteDisponibleStock(ctx context.Context, auth *database.AuthUser, stockID string) (float64, error)

        // EntreeCarburant
        ListEntrees(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID string) ([]model.EntreeCarburant, error)
        CreateEntree(ctx context.Context, auth *database.AuthUser, e model.EntreeCarburant) (*model.EntreeCarburant, error)

        // SortieCarburant
        ListSorties(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID, equipementID string) ([]model.SortieCarburant, error)
        CreateSortie(ctx context.Context, auth *database.AuthUser, s model.SortieCarburant) (*model.SortieCarburant, error)

        // BonAchatCarburant
        ListAchats(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.BonAchatCarburant, error)
        CreateAchat(ctx context.Context, auth *database.AuthUser, b model.BonAchatCarburant) (*model.BonAchatCarburant, error)

        // ReleveCompteurEngin
        ListReleves(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.ReleveCompteurEngin, error)
        CreateReleve(ctx context.Context, auth *database.AuthUser, r model.ReleveCompteurEngin) (*model.ReleveCompteurEngin, error)

        // Phase C — Delete methods for entrees/sorties/achats/releves
        DeleteEntree(ctx context.Context, auth *database.AuthUser, id string) error
        DeleteSortie(ctx context.Context, auth *database.AuthUser, id string) error
        DeleteAchat(ctx context.Context, auth *database.AuthUser, id string) error
        DeleteReleve(ctx context.Context, auth *database.AuthUser, id string) error

        // Stats
        SumEntreesByType(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error)
        SumSortiesByType(ctx context.Context, auth *database.AuthUser, stockIDs []string) (map[string]float64, error)
        SumEntreesQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error)
        SumSortiesQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error)
        SumAchatsQuantiteInMonth(ctx context.Context, auth *database.AuthUser, year, month int) (float64, error)
}

// CreateStockInput — payload pour CreateStock.
type CreateStockInput struct {
        ChantierID    string
        TypeCarburant string
        Capacite      float64
        SeuilAlerte   float64
}

// UpdateStockInput — payload pour UpdateStock.
type UpdateStockInput struct {
        Capacite    *float64
        SeuilAlerte *float64
}

// CreateEntreeInput — payload pour CreateEntree.
type CreateEntreeInput struct {
        StockCarburantID string
        ChantierID       string
        DateEntree       time.Time
        Quantite         float64
        PrixUnitaire     float64
        Fournisseur      *string
        NumeroBL         *string
}

// CreateSortieInput — payload pour CreateSortie.
type CreateSortieInput struct {
        StockCarburantID    string
        ChantierID          string
        EquipementID        *string
        DateSortie          time.Time
        Quantite            float64
        Operateur           *string
        CompteurHeuresAvant *float64
        CompteurHeuresApres *float64
}

// CreateAchatInput — payload pour CreateAchat.
type CreateAchatInput struct {
        ChantierID          string
        DateAchat           time.Time
        TypeCarburant       string
        Quantite            float64
        PrixUnitaire        float64
        StationService      *string
        NumeroRecu          *string
        EquipementID        *string
        Operateur           *string
        CompteurHeuresAvant *float64
        CompteurHeuresApres *float64
}

// CreateReleveInput — payload pour CreateReleve.
type CreateReleveInput struct {
        EquipementID string
        ChantierID   string
        DateReleve   time.Time
        HeuresKm     float64
        Observation  *string
}

// StockCarburantWithQuantite — stock + quantiteDisponible calculée.
type StockCarburantWithQuantite struct {
        model.StockCarburant
        QuantiteDisponible float64 `json:"quantiteDisponible"`
}

// Stats — agrégats pour /api/v1/carburant/stats.
type Stats struct {
        TotalStockByType  map[string]float64           `json:"totalStockByType"`
        TotalEntreesMonth float64                      `json:"totalEntreesMonth"`
        TotalSortiesMonth float64                      `json:"totalSortiesMonth"`
        TotalAchatsMonth  float64                      `json:"totalAchatsMonth"`
        Alerts            []StockCarburantWithQuantite `json:"alerts"`
        MonthLabel        string                       `json:"monthLabel"`
}

// Usecase — cas d'usage pour la gestion du carburant.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// ── StockCarburant ─────────────────────────────────────────────

// ListStock — liste des stocks carburant (avec quantiteDisponible).
func (uc *Usecase) ListStock(ctx context.Context, auth *database.AuthUser, chantierID, typeCarburant string) ([]StockCarburantWithQuantite, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        stocks, err := uc.repo.ListStock(ctx, auth, chantierID, typeCarburant)
        if err != nil {
                uc.log.Error("carburant.ListStock", "err", err)
                return nil, domain.ErrInternal
        }
        ids := make([]string, 0, len(stocks))
        for i := range stocks {
                ids = append(ids, stocks[i].ID)
        }
        quantites := make(map[string]float64, len(ids))
        if len(ids) > 0 {
                quantites, err = uc.repo.QuantitesDisponiblesStock(ctx, auth, ids)
                if err != nil {
                        uc.log.Error("carburant.ListStock: QuantitesDisponiblesStock", "err", err)
                        return nil, domain.ErrInternal
                }
        }
        out := make([]StockCarburantWithQuantite, 0, len(stocks))
        for i := range stocks {
                out = append(out, StockCarburantWithQuantite{
                        StockCarburant:     stocks[i],
                        QuantiteDisponible: quantites[stocks[i].ID],
                })
        }
        return out, nil
}

// GetStock — détail d'un stock carburant (avec quantiteDisponible).
func (uc *Usecase) GetStock(ctx context.Context, auth *database.AuthUser, id string) (*StockCarburantWithQuantite, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        s, err := uc.repo.GetStockByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("carburant.GetStock: GetStockByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if s == nil {
                return nil, domain.ErrNotFound
        }
        quantite, err := uc.repo.QuantiteDisponibleStock(ctx, auth, id)
        if err != nil {
                uc.log.Error("carburant.GetStock: QuantiteDisponibleStock", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        return &StockCarburantWithQuantite{
                StockCarburant:     *s,
                QuantiteDisponible: quantite,
        }, nil
}

// CreateStock — crée un stock carburant.
func (uc *Usecase) CreateStock(ctx context.Context, auth *database.AuthUser, in CreateStockInput) (*model.StockCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.ChantierID == "" {
                return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
        }
        if in.TypeCarburant == "" {
                in.TypeCarburant = "GASOIL"
        }
        s := model.StockCarburant{
                ChantierID:    in.ChantierID,
                TypeCarburant: in.TypeCarburant,
                Capacite:      in.Capacite,
                SeuilAlerte:   in.SeuilAlerte,
        }
        created, err := uc.repo.CreateStock(ctx, auth, s)
        if err != nil {
                uc.log.Error("carburant.CreateStock: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// UpdateStock — met à jour un stock carburant.
func (uc *Usecase) UpdateStock(ctx context.Context, auth *database.AuthUser, id string, in UpdateStockInput) (*model.StockCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        updates := map[string]any{}
        if in.Capacite != nil {
                updates["capacite"] = *in.Capacite
        }
        if in.SeuilAlerte != nil {
                updates["seuilAlerte"] = *in.SeuilAlerte
        }
        if len(updates) == 0 {
                existing, err := uc.repo.GetStockByID(ctx, auth, id)
                if err != nil {
                        uc.log.Error("carburant.UpdateStock: GetStockByID", "err", err, "id", id)
                        return nil, domain.ErrInternal
                }
                if existing == nil {
                        return nil, domain.ErrNotFound
                }
                return existing, nil
        }
        updates["updatedAt"] = time.Now().UTC()
        updated, err := uc.repo.UpdateStock(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("carburant.UpdateStock: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// DeleteStock — supprime un stock carburant.
func (uc *Usecase) DeleteStock(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return domain.ErrBadRequest
        }
        existing, err := uc.repo.GetStockByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("carburant.DeleteStock: GetStockByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }
        if err := uc.repo.DeleteStock(ctx, auth, id); err != nil {
                uc.log.Error("carburant.DeleteStock: repo", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// ── EntreeCarburant ────────────────────────────────────────────

// ListEntrees — liste des entrées de carburant.
func (uc *Usecase) ListEntrees(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID string) ([]model.EntreeCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        items, err := uc.repo.ListEntrees(ctx, auth, chantierID, stockCarburantID)
        if err != nil {
                uc.log.Error("carburant.ListEntrees", "err", err)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// CreateEntree — crée une entrée de carburant (prixTotal calculé).
func (uc *Usecase) CreateEntree(ctx context.Context, auth *database.AuthUser, in CreateEntreeInput) (*model.EntreeCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.StockCarburantID == "" || in.ChantierID == "" {
                return nil, fmt.Errorf("%w: stockCarburantId and chantierId are required", domain.ErrBadRequest)
        }
        if in.DateEntree.IsZero() {
                return nil, fmt.Errorf("%w: dateEntree is required", domain.ErrBadRequest)
        }
        e := model.EntreeCarburant{
                StockCarburantID: in.StockCarburantID,
                ChantierID:       in.ChantierID,
                DateEntree:       in.DateEntree,
                Quantite:         in.Quantite,
                PrixUnitaire:     in.PrixUnitaire,
                PrixTotal:        in.Quantite * in.PrixUnitaire,
                Fournisseur:      in.Fournisseur,
                NumeroBL:         in.NumeroBL,
        }
        created, err := uc.repo.CreateEntree(ctx, auth, e)
        if err != nil {
                uc.log.Error("carburant.CreateEntree: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// ── SortieCarburant ────────────────────────────────────────────

// ListSorties — liste des sorties de carburant.
func (uc *Usecase) ListSorties(ctx context.Context, auth *database.AuthUser, chantierID, stockCarburantID, equipementID string) ([]model.SortieCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        items, err := uc.repo.ListSorties(ctx, auth, chantierID, stockCarburantID, equipementID)
        if err != nil {
                uc.log.Error("carburant.ListSorties", "err", err)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// CreateSortie — crée une sortie de carburant.
func (uc *Usecase) CreateSortie(ctx context.Context, auth *database.AuthUser, in CreateSortieInput) (*model.SortieCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.StockCarburantID == "" || in.ChantierID == "" {
                return nil, fmt.Errorf("%w: stockCarburantId and chantierId are required", domain.ErrBadRequest)
        }
        if in.DateSortie.IsZero() {
                return nil, fmt.Errorf("%w: dateSortie is required", domain.ErrBadRequest)
        }
        s := model.SortieCarburant{
                StockCarburantID:    in.StockCarburantID,
                ChantierID:          in.ChantierID,
                EquipementID:        in.EquipementID,
                DateSortie:          in.DateSortie,
                Quantite:            in.Quantite,
                Operateur:           in.Operateur,
                CompteurHeuresAvant: in.CompteurHeuresAvant,
                CompteurHeuresApres: in.CompteurHeuresApres,
        }
        created, err := uc.repo.CreateSortie(ctx, auth, s)
        if err != nil {
                uc.log.Error("carburant.CreateSortie: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// ── BonAchatCarburant ──────────────────────────────────────────

// ListAchats — liste des bons d'achat carburant.
func (uc *Usecase) ListAchats(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.BonAchatCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        items, err := uc.repo.ListAchats(ctx, auth, chantierID, equipementID)
        if err != nil {
                uc.log.Error("carburant.ListAchats", "err", err)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// CreateAchat — crée un bon d'achat carburant (prixTotal calculé).
func (uc *Usecase) CreateAchat(ctx context.Context, auth *database.AuthUser, in CreateAchatInput) (*model.BonAchatCarburant, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.ChantierID == "" {
                return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
        }
        if in.DateAchat.IsZero() {
                return nil, fmt.Errorf("%w: dateAchat is required", domain.ErrBadRequest)
        }
        if in.TypeCarburant == "" {
                in.TypeCarburant = "GASOIL"
        }
        b := model.BonAchatCarburant{
                ChantierID:          in.ChantierID,
                DateAchat:           in.DateAchat,
                TypeCarburant:       in.TypeCarburant,
                Quantite:            in.Quantite,
                PrixUnitaire:        in.PrixUnitaire,
                PrixTotal:           in.Quantite * in.PrixUnitaire,
                StationService:      in.StationService,
                NumeroRecu:          in.NumeroRecu,
                EquipementID:        in.EquipementID,
                Operateur:           in.Operateur,
                CompteurHeuresAvant: in.CompteurHeuresAvant,
                CompteurHeuresApres: in.CompteurHeuresApres,
        }
        created, err := uc.repo.CreateAchat(ctx, auth, b)
        if err != nil {
                uc.log.Error("carburant.CreateAchat: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// ── ReleveCompteurEngin ────────────────────────────────────────

// ListReleves — liste des relevés de compteur.
func (uc *Usecase) ListReleves(ctx context.Context, auth *database.AuthUser, chantierID, equipementID string) ([]model.ReleveCompteurEngin, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        items, err := uc.repo.ListReleves(ctx, auth, chantierID, equipementID)
        if err != nil {
                uc.log.Error("carburant.ListReleves", "err", err)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// CreateReleve — crée un relevé de compteur.
func (uc *Usecase) CreateReleve(ctx context.Context, auth *database.AuthUser, in CreateReleveInput) (*model.ReleveCompteurEngin, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.EquipementID == "" || in.ChantierID == "" {
                return nil, fmt.Errorf("%w: equipementId and chantierId are required", domain.ErrBadRequest)
        }
        if in.DateReleve.IsZero() {
                return nil, fmt.Errorf("%w: dateReleve is required", domain.ErrBadRequest)
        }
        r := model.ReleveCompteurEngin{
                EquipementID: in.EquipementID,
                ChantierID:   in.ChantierID,
                DateReleve:   in.DateReleve,
                HeuresKm:     in.HeuresKm,
                Observation:  in.Observation,
        }
        created, err := uc.repo.CreateReleve(ctx, auth, r)
        if err != nil {
                uc.log.Error("carburant.CreateReleve: repo", "err", err)
                return nil, domain.ErrInternal
        }
        return created, nil
}

// ── Stats ──────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════
// Phase C — Delete methods (entrees/sorties/achats/releves)
// ══════════════════════════════════════════════════════════════════

// DeleteEntree — supprime une entrée carburant (RLS via JOIN Chantier).
func (uc *Usecase) DeleteEntree(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }
        if err := uc.repo.DeleteEntree(ctx, auth, id); err != nil {
                uc.log.Error("carburant.DeleteEntree", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// DeleteSortie — supprime une sortie carburant (RLS via JOIN Chantier).
func (uc *Usecase) DeleteSortie(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }
        if err := uc.repo.DeleteSortie(ctx, auth, id); err != nil {
                uc.log.Error("carburant.DeleteSortie", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// DeleteAchat — supprime un bon d'achat carburant (RLS via JOIN Chantier).
func (uc *Usecase) DeleteAchat(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }
        if err := uc.repo.DeleteAchat(ctx, auth, id); err != nil {
                uc.log.Error("carburant.DeleteAchat", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// DeleteReleve — supprime un relevé compteur (RLS via JOIN Chantier).
func (uc *Usecase) DeleteReleve(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }
        if err := uc.repo.DeleteReleve(ctx, auth, id); err != nil {
                uc.log.Error("carburant.DeleteReleve", "err", err, "id", id)
                return domain.ErrInternal
        }
        return nil
}

// Stats — agrégats pour le mois courant (ou le mois spécifié par year/month).
// Si year=0 ou month=0, utilise le mois courant (UTC).
//
// Calculs :
//   - TotalStockByType : pour chaque typeCarburant, somme des quantiteDisponible
//     des stocks du tenant
//   - TotalEntreesMonth : SUM(EntreeCarburant.quantite) du mois
//   - TotalSortiesMonth : SUM(SortieCarburant.quantite) du mois
//   - TotalAchatsMonth  : SUM(BonAchatCarburant.quantite) du mois
//   - Alerts : stocks où quantiteDisponible < seuilAlerte
func (uc *Usecase) Stats(ctx context.Context, auth *database.AuthUser, year, month int) (*Stats, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        now := time.Now().UTC()
        if year == 0 {
                year = now.Year()
        }
        if month == 0 {
                month = int(now.Month())
        }

        // Tous les stocks carburant visibles
        stocks, err := uc.repo.ListStock(ctx, auth, "", "")
        if err != nil {
                uc.log.Error("carburant.Stats: ListStock", "err", err)
                return nil, domain.ErrInternal
        }

        ids := make([]string, 0, len(stocks))
        for i := range stocks {
                ids = append(ids, stocks[i].ID)
        }
        quantites := make(map[string]float64, len(ids))
        if len(ids) > 0 {
                quantites, err = uc.repo.QuantitesDisponiblesStock(ctx, auth, ids)
                if err != nil {
                        uc.log.Error("carburant.Stats: QuantitesDisponiblesStock", "err", err)
                        return nil, domain.ErrInternal
                }
        }

        // Total par type
        totalByType := map[string]float64{}
        alerts := make([]StockCarburantWithQuantite, 0)
        for i := range stocks {
                q := quantites[stocks[i].ID]
                totalByType[stocks[i].TypeCarburant] += q
                if stocks[i].SeuilAlerte > 0 && q < stocks[i].SeuilAlerte {
                        alerts = append(alerts, StockCarburantWithQuantite{
                                StockCarburant:     stocks[i],
                                QuantiteDisponible: q,
                        })
                }
        }

        // Entrees / Sorties / Achats du mois
        entreesMonth, err := uc.repo.SumEntreesQuantiteInMonth(ctx, auth, year, month)
        if err != nil {
                uc.log.Error("carburant.Stats: SumEntreesQuantiteInMonth", "err", err)
                return nil, domain.ErrInternal
        }
        sortiesMonth, err := uc.repo.SumSortiesQuantiteInMonth(ctx, auth, year, month)
        if err != nil {
                uc.log.Error("carburant.Stats: SumSortiesQuantiteInMonth", "err", err)
                return nil, domain.ErrInternal
        }
        achatsMonth, err := uc.repo.SumAchatsQuantiteInMonth(ctx, auth, year, month)
        if err != nil {
                uc.log.Error("carburant.Stats: SumAchatsQuantiteInMonth", "err", err)
                return nil, domain.ErrInternal
        }

        return &Stats{
                TotalStockByType:  totalByType,
                TotalEntreesMonth: entreesMonth,
                TotalSortiesMonth: sortiesMonth,
                TotalAchatsMonth:  achatsMonth,
                Alerts:            alerts,
                MonthLabel:        fmt.Sprintf("%04d-%02d", year, month),
        }, nil
}
