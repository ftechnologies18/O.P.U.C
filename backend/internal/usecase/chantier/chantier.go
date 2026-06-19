// Package chantier — usecase pour les chantiers (lecture métier, Phase 2).
//
// Opérations :
//   - List : liste paginée + filtres (statut, search) + KPI agrégés
//   - Get  : détail d'un chantier avec phases + taches préloadées
//
// Toutes les requêtes sont tenant-scoped via RLS (Row-Level Security).
// Le repo implémente l'interface Repo (inversion de dépendance).
//
// ChantierWithMeta = model.Chantier + méta-données calculées :
//   - AvancementGlobal : moyenne des avancements des phases (arrondi)
//   - PhaseCount       : nombre de phases
//   - JournalierCount  : nombre d'affectations journaliers actives
package chantier

import (
        "context"
        "log/slog"
        "math"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.ChantierRepository.
//
// Toutes les méthodes acceptent un *database.AuthUser pour activer le RLS :
//   - SUPER_ADMIN → voit toutes les entreprises (RLS bypass)
//   - autres rôles → ne voit que son entrepriseId
type Repo interface {
        List(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Chantier, int64, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Chantier, error)
        CountByStatut(ctx context.Context, auth *database.AuthUser) (map[string]int64, error)
        CountPhases(ctx context.Context, auth *database.AuthUser, chantierID string) (int64, error)
        CountJournaliers(ctx context.Context, auth *database.AuthUser, chantierID string) (int64, error)
        GetPhasesAvancement(ctx context.Context, auth *database.AuthUser, chantierID string) ([]float64, error)
        // ListWithMeta — version optimisée batch (évite N+1) :
        // retourne chantiers (avec Phases préloadées) + total + map[chantierID]journalierCount
        ListWithMeta(ctx context.Context, auth *database.AuthUser, filter ListInput) ([]model.Chantier, int64, map[string]int64, error)
}

// ListInput — critères de filtrage pour List.
// Défini ici (côté usecase) pour éviter que le repo ne dépende du dto HTTP.
type ListInput struct {
        Statut   string // filtre par statut (EN_COURS, EN_PREPARATION, TERMINE, RECEPTIONNE)
        Search   string // ILIKE sur nom, adresse, maitreOuvrage
        Page     int    // 1-based, défaut 1
        PageSize int    // défaut 50
}

// ChantierWithMeta — chantier + méta-données calculées (avancement + counts).
// Le DTO HTTP (dto.ChantierWithMeta) transforme PhaseCount/JournalierCount
// en objet _count {phases, journaliers} pour matcher le format Next.js.
type ChantierWithMeta struct {
        model.Chantier
        AvancementGlobal int   `json:"avancementGlobal"`
        PhaseCount       int64 `json:"phaseCount"`
        JournalierCount  int64 `json:"journalierCount"`
}

// KPI — compteurs agrégés sur TOUS les chantiers du tenant (non filtrés).
type KPI struct {
        Total         int64 `json:"total"`
        Actifs        int64 `json:"actifs"`        // statut = EN_COURS
        EnPreparation int64 `json:"enPreparation"` // statut = EN_PREPARATION
        Termines      int64 `json:"termines"`      // statut = TERMINE ou RECEPTIONNE
}

// ListOutput — résultat de List (chantiers paginés + KPI agrégés).
type ListOutput struct {
        Chantiers []ChantierWithMeta `json:"chantiers"`
        KPI       KPI                `json:"kpi"`
}

// Usecase — cas d'usage pour les chantiers (lecture).
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// List — retourne une page de chantiers + KPI agrégés.
//
// Version optimisée (évite N+1) :
//  1. ListWithMeta : 1 query Chantier + Preload Phases + 1 query batch journalierCounts
//  2. Pour chaque chantier : avancementGlobal + phaseCount depuis les Phases préloadées
//  3. KPI agrégés sur TOUS les chantiers du tenant (CountByStatut)
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

        // 1. Liste optimisée (batch)
        chantiers, _, jourCounts, err := uc.repo.ListWithMeta(ctx, auth, in)
        if err != nil {
                uc.log.Error("chantier.List: ListWithMeta", "err", err, "auth_uid", auth.UserID)
                return nil, domain.ErrInternal
        }

        // 2. Pour chaque chantier : avancement + phaseCount depuis Phases préloadées
        out := make([]ChantierWithMeta, 0, len(chantiers))
        for i := range chantiers {
                c := &chantiers[i]
                // Avancement depuis les phases préloadées (pas de requête supplémentaire)
                avVals := make([]float64, 0, len(c.Phases))
                for p := range c.Phases {
                        avVals = append(avVals, c.Phases[p].Avancement)
                }
                out = append(out, ChantierWithMeta{
                        Chantier:         *c,
                        AvancementGlobal: computeAvg(avVals),
                        PhaseCount:       int64(len(c.Phases)),
                        JournalierCount:  jourCounts[c.ID],
                })
        }

        // 3. KPI agrégés (sur TOUS les chantiers du tenant, sans filtres)
        statutCounts, err := uc.repo.CountByStatut(ctx, auth)
        if err != nil {
                uc.log.Error("chantier.List: CountByStatut", "err", err)
                return nil, domain.ErrInternal
        }

        return &ListOutput{
                Chantiers: out,
                KPI: KPI{
                        Total:         statutCounts["total"],
                        Actifs:        statutCounts["EN_COURS"],
                        EnPreparation: statutCounts["EN_PREPARATION"],
                        Termines:      statutCounts["TERMINE"],
                },
        }, nil
}

// Get — retourne un chantier par ID avec phases + taches préloadées + méta.
//
// Le repo Preload "Phases.Taches" → on calcule avancementGlobal + phaseCount
// directement depuis les phases préloadées (pas de requêtes supplémentaires).
// JournalierCount nécessite une requête séparée (CountJournaliers).
func (uc *Usecase) Get(ctx context.Context, auth *database.AuthUser, id string) (*ChantierWithMeta, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }

        c, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("chantier.Get: repo.GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if c == nil {
                return nil, domain.ErrNotFound
        }

        // Avancement + phaseCount depuis les phases préloadées
        avVals := make([]float64, 0, len(c.Phases))
        for i := range c.Phases {
                avVals = append(avVals, c.Phases[i].Avancement)
        }

        jourCount, err := uc.repo.CountJournaliers(ctx, auth, id)
        if err != nil {
                uc.log.Error("chantier.Get: CountJournaliers", "err", err, "id", id)
                return nil, domain.ErrInternal
        }

        return &ChantierWithMeta{
                Chantier:         *c,
                AvancementGlobal: computeAvg(avVals),
                PhaseCount:       int64(len(c.Phases)),
                JournalierCount:  jourCount,
        }, nil
}

// computeAvg retourne la moyenne arrondie d'un slice de float64.
// Retourne 0 si le slice est vide.
func computeAvg(vals []float64) int {
        if len(vals) == 0 {
                return 0
        }
        sum := 0.0
        for _, v := range vals {
                sum += v
        }
        return int(math.Round(sum / float64(len(vals))))
}
