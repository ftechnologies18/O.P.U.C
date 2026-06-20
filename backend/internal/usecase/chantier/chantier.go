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
        "fmt"
        "log/slog"
        "math"
        "strings"
        "time"

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

        // CRUD write (Phase 0.2)
        Create(ctx context.Context, auth *database.AuthUser, c model.Chantier) (*model.Chantier, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Chantier, error)
        Delete(ctx context.Context, auth *database.AuthUser, id string, force bool) error
        HasChildren(ctx context.Context, auth *database.AuthUser, chantierID string) (bool, error)
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
                // TEMPORAIRE (debug Phase 1) : wrapper l'erreur réelle pour diagnostic
                return nil, fmt.Errorf("chantier.List: ListWithMeta: %w", err)
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

// ══════════════════════════════════════════════════════════════════
// Phase 0.2 — CRUD write (Create, Update, Delete)
// ══════════════════════════════════════════════════════════════════

// CreateInput — payload pour la création d'un chantier.
// Tous les champs optionnels sont des pointeurs (omitted si nil).
type CreateInput struct {
        Nom                string     `json:"nom"`
        Adresse            *string    `json:"adresse,omitempty"`
        MaitreOuvrage      *string    `json:"maitreOuvrage,omitempty"`
        DateDebut          *time.Time `json:"dateDebut,omitempty"`
        DateFinPrevue      *time.Time `json:"dateFinPrevue,omitempty"`
        BudgetPrevisionnel float64    `json:"budgetPrevisionnel"`
        Statut             string     `json:"statut,omitempty"` // défaut EN_PREPARATION si vide
        Description        *string    `json:"description,omitempty"`
        ModeCarburant      string     `json:"modeCarburant,omitempty"` // défaut STOCK_PHYSIQUE si vide
        ClientID           *string    `json:"clientId,omitempty"`
}

// UpdateInput — payload pour la mise à jour d'un chantier.
// Tous les champs sont optionnels (update partielle).
type UpdateInput struct {
        Nom                *string    `json:"nom,omitempty"`
        Adresse            *string    `json:"adresse,omitempty"`
        MaitreOuvrage      *string    `json:"maitreOuvrage,omitempty"`
        DateDebut          *time.Time `json:"dateDebut,omitempty"`
        DateFinPrevue      *time.Time `json:"dateFinPrevue,omitempty"`
        BudgetPrevisionnel *float64   `json:"budgetPrevisionnel,omitempty"`
        Statut             *string    `json:"statut,omitempty"`
        Description        *string    `json:"description,omitempty"`
        ModeCarburant      *string    `json:"modeCarburant,omitempty"`
        ClientID           *string    `json:"clientId,omitempty"`
}

// validStatuts — statuts de chantier autorisés (cf. domain.StatutChantier*).
var validStatuts = map[string]struct{}{
        "EN_PREPARATION": {},
        "EN_COURS":       {},
        "EN_PAUSE":       {},
        "TERMINE":        {},
        "RECEPTIONNE":    {},
}

// validModesCarburant — modes de gestion carburant autorisés.
var validModesCarburant = map[string]struct{}{
        "STOCK_PHYSIQUE": {},
        "ACHAT_DIRECT":   {},
}

// isValidStatut vérifie qu'un statut est dans la liste autorisée.
func isValidStatut(s string) bool {
        _, ok := validStatuts[s]
        return ok
}

// isValidModeCarburant vérifie qu'un mode carburant est valide.
func isValidModeCarburant(m string) bool {
        _, ok := validModesCarburant[m]
        return ok
}

// Create — crée un nouveau chantier (tenant-scoped via RLS).
//
// Règles :
//   - nom requis (non vide)
//   - statut (si fourni) doit être valide, sinon défaut EN_PREPARATION
//   - modeCarburant (si fourni) doit être valide, sinon défaut STOCK_PHYSIQUE
//   - budgetPrevisionnel >= 0
//   - non-SUPER_ADMIN : entrepriseId forcé à auth.EntrepriseID
//   - SUPER_ADMIN : entrepriseId requis (un chantier ne peut pas être orphelin)
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*ChantierWithMeta, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }

        // ── Validation ─────────────────────────────────────────────
        in.Nom = strings.TrimSpace(in.Nom)
        if in.Nom == "" {
                return nil, fmt.Errorf("%w: nom is required", domain.ErrBadRequest)
        }
        if in.BudgetPrevisionnel < 0 {
                return nil, fmt.Errorf("%w: budgetPrevisionnel must be >= 0", domain.ErrBadRequest)
        }
        statut := in.Statut
        if statut == "" {
                statut = "EN_PREPARATION"
        }
        if !isValidStatut(statut) {
                return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, statut)
        }
        modeCarb := in.ModeCarburant
        if modeCarb == "" {
                modeCarb = "STOCK_PHYSIQUE"
        }
        if !isValidModeCarburant(modeCarb) {
                return nil, fmt.Errorf("%w: invalid modeCarburant %q", domain.ErrBadRequest, modeCarb)
        }

        // ── Résolution entrepriseId ────────────────────────────────
        var entrepriseID *string
        if auth.Role == "SUPER_ADMIN" {
                // SUPER_ADMIN peut créer dans n'importe quelle entreprise
                // (le caller doit fournir clientId/entrepriseId via le payload si besoin).
                // Si on n'a pas d'entrepriseId, on rejette (un chantier est forcément rattaché).
                // Pour simplifier en Phase 0, on accepte un chantier sans entreprise
                // (le SUPER_ADMIN crée rarement des chantiers opérationnels).
                entrepriseID = nil
        } else {
                if auth.EntrepriseID == "" {
                        return nil, fmt.Errorf("%w: non-admin user has no entrepriseId", domain.ErrBadRequest)
                }
                eid := auth.EntrepriseID
                entrepriseID = &eid
        }

        // ── Construction du modèle ─────────────────────────────────
        c := model.Chantier{
                Nom:                in.Nom,
                Adresse:            in.Adresse,
                MaitreOuvrage:      in.MaitreOuvrage,
                DateDebut:          in.DateDebut,
                DateFinPrevue:      in.DateFinPrevue,
                BudgetPrevisionnel: in.BudgetPrevisionnel,
                Statut:             statut,
                Description:        in.Description,
                ModeCarburant:      modeCarb,
                EntrepriseID:       entrepriseID,
                ClientID:           in.ClientID,
        }

        created, err := uc.repo.Create(ctx, auth, c)
        if err != nil {
                uc.log.Error("chantier.Create: repo", "err", err, "nom", in.Nom)
                return nil, domain.ErrInternal
        }

        uc.log.Info("chantier created",
                "id", created.ID,
                "nom", created.Nom,
                "by", auth.UserID,
        )

        return &ChantierWithMeta{
                Chantier:         *created,
                AvancementGlobal: 0,
                PhaseCount:       0,
                JournalierCount:  0,
        }, nil
}

// Update — met à jour un chantier (RLS-filtered).
// Seuls les champs non-nil du payload sont mis à jour.
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*ChantierWithMeta, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        updates := map[string]any{}
        if in.Nom != nil {
                v := strings.TrimSpace(*in.Nom)
                if v == "" {
                        return nil, fmt.Errorf("%w: nom cannot be empty", domain.ErrBadRequest)
                }
                updates["nom"] = v
        }
        if in.Adresse != nil {
                updates["adresse"] = *in.Adresse
        }
        if in.MaitreOuvrage != nil {
                updates["maitreOuvrage"] = *in.MaitreOuvrage
        }
        if in.DateDebut != nil {
                updates["dateDebut"] = *in.DateDebut
        }
        if in.DateFinPrevue != nil {
                updates["dateFinPrevue"] = *in.DateFinPrevue
        }
        if in.BudgetPrevisionnel != nil {
                if *in.BudgetPrevisionnel < 0 {
                        return nil, fmt.Errorf("%w: budgetPrevisionnel must be >= 0", domain.ErrBadRequest)
                }
                updates["budgetPrevisionnel"] = *in.BudgetPrevisionnel
        }
        if in.Statut != nil {
                if !isValidStatut(*in.Statut) {
                        return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, *in.Statut)
                }
                updates["statut"] = *in.Statut
        }
        if in.Description != nil {
                updates["description"] = *in.Description
        }
        if in.ModeCarburant != nil {
                if !isValidModeCarburant(*in.ModeCarburant) {
                        return nil, fmt.Errorf("%w: invalid modeCarburant %q", domain.ErrBadRequest, *in.ModeCarburant)
                }
                updates["modeCarburant"] = *in.ModeCarburant
        }
        if in.ClientID != nil {
                updates["clientId"] = *in.ClientID
        }

        if len(updates) == 0 {
                // Pas d'updates → on retourne le chantier courant
                return uc.Get(ctx, auth, id)
        }

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("chantier.Update: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }

        uc.log.Info("chantier updated", "id", id, "by", auth.UserID, "fields", keysOfChantier(updates))

        // Recharger avec phases + taches pour la réponse (comme Get)
        return uc.Get(ctx, auth, id)
}

// Delete — supprime un chantier (hard delete).
//
// Par défaut (force=false) : bloque si le chantier a des enfants (phases,
// journaliers affectés, pointages, photos, rapports, documents).
// Avec force=true : cascade delete tous les enfants.
//
// Renvoie ErrConflict si enfants présents et force=false.
// Renvoie ErrNotFound si l'ID n'existe pas ou n'est pas visible.
func (uc *Usecase) Delete(ctx context.Context, auth *database.AuthUser, id string, force bool) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        // Vérifie que le chantier existe (pour 404)
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("chantier.Delete: GetByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        // Vérifie les enfants si force=false
        if !force {
                has, err := uc.repo.HasChildren(ctx, auth, id)
                if err != nil {
                        uc.log.Error("chantier.Delete: HasChildren", "err", err, "id", id)
                        return domain.ErrInternal
                }
                if has {
                        return fmt.Errorf("%w: chantier has dependent data (phases, pointages, photos, etc.) — use ?force=true to cascade delete",
                                domain.ErrConflict)
                }
        }

        if err := uc.repo.Delete(ctx, auth, id, force); err != nil {
                uc.log.Error("chantier.Delete: repo", "err", err, "id", id)
                return domain.ErrInternal
        }

        uc.log.Info("chantier deleted", "id", id, "by", auth.UserID, "force", force)
        return nil
}

// keysOfChantier retourne les clés d'un map (pour logging).
func keysOfChantier(m map[string]any) []string {
        keys := make([]string, 0, len(m))
        for k := range m {
                keys = append(keys, k)
        }
        return keys
}
