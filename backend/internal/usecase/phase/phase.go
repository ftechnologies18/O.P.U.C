// Package phase — usecase pour les Phases et Tâches (Phase 3, délégation de suivi).
//
// Opérations :
//   - CreatePhase / UpdatePhase / DeletePhase : CRUD des phases d'un chantier
//   - CreateTache / UpdateTache / DeleteTache : CRUD des tâches d'une phase
//   - ListMyTaches : tâches assignées à l'utilisateur courant (page /mes-taches)
//
// Toutes les requêtes sont tenant-scoped via RLS. Les tables Phase et Tache
// n'ont PAS de RLS direct : le filtrage tenant se fait via JOIN sur Chantier
// (qui est RLS-protected). Le repo implémente l'interface Repo (inversion de
// dépendance) et effectue ces JOINs en interne.
//
// Règles métier :
//   - nom requis pour phase et tâche
//   - avancement dans [0, 100]
//   - statut ∈ {PLANIFIEE, EN_COURS, TERMINE, EN_RETARD} (défaut PLANIFIEE)
//   - si avancement fourni sans statut explicite :
//   - avancement >= 100 → statut = TERMINE
//   - avancement > 0    → statut = EN_COURS
//   - avancement == 0   → statut = PLANIFIEE
package phase

import (
        "context"
        "fmt"
        "log/slog"
        "strings"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase (inversion de dépendance).
// Implémentée par repository/gorm.PhaseRepository.
//
// Toutes les méthodes acceptent un *database.AuthUser pour activer le RLS.
// Pour CreatePhase / CreateTache, le repo vérifie en plus (via JOIN Chantier)
// que le parent appartient bien au tenant avant l'INSERT (FK global ≠ isolation).
type Repo interface {
        // Phase CRUD
        CreatePhase(ctx context.Context, auth *database.AuthUser, p model.Phase) (*model.Phase, error)
        UpdatePhase(ctx context.Context, auth *database.AuthUser, phaseID string, updates map[string]any) (*model.Phase, error)
        DeletePhase(ctx context.Context, auth *database.AuthUser, phaseID string) error
        GetPhaseByID(ctx context.Context, auth *database.AuthUser, phaseID string) (*model.Phase, error)

        // Tache CRUD
        CreateTache(ctx context.Context, auth *database.AuthUser, t model.Tache) (*model.Tache, error)
        UpdateTache(ctx context.Context, auth *database.AuthUser, tacheID string, updates map[string]any) (*model.Tache, error)
        DeleteTache(ctx context.Context, auth *database.AuthUser, tacheID string) error
        GetTacheByID(ctx context.Context, auth *database.AuthUser, tacheID string) (*model.Tache, error)

        // Mes tâches — page /mes-taches
        // Liste les tâches où responsableId = userID, avec Preload Phase.Chantier.
        // Le filtrage tenant se fait via JOIN Phase → Chantier (RLS-protected).
        ListMyTaches(ctx context.Context, auth *database.AuthUser, userID string) ([]model.Tache, int64, error)
}

// ── Phase inputs ────────────────────────────────────────────────

// CreatePhaseInput — payload pour la création d'une phase.
type CreatePhaseInput struct {
        Nom         string
        Description *string
        DateDebut   *time.Time
        DateFin     *time.Time
}

// UpdatePhaseInput — payload pour la mise à jour partielle d'une phase.
// Tous les champs sont optionnels (pointeurs).
type UpdatePhaseInput struct {
        Nom         *string
        Description *string
        DateDebut   *time.Time
        DateFin     *time.Time
        Avancement  *float64
        Ordre       *int
}

// ── Tache inputs ────────────────────────────────────────────────

// CreateTacheInput — payload pour la création d'une tâche.
type CreateTacheInput struct {
        Nom               string
        Description       *string
        DateDebut         *time.Time
        DateFin           *time.Time
        ResponsableID     *string
        TachePrecedenteID *string
}

// UpdateTacheInput — payload pour la mise à jour partielle d'une tâche.
// Si Avancement est fourni sans Statut explicite, le statut est auto-dérivé :
//   - avancement >= 100 → TERMINE
//   - avancement > 0    → EN_COURS
type UpdateTacheInput struct {
        Nom               *string
        Description       *string
        DateDebut         *time.Time
        DateFin           *time.Time
        ResponsableID     *string
        TachePrecedenteID *string
        Avancement        *float64
        Statut            *string
        Ordre             *int
}

// ── Statut helpers ──────────────────────────────────────────────

// validTacheStatuts — valeurs autorisées pour Tache.Statut.
var validTacheStatuts = map[string]struct{}{
        "PLANIFIEE": {},
        "EN_COURS":  {},
        "TERMINE":   {},
        "EN_RETARD": {},
}

func isValidTacheStatut(s string) bool {
        _, ok := validTacheStatuts[s]
        return ok
}

// computeStatutFromAvancement dérive le statut d'une tâche à partir de son
// avancement. Utilisé quand l'avancement est fourni sans statut explicite.
func computeStatutFromAvancement(av float64) string {
        if av >= 100 {
                return "TERMINE"
        }
        if av > 0 {
                return "EN_COURS"
        }
        return "PLANIFIEE"
}

// ── Usecase ─────────────────────────────────────────────────────

// Usecase — cas d'usage pour les Phases et Tâches.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Phase CRUD
// ══════════════════════════════════════════════════════════════════

// CreatePhase — crée une nouvelle phase sous un chantier.
// Le repo vérifie (via JOIN Chantier RLS) que le chantier appartient bien au
// tenant avant l'INSERT. Si le chantier n'est pas visible → ErrBadRequest.
func (uc *Usecase) CreatePhase(ctx context.Context, auth *database.AuthUser, chantierID string, in CreatePhaseInput) (*model.Phase, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if chantierID == "" {
                return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
        }
        in.Nom = strings.TrimSpace(in.Nom)
        if in.Nom == "" {
                return nil, fmt.Errorf("%w: nom is required", domain.ErrBadRequest)
        }

        p := model.Phase{
                ChantierID:  chantierID,
                Nom:         in.Nom,
                Description: in.Description,
                DateDebut:   in.DateDebut,
                DateFin:     in.DateFin,
        }

        created, err := uc.repo.CreatePhase(ctx, auth, p)
        if err != nil {
                if isForeignKeyError(err) {
                        return nil, fmt.Errorf("%w: chantier not found in tenant", domain.ErrBadRequest)
                }
                uc.log.Error("phase.Create: repo", "err", err, "chantierId", chantierID)
                return nil, domain.ErrInternal
        }

        uc.log.Info("phase created", "id", created.ID, "chantierId", chantierID, "by", auth.UserID)
        return created, nil
}

// UpdatePhase — met à jour partiellement une phase.
// Renvoie ErrNotFound si la phase n'existe pas ou n'est pas visible par RLS.
func (uc *Usecase) UpdatePhase(ctx context.Context, auth *database.AuthUser, phaseID string, in UpdatePhaseInput) (*model.Phase, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if phaseID == "" {
                return nil, fmt.Errorf("%w: phaseId is required", domain.ErrBadRequest)
        }

        updates := map[string]any{}
        if in.Nom != nil {
                v := strings.TrimSpace(*in.Nom)
                if v == "" {
                        return nil, fmt.Errorf("%w: nom cannot be empty", domain.ErrBadRequest)
                }
                updates["nom"] = v
        }
        if in.Description != nil {
                updates["description"] = *in.Description
        }
        if in.DateDebut != nil {
                updates["dateDebut"] = *in.DateDebut
        }
        if in.DateFin != nil {
                updates["dateFin"] = *in.DateFin
        }
        if in.Avancement != nil {
                v := *in.Avancement
                if v < 0 || v > 100 {
                        return nil, fmt.Errorf("%w: avancement must be in [0, 100]", domain.ErrBadRequest)
                }
                updates["avancement"] = v
        }
        if in.Ordre != nil {
                updates["ordre"] = *in.Ordre
        }

        if len(updates) == 0 {
                // Pas d'updates → on retourne la phase courante
                existing, err := uc.repo.GetPhaseByID(ctx, auth, phaseID)
                if err != nil {
                        uc.log.Error("phase.Update: GetPhaseByID", "err", err, "id", phaseID)
                        return nil, domain.ErrInternal
                }
                if existing == nil {
                        return nil, domain.ErrNotFound
                }
                return existing, nil
        }

        updated, err := uc.repo.UpdatePhase(ctx, auth, phaseID, updates)
        if err != nil {
                uc.log.Error("phase.Update: repo", "err", err, "id", phaseID)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// DeletePhase — supprime une phase (cascade delete ses tâches d'abord).
// Renvoie ErrNotFound si la phase n'existe pas ou n'est pas visible par RLS.
func (uc *Usecase) DeletePhase(ctx context.Context, auth *database.AuthUser, phaseID string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if phaseID == "" {
                return fmt.Errorf("%w: phaseId is required", domain.ErrBadRequest)
        }

        // Vérifie l'existence (pour 404)
        existing, err := uc.repo.GetPhaseByID(ctx, auth, phaseID)
        if err != nil {
                uc.log.Error("phase.Delete: GetPhaseByID", "err", err, "id", phaseID)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        if err := uc.repo.DeletePhase(ctx, auth, phaseID); err != nil {
                uc.log.Error("phase.Delete: repo", "err", err, "id", phaseID)
                return domain.ErrInternal
        }

        uc.log.Info("phase deleted", "id", phaseID, "by", auth.UserID)
        return nil
}

// ══════════════════════════════════════════════════════════════════
// Tache CRUD
// ══════════════════════════════════════════════════════════════════

// CreateTache — crée une nouvelle tâche sous une phase.
// Statut auto = "PLANIFIEE", avancement = 0. Le repo vérifie (via JOIN
// Phase → Chantier RLS) que la phase appartient bien au tenant.
func (uc *Usecase) CreateTache(ctx context.Context, auth *database.AuthUser, phaseID string, in CreateTacheInput) (*model.Tache, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if phaseID == "" {
                return nil, fmt.Errorf("%w: phaseId is required", domain.ErrBadRequest)
        }
        in.Nom = strings.TrimSpace(in.Nom)
        if in.Nom == "" {
                return nil, fmt.Errorf("%w: nom is required", domain.ErrBadRequest)
        }

        // Normalize optional ID fields : empty string → nil (avoid inserting "")
        if in.ResponsableID != nil && strings.TrimSpace(*in.ResponsableID) == "" {
                in.ResponsableID = nil
        }
        if in.TachePrecedenteID != nil && strings.TrimSpace(*in.TachePrecedenteID) == "" {
                in.TachePrecedenteID = nil
        }

        t := model.Tache{
                PhaseID:           phaseID,
                Nom:               in.Nom,
                Description:       in.Description,
                DateDebut:         in.DateDebut,
                DateFin:           in.DateFin,
                ResponsableID:     in.ResponsableID,
                TachePrecedenteID: in.TachePrecedenteID,
                Statut:            "PLANIFIEE", // default
                Avancement:        0,
        }

        created, err := uc.repo.CreateTache(ctx, auth, t)
        if err != nil {
                if isForeignKeyError(err) {
                        return nil, fmt.Errorf("%w: phase or responsable not found in tenant", domain.ErrBadRequest)
                }
                uc.log.Error("tache.Create: repo", "err", err, "phaseId", phaseID)
                return nil, domain.ErrInternal
        }

        uc.log.Info("tache created", "id", created.ID, "phaseId", phaseID, "by", auth.UserID)
        return created, nil
}

// UpdateTache — met à jour partiellement une tâche.
//
// Règle auto : si avancement fourni sans statut explicite → statut dérivé
// (TERMINE si >= 100, EN_COURS si > 0, PLANIFIEE sinon).
func (uc *Usecase) UpdateTache(ctx context.Context, auth *database.AuthUser, tacheID string, in UpdateTacheInput) (*model.Tache, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if tacheID == "" {
                return nil, fmt.Errorf("%w: tacheId is required", domain.ErrBadRequest)
        }

        // Validation du statut explicite (si fourni)
        if in.Statut != nil {
                if !isValidTacheStatut(*in.Statut) {
                        return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, *in.Statut)
                }
        }
        // Validation de l'avancement (si fourni)
        if in.Avancement != nil {
                v := *in.Avancement
                if v < 0 || v > 100 {
                        return nil, fmt.Errorf("%w: avancement must be in [0, 100]", domain.ErrBadRequest)
                }
        }

        updates := map[string]any{}
        if in.Nom != nil {
                v := strings.TrimSpace(*in.Nom)
                if v == "" {
                        return nil, fmt.Errorf("%w: nom cannot be empty", domain.ErrBadRequest)
                }
                updates["nom"] = v
        }
        if in.Description != nil {
                updates["description"] = *in.Description
        }
        if in.DateDebut != nil {
                updates["dateDebut"] = *in.DateDebut
        }
        if in.DateFin != nil {
                updates["dateFin"] = *in.DateFin
        }
        if in.ResponsableID != nil {
                v := strings.TrimSpace(*in.ResponsableID)
                if v == "" {
                        updates["responsableId"] = nil // clear
                } else {
                        updates["responsableId"] = v
                }
        }
        if in.TachePrecedenteID != nil {
                v := strings.TrimSpace(*in.TachePrecedenteID)
                if v == "" {
                        updates["tachePrecedenteId"] = nil // clear
                } else {
                        updates["tachePrecedenteId"] = v
                }
        }
        if in.Ordre != nil {
                updates["ordre"] = *in.Ordre
        }
        if in.Avancement != nil {
                v := *in.Avancement
                updates["avancement"] = v
                // Auto statut (sauf si statut explicite fourni)
                if in.Statut == nil {
                        updates["statut"] = computeStatutFromAvancement(v)
                }
        }
        if in.Statut != nil {
                updates["statut"] = *in.Statut
        }

        if len(updates) == 0 {
                // Pas d'updates → on retourne la tâche courante
                existing, err := uc.repo.GetTacheByID(ctx, auth, tacheID)
                if err != nil {
                        uc.log.Error("tache.Update: GetTacheByID", "err", err, "id", tacheID)
                        return nil, domain.ErrInternal
                }
                if existing == nil {
                        return nil, domain.ErrNotFound
                }
                return existing, nil
        }

        updated, err := uc.repo.UpdateTache(ctx, auth, tacheID, updates)
        if err != nil {
                uc.log.Error("tache.Update: repo", "err", err, "id", tacheID)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        return updated, nil
}

// DeleteTache — supprime une tâche.
// Renvoie ErrNotFound si la tâche n'existe pas ou n'est pas visible par RLS.
func (uc *Usecase) DeleteTache(ctx context.Context, auth *database.AuthUser, tacheID string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if tacheID == "" {
                return fmt.Errorf("%w: tacheId is required", domain.ErrBadRequest)
        }

        // Vérifie l'existence (pour 404)
        existing, err := uc.repo.GetTacheByID(ctx, auth, tacheID)
        if err != nil {
                uc.log.Error("tache.Delete: GetTacheByID", "err", err, "id", tacheID)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        if err := uc.repo.DeleteTache(ctx, auth, tacheID); err != nil {
                uc.log.Error("tache.Delete: repo", "err", err, "id", tacheID)
                return domain.ErrInternal
        }

        uc.log.Info("tache deleted", "id", tacheID, "by", auth.UserID)
        return nil
}

// ══════════════════════════════════════════════════════════════════
// Mes tâches (page /mes-taches)
// ══════════════════════════════════════════════════════════════════

// ListMyTaches — retourne toutes les tâches où responsableId = auth.UserID,
// avec Phase.Chantier préloadé pour le contexte.
//
// Le filtrage tenant se fait via JOIN Phase → Chantier (RLS-protected) :
// un user ne voit que les tâches des phases des chantiers de son entreprise.
// (Cas SUPER_ADMIN : bypass RLS — voit les tâches de tous les tenants.)
func (uc *Usecase) ListMyTaches(ctx context.Context, auth *database.AuthUser) ([]model.Tache, int64, error) {
        if auth == nil {
                return nil, 0, domain.ErrUnauthorized
        }
        if auth.UserID == "" {
                return nil, 0, fmt.Errorf("%w: missing userId", domain.ErrBadRequest)
        }

        items, total, err := uc.repo.ListMyTaches(ctx, auth, auth.UserID)
        if err != nil {
                uc.log.Error("tache.ListMy: repo", "err", err, "user", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// ── helpers ─────────────────────────────────────────────────────

// isForeignKeyError détecte les erreurs PostgreSQL de contrainte de FK
// (SQLSTATE 23503). Permet de convertir les échecs FK (ex: chantierId non
// visible par RLS) en ErrBadRequest plutôt qu'en ErrInternal.
func isForeignKeyError(err error) bool {
        if err == nil {
                return false
        }
        s := err.Error()
        return strings.Contains(s, "foreign key constraint") ||
                strings.Contains(s, "violates foreign key constraint") ||
                strings.Contains(s, "SQLSTATE 23503")
}
