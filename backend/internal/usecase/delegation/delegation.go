// Package delegation — delegation.go
// Usecase pour la délégation de domaines fonctionnels par le GERANT.
//
// Fonctionnalités :
//   - Délégation de domaines (FINANCE, RH, LOGISTIQUE, COMMERCIAL, CHANTIER, DOCUMENTS)
//     à un user de l'entreprise avec un niveau de permission (LECTURE, ECRITURE, GESTION).
//   - Promotion/démotion de co-GERANTS (max 2 par entreprise). Seul le principal
//     GERANT (role == "GERANT", pas isCoGerant) peut promote/demote.
//
// Hiérarchie d'autorisation :
//   - SUPER_ADMIN      : bypass (voit toutes les délégations de toutes les entreprises)
//   - GERANT principal : peut créer/modifier/révoquer des délégations de SON entreprise,
//                        peut promote/demote des co-GERANTS (max 2)
//   - co-GERANT        : mêmes droits que GERANT SAUF promote/demote (réservé au
//                        principal GERANT)
//   - Autres rôles     : peuvent lister leurs délégations reçues (ListMyDelegations)
//
// Le repo utilisé est *gorm.DelegationRepository (injection concrète — pas d'interface
// car les signatures sont stables et les méthodes nombreuses).
package delegation

import (
        "context"
        "fmt"
        "log/slog"
        "strings"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
        "opuc/internal/repository/gorm"
)

// Repo — interface requise par le usecase (injection).
// Implémentée par *gorm.DelegationRepository.
type Repo interface {
        Create(ctx context.Context, auth *database.AuthUser, d model.Delegation) (*model.Delegation, error)
        GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error)
        List(ctx context.Context, auth *database.AuthUser, filter gorm.DelegationFilter) ([]model.Delegation, int64, error)
        ListByUser(ctx context.Context, auth *database.AuthUser, userID string) ([]model.Delegation, error)
        ListMyDelegations(ctx context.Context, auth *database.AuthUser) ([]model.Delegation, error)
        Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Delegation, error)
        Revoke(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error)
        GetActive(ctx context.Context, userID, domainName, entrepriseID string) (*model.Delegation, error)
        ExpireOld(ctx context.Context) (int64, error)
        CountCoGerants(ctx context.Context, entrepriseID string) (int64, error)
        PromoteCoGerant(ctx context.Context, userID string) error
        DemoteCoGerant(ctx context.Context, userID string) error
        GetCoGerants(ctx context.Context, entrepriseID string) ([]model.User, error)
        GetUserByID(ctx context.Context, userID string) (*model.User, error)
}

// ── Inputs ──────────────────────────────────────────────────────────

// CreateInput — payload pour Create.
type CreateInput struct {
        ToUserID    string     `json:"toUserId"`
        Domain      string     `json:"domain"`
        Permissions string     `json:"permissions"` // LECTURE | ECRITURE | GESTION
        ExpiresLe   *time.Time `json:"expiresLe,omitempty"`
        Raison      *string    `json:"raison,omitempty"`
}

// UpdateInput — payload pour Update. Tous les champs optionnels.
type UpdateInput struct {
        ToUserID    *string    `json:"toUserId,omitempty"`
        Permissions *string    `json:"permissions,omitempty"`
        ExpiresLe   *time.Time `json:"expiresLe,omitempty"`
        Raison      *string    `json:"raison,omitempty"`
}

// ListInput — critères de filtrage pour List.
type ListInput struct {
        ToUserID   string
        Domain     string
        Statut     string
        FromUserID string
        Page       int
        PageSize   int
}

// ── Usecase ─────────────────────────────────────────────────────────

// Usecase — cas d'usage pour la délégation.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// validDomains — ensemble des 6 domaines fonctionnels délégables.
var validDomains = map[string]struct{}{
        model.DomainFinance:    {},
        model.DomainRH:         {},
        model.DomainLogistique: {},
        model.DomainCommercial: {},
        model.DomainChantier:   {},
        model.DomainDocuments:  {},
}

// validPerms — ensemble des 3 niveaux de permission.
var validPerms = map[string]struct{}{
        model.PermLecture:  {},
        model.PermEcriture: {},
        model.PermGestion:  {},
}

func isValidDomain(d string) bool {
        _, ok := validDomains[d]
        return ok
}

func isValidPerm(p string) bool {
        _, ok := validPerms[p]
        return ok
}

// isPrincipalGerant retourne true si auth est un GERANT principal (role == "GERANT",
// PAS isCoGerant). C'est le seul autorisé à promote/demote des co-GERANTS.
func isPrincipalGerant(au *database.AuthUser) bool {
        return au != nil && au.Role == "GERANT" && !au.IsCoGerant
}

// isGerantOrCo retourne true si auth est GERANT (principal ou co-GERANT).
// Utilisé pour les opérations de CRUD sur les délégations (les deux ont les mêmes droits).
func isGerantOrCo(au *database.AuthUser) bool {
        return au != nil && (au.Role == "GERANT" || au.IsCoGerant)
}

// ── Délégations CRUD ────────────────────────────────────────────────

// Create — crée une délégation.
//
// Règles :
//   - auth doit être GERANT (principal ou co-GERANT) ou SUPER_ADMIN
//   - toUserId doit exister et appartenir à la même entreprise que auth
//     (pour SUPER_ADMIN, à l'entreprise spécifiée — pas implémenté ici, on utilise
//     auth.EntrepriseID par défaut)
//   - domain doit être un des 6 domaines valides
//   - permissions doit être un des 3 niveaux valides
//   - pas de doublon : un user ne peut pas avoir 2 délégations ACTIVES pour le même domaine
//     (check via GetActive avant insert)
func (uc *Usecase) Create(ctx context.Context, auth *database.AuthUser, in CreateInput) (*model.Delegation, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if !isGerantOrCo(auth) && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        in.ToUserID = strings.TrimSpace(in.ToUserID)
        in.Domain = strings.TrimSpace(in.Domain)
        in.Permissions = strings.TrimSpace(in.Permissions)
        if in.ToUserID == "" {
                return nil, fmt.Errorf("%w: toUserId is required", domain.ErrBadRequest)
        }
        if !isValidDomain(in.Domain) {
                return nil, fmt.Errorf("%w: invalid domain %q", domain.ErrBadRequest, in.Domain)
        }
        if !isValidPerm(in.Permissions) {
                return nil, fmt.Errorf("%w: invalid permissions %q", domain.ErrBadRequest, in.Permissions)
        }
        if auth.EntrepriseID == "" {
                return nil, fmt.Errorf("%w: auth has no entrepriseId", domain.ErrBadRequest)
        }
        // Empêche l'auto-délégation (un GERANT n'a pas besoin de déléguer à lui-même)
        if in.ToUserID == auth.UserID {
                return nil, fmt.Errorf("%w: cannot delegate to yourself", domain.ErrBadRequest)
        }
        // Validation de l'expiration (si fournie, doit être dans le futur)
        if in.ExpiresLe != nil && in.ExpiresLe.Before(time.Now().UTC()) {
                return nil, fmt.Errorf("%w: expiresLe must be in the future", domain.ErrBadRequest)
        }

        // Vérifie que le toUser existe et appartient à la même entreprise
        toUser, err := uc.repo.GetUserByID(ctx, in.ToUserID)
        if err != nil {
                uc.log.Error("delegation.Create: GetUserByID", "err", err, "toUser", in.ToUserID)
                return nil, domain.ErrInternal
        }
        if toUser == nil {
                return nil, domain.ErrNotFound
        }
        if toUser.EntrepriseID == nil || *toUser.EntrepriseID != auth.EntrepriseID {
                return nil, domain.ErrForbidden
        }
        // Un GERANT ou co-GERANT ne peut pas recevoir de délégation (il a déjà tous les droits)
        if toUser.IsGerant() {
                return nil, fmt.Errorf("%w: target user is already a GERANT or co-GERANT", domain.ErrBadRequest)
        }

        // Check @@unique : pas de délégation ACTIVE existante pour (toUser, domain)
        existing, err := uc.repo.GetActive(ctx, in.ToUserID, in.Domain, auth.EntrepriseID)
        if err != nil {
                uc.log.Error("delegation.Create: GetActive", "err", err)
                return nil, domain.ErrInternal
        }
        if existing != nil {
                return nil, fmt.Errorf("%w: an active delegation already exists for this user+domain", domain.ErrConflict)
        }

        // Construction du model.Delegation
        d := model.Delegation{
                EntrepriseID: auth.EntrepriseID,
                FromUserID:   auth.UserID,
                ToUserID:     in.ToUserID,
                Domain:       in.Domain,
                Permissions:  in.Permissions,
                Statut:       model.DelegationStatutActif,
                ExpiresLe:    in.ExpiresLe,
                Raison:       in.Raison,
        }

        created, err := uc.repo.Create(ctx, auth, d)
        if err != nil {
                uc.log.Error("delegation.Create: repo.Create", "err", err, "toUser", in.ToUserID)
                return nil, domain.ErrInternal
        }
        uc.log.Info("delegation created",
                "id", created.ID, "from", auth.UserID, "to", in.ToUserID,
                "domain", in.Domain, "perm", in.Permissions,
        )
        return created, nil
}

// List — liste les délégations selon le rôle de l'auth.
//
// SUPER_ADMIN : voit toutes les délégations (filtre optionnel par entrepriseId)
// GERANT/co-GERANT : voit toutes les délégations de SON entreprise
// Autres : voient uniquement leurs délégations reçues (force toUserId = auth.UserID)
func (uc *Usecase) List(ctx context.Context, auth *database.AuthUser, in ListInput) ([]model.Delegation, int64, error) {
        if auth == nil {
                return nil, 0, domain.ErrUnauthorized
        }
        if in.Page < 1 {
                in.Page = 1
        }
        if in.PageSize < 1 {
                in.PageSize = 50
        }
        filter := gorm.DelegationFilter{
                ToUserID:   in.ToUserID,
                Domain:     in.Domain,
                Statut:     in.Statut,
                FromUserID: in.FromUserID,
                Page:       in.Page,
                PageSize:   in.PageSize,
        }

        // Non-SUPER_ADMIN et non-GERANT : force toUserId = auth.UserID
        // (ils ne voient que leurs délégations reçues)
        if auth.Role != "SUPER_ADMIN" && !isGerantOrCo(auth) {
                filter.ToUserID = auth.UserID
        }

        items, total, err := uc.repo.List(ctx, auth, filter)
        if err != nil {
                uc.log.Error("delegation.List", "err", err, "auth", auth.UserID)
                return nil, 0, domain.ErrInternal
        }
        return items, total, nil
}

// GetByID — récupère une délégation par ID.
//
// Règles d'accès :
//   - SUPER_ADMIN : accès à toutes les délégations
//   - GERANT/co-GERANT : accès aux délégations de SON entreprise (RLS enforced)
//   - Autres : accès uniquement aux délégations où ils sont toUserId (RLS enforced)
func (uc *Usecase) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        d, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("delegation.GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if d == nil {
                return nil, domain.ErrNotFound
        }
        // Pour les non-GERANT : vérifie qu'ils sont bien le toUserId de cette délégation
        if auth.Role != "SUPER_ADMIN" && !isGerantOrCo(auth) {
                if d.ToUserID != auth.UserID {
                        return nil, domain.ErrForbidden
                }
        }
        return d, nil
}

// Update — modifie une délégation.
//
// Règles :
//   - GERANT (principal ou co-GERANT) ou SUPER_ADMIN seulement
//   - La délégation doit appartenir à l'entreprise de l'auth (RLS enforced)
//   - Si toUserId change, on vérifie que le nouveau user existe et appartient à l'entreprise
//   - Si permissions change, on valide le niveau
func (uc *Usecase) Update(ctx context.Context, auth *database.AuthUser, id string, in UpdateInput) (*model.Delegation, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if !isGerantOrCo(auth) && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }

        // Vérifie que la délégation existe (et est dans le tenant de l'auth)
        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("delegation.Update: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }
        // On ne peut update que les délégations ACTIVES
        if existing.Statut != model.DelegationStatutActif {
                return nil, fmt.Errorf("%w: cannot update a delegation with statut %s", domain.ErrBadRequest, existing.Statut)
        }

        updates := map[string]any{}
        if in.ToUserID != nil {
                v := strings.TrimSpace(*in.ToUserID)
                if v == "" {
                        return nil, fmt.Errorf("%w: toUserId cannot be empty", domain.ErrBadRequest)
                }
                if v != existing.ToUserID {
                        // Vérifie le nouveau user
                        toUser, err := uc.repo.GetUserByID(ctx, v)
                        if err != nil {
                                uc.log.Error("delegation.Update: GetUserByID", "err", err)
                                return nil, domain.ErrInternal
                        }
                        if toUser == nil {
                                return nil, domain.ErrNotFound
                        }
                        if toUser.EntrepriseID == nil || *toUser.EntrepriseID != existing.EntrepriseID {
                                return nil, domain.ErrForbidden
                        }
                        if toUser.IsGerant() {
                                return nil, fmt.Errorf("%w: target user is already a GERANT or co-GERANT", domain.ErrBadRequest)
                        }
                        // Vérifie qu'il n'y a pas déjà une délégation active pour ce nouveau user+domain
                        dup, err := uc.repo.GetActive(ctx, v, existing.Domain, existing.EntrepriseID)
                        if err != nil {
                                uc.log.Error("delegation.Update: GetActive", "err", err)
                                return nil, domain.ErrInternal
                        }
                        if dup != nil && dup.ID != existing.ID {
                                return nil, fmt.Errorf("%w: an active delegation already exists for this user+domain", domain.ErrConflict)
                        }
                }
                updates["toUserId"] = v
        }
        if in.Permissions != nil {
                v := strings.TrimSpace(*in.Permissions)
                if !isValidPerm(v) {
                        return nil, fmt.Errorf("%w: invalid permissions %q", domain.ErrBadRequest, v)
                }
                updates["permissions"] = v
        }
        if in.ExpiresLe != nil {
                if in.ExpiresLe.Before(time.Now().UTC()) {
                        return nil, fmt.Errorf("%w: expiresLe must be in the future", domain.ErrBadRequest)
                }
                updates["expiresLe"] = in.ExpiresLe
        }
        if in.Raison != nil {
                updates["raison"] = in.Raison
        }

        if len(updates) == 0 {
                return existing, nil
        }

        updated, err := uc.repo.Update(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("delegation.Update: repo.Update", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        uc.log.Info("delegation updated", "id", id, "by", auth.UserID, "fields", keysOf(updates))
        return updated, nil
}

// Revoke — révoque une délégation (statut=REVOCQUE).
//
// Règles :
//   - SUPER_ADMIN : peut révoquer n'importe quelle délégation
//   - GERANT/co-GERANT : peut révoquer les délégations de SON entreprise (RLS enforced)
//   - Autres : peuvent révoquer leurs propres délégations (toUserId == auth.UserID)
//     — c'est-à-dire "renoncer" à une délégation
func (uc *Usecase) Revoke(ctx context.Context, auth *database.AuthUser, id string) (*model.Delegation, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }

        existing, err := uc.repo.GetByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("delegation.Revoke: GetByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if existing == nil {
                return nil, domain.ErrNotFound
        }
        // Autorisation pour les non-GERANT/non-SUPER_ADMIN :
        // ils peuvent seulement révoquer leurs propres délégations reçues.
        if auth.Role != "SUPER_ADMIN" && !isGerantOrCo(auth) {
                if existing.ToUserID != auth.UserID {
                        return nil, domain.ErrForbidden
                }
        }

        updated, err := uc.repo.Revoke(ctx, auth, id)
        if err != nil {
                uc.log.Error("delegation.Revoke: repo.Revoke", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }
        uc.log.Info("delegation revoked", "id", id, "by", auth.UserID)
        return updated, nil
}

// ListMyDelegations — délégations reçues par le user courant.
// Accessible à tous les utilisateurs authentifiés (chacun voit ses propres délégations).
func (uc *Usecase) ListMyDelegations(ctx context.Context, auth *database.AuthUser) ([]model.Delegation, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        items, err := uc.repo.ListMyDelegations(ctx, auth)
        if err != nil {
                uc.log.Error("delegation.ListMyDelegations", "err", err, "auth", auth.UserID)
                return nil, domain.ErrInternal
        }
        return items, nil
}

// ── Co-GERANTS management ───────────────────────────────────────────

// PromoteCoGerant — promeut un user en co-GERANT.
//
// Règles STRICTES :
//   - Seul le principal GERANT (role == "GERANT", isCoGerant == false) peut promote.
//     Les co-GERANTS ne peuvent PAS promote (sinon escalation infinie).
//   - SUPER_ADMIN est autorisé (plateforme admin).
//   - Max 2 co-GERANTS par entreprise (model.MaxCoGerants).
//   - Le user ciblé doit appartenir à la même entreprise que l'auth.
//   - Le user ciblé ne doit pas déjà être GERANT (principal ou co).
//   - Le user ciblé ne doit pas être SUPER_ADMIN.
func (uc *Usecase) PromoteCoGerant(ctx context.Context, auth *database.AuthUser, userID string) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        // Seul le principal GERANT ou SUPER_ADMIN peut promote
        if !isPrincipalGerant(auth) && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        userID = strings.TrimSpace(userID)
        if userID == "" {
                return nil, domain.ErrBadRequest
        }
        if userID == auth.UserID {
                return nil, fmt.Errorf("%w: cannot promote yourself", domain.ErrBadRequest)
        }
        if auth.EntrepriseID == "" {
                return nil, fmt.Errorf("%w: auth has no entrepriseId", domain.ErrBadRequest)
        }

        // Vérifie le user ciblé
        target, err := uc.repo.GetUserByID(ctx, userID)
        if err != nil {
                uc.log.Error("delegation.PromoteCoGerant: GetUserByID", "err", err, "target", userID)
                return nil, domain.ErrInternal
        }
        if target == nil {
                return nil, domain.ErrNotFound
        }
        // Same entreprise check
        if target.EntrepriseID == nil || *target.EntrepriseID != auth.EntrepriseID {
                return nil, domain.ErrForbidden
        }
        // Un SUPER_ADMIN ne peut pas être promu
        if target.Role == "SUPER_ADMIN" {
                return nil, fmt.Errorf("%w: cannot promote a SUPER_ADMIN", domain.ErrBadRequest)
        }
        // Un GERANT principal ne peut pas être promu (il l'est déjà)
        if target.Role == "GERANT" {
                return nil, fmt.Errorf("%w: target user is already a GERANT", domain.ErrBadRequest)
        }
        // Déjà co-GERANT → idempotent (pas d'erreur, on retourne le user)
        if target.IsCoGerant {
                return target, nil
        }

        // Vérifie le quota max
        count, err := uc.repo.CountCoGerants(ctx, auth.EntrepriseID)
        if err != nil {
                uc.log.Error("delegation.PromoteCoGerant: CountCoGerants", "err", err)
                return nil, domain.ErrInternal
        }
        if count >= int64(model.MaxCoGerants) {
                return nil, fmt.Errorf("%w: max %d co-gerants per entreprise reached",
                        domain.ErrConflict, model.MaxCoGerants)
        }

        if err := uc.repo.PromoteCoGerant(ctx, userID); err != nil {
                uc.log.Error("delegation.PromoteCoGerant: repo.Promote", "err", err)
                return nil, domain.ErrInternal
        }
        // Re-fetch le user à jour
        updated, err := uc.repo.GetUserByID(ctx, userID)
        if err != nil {
                uc.log.Error("delegation.PromoteCoGerant: re-fetch", "err", err)
                return nil, domain.ErrInternal
        }
        uc.log.Info("user promoted to co-gerant",
                "target", userID, "by", auth.UserID, "ent", auth.EntrepriseID,
        )
        return updated, nil
}

// DemoteCoGerant — rétrograde un co-GERANT.
//
// Règles STRICTES :
//   - Seul le principal GERANT (role == "GERANT", isCoGerant == false) peut demote.
//     Les co-GERANTS ne peuvent PAS demote (y compris eux-mêmes).
//   - SUPER_ADMIN est autorisé.
//   - Le user ciblé doit être un co-GERANT (isCoGerant == true).
//   - Le user ciblé doit appartenir à la même entreprise que l'auth.
//   - Le user ciblé ne peut pas être le principal GERANT (role == "GERANT").
func (uc *Usecase) DemoteCoGerant(ctx context.Context, auth *database.AuthUser, userID string) (*model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if !isPrincipalGerant(auth) && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        userID = strings.TrimSpace(userID)
        if userID == "" {
                return nil, domain.ErrBadRequest
        }
        if userID == auth.UserID {
                return nil, fmt.Errorf("%w: cannot demote yourself", domain.ErrBadRequest)
        }
        if auth.EntrepriseID == "" {
                return nil, fmt.Errorf("%w: auth has no entrepriseId", domain.ErrBadRequest)
        }

        // Vérifie le user ciblé
        target, err := uc.repo.GetUserByID(ctx, userID)
        if err != nil {
                uc.log.Error("delegation.DemoteCoGerant: GetUserByID", "err", err, "target", userID)
                return nil, domain.ErrInternal
        }
        if target == nil {
                return nil, domain.ErrNotFound
        }
        if target.EntrepriseID == nil || *target.EntrepriseID != auth.EntrepriseID {
                return nil, domain.ErrForbidden
        }
        // Ne peut pas demote un SUPER_ADMIN
        if target.Role == "SUPER_ADMIN" {
                return nil, fmt.Errorf("%w: cannot demote a SUPER_ADMIN", domain.ErrBadRequest)
        }
        // Ne peut pas demote un GERANT principal (role == "GERANT")
        if target.Role == "GERANT" {
                return nil, fmt.Errorf("%w: target user is a principal GERANT, cannot demote", domain.ErrBadRequest)
        }
        // Si le user n'est pas co-GERANT → idempotent (pas d'erreur)
        if !target.IsCoGerant {
                return target, nil
        }

        if err := uc.repo.DemoteCoGerant(ctx, userID); err != nil {
                uc.log.Error("delegation.DemoteCoGerant: repo.Demote", "err", err)
                return nil, domain.ErrInternal
        }
        updated, err := uc.repo.GetUserByID(ctx, userID)
        if err != nil {
                uc.log.Error("delegation.DemoteCoGerant: re-fetch", "err", err)
                return nil, domain.ErrInternal
        }
        uc.log.Info("user demoted from co-gerant",
                "target", userID, "by", auth.UserID, "ent", auth.EntrepriseID,
        )
        return updated, nil
}

// CountCoGerants — compte les co-GERANTS dans l'entreprise de l'auth.
// GERANT (principal ou co) ou SUPER_ADMIN only.
func (uc *Usecase) CountCoGerants(ctx context.Context, auth *database.AuthUser) (int, error) {
        if auth == nil {
                return 0, domain.ErrUnauthorized
        }
        if !isGerantOrCo(auth) && auth.Role != "SUPER_ADMIN" {
                return 0, domain.ErrForbidden
        }
        if auth.EntrepriseID == "" {
                return 0, fmt.Errorf("%w: auth has no entrepriseId", domain.ErrBadRequest)
        }
        n, err := uc.repo.CountCoGerants(ctx, auth.EntrepriseID)
        if err != nil {
                uc.log.Error("delegation.CountCoGerants", "err", err)
                return 0, domain.ErrInternal
        }
        return int(n), nil
}

// ListCoGerants — liste les co-GERANTS de l'entreprise de l'auth.
// GERANT (principal ou co) ou SUPER_ADMIN only.
func (uc *Usecase) ListCoGerants(ctx context.Context, auth *database.AuthUser) ([]model.User, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if !isGerantOrCo(auth) && auth.Role != "SUPER_ADMIN" {
                return nil, domain.ErrForbidden
        }
        if auth.EntrepriseID == "" {
                return nil, fmt.Errorf("%w: auth has no entrepriseId", domain.ErrBadRequest)
        }
        users, err := uc.repo.GetCoGerants(ctx, auth.EntrepriseID)
        if err != nil {
                uc.log.Error("delegation.ListCoGerants", "err", err)
                return nil, domain.ErrInternal
        }
        return users, nil
}

// ── helpers ─────────────────────────────────────────────────────────

// keysOf retourne les clés d'un map (pour logging).
func keysOf(m map[string]any) []string {
        keys := make([]string, 0, len(m))
        for k := range m {
                keys = append(keys, k)
        }
        return keys
}
