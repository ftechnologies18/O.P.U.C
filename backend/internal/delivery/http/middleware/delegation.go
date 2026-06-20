// Package middleware — delegation.go
// Middleware RequireAccess : combine vérification de rôle + délégation.
//
// Hiérarchie d'accès :
//   1. SUPER_ADMIN            → toujours autorisé (plateforme admin)
//   2. GERANT ou co-GERANT    → toujours autorisé (full access)
//   3. User avec délégation active pour le domaine (permission level suffisant) → autorisé
//   4. Rôles avec accès baseline (cf. hasRoleAccess) → autorisé selon le niveau
//   5. Sinon → 403
//
// Le middleware accepte une interface DelegationChecker (et non le repo concret)
// pour faciliter les tests et découpler la couche HTTP du repo GORM.
package middleware

import (
        "context"
        "net/http"

        "opuc/internal/delivery/http/handler"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// DelegationChecker — interface requise par RequireAccess.
// Implémentée par *gorm.DelegationRepository.
type DelegationChecker interface {
        GetActive(ctx context.Context, userID, domain, entrepriseID string) (*model.Delegation, error)
}

// RequireAccess retourne un middleware qui autorise l'accès selon la hiérarchie :
// SUPER_ADMIN, GERANT (ou co-GERANT), délégation active, ou accès baseline par rôle.
//
// Paramètres :
//   - domain : un des model.DomainFinance / DomainRH / DomainLogistique /
//              DomainCommercial / DomainChantier / DomainDocuments
//   - level  : un des model.PermLecture / PermEcriture / PermGestion
//   - delRepo : repo DelegationChecker (peut être nil → skip le check de délégation,
//               fallback sur rôle uniquement)
func RequireAccess(domain, level string, delRepo DelegationChecker) func(http.Handler) http.Handler {
        return func(next http.Handler) http.Handler {
                return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                        au := database.FromContext(r.Context())
                        if au == nil {
                                handler.WriteError(w, http.StatusUnauthorized, "unauthorized")
                                return
                        }

                        // 1. SUPER_ADMIN → toujours allow (plateforme admin)
                        if au.Role == "SUPER_ADMIN" {
                                next.ServeHTTP(w, r)
                                return
                        }

                        // 2. GERANT ou co-GERANT → always allow (full access)
                        if au.Role == "GERANT" || au.IsCoGerant {
                                next.ServeHTTP(w, r)
                                return
                        }

                        // 3. Check delegation active for the domain
                        if delRepo != nil && au.UserID != "" && au.EntrepriseID != "" {
                                delegation, err := delRepo.GetActive(r.Context(), au.UserID, domain, au.EntrepriseID)
                                if err == nil && delegation != nil {
                                        if model.PermLevel(delegation.Permissions) >= model.PermLevel(level) {
                                                next.ServeHTTP(w, r)
                                                return
                                        }
                                }
                        }

                        // 4. Fallback : accès baseline par rôle (ex: CHEF_PROJET peut faire du pointage)
                        if hasRoleAccess(au.Role, domain, level) {
                                next.ServeHTTP(w, r)
                                return
                        }

                        // 5. Aucun accès → 403
                        handler.WriteError(w, http.StatusForbidden,
                                "insufficient permissions — no delegation for "+domain)
                })
        }
}

// hasRoleAccess définit les accès baseline par rôle (sans délégation explicite).
//
// CHEF_PROJET a accès opérationnel aux domaines CHANTIER, LOGISTIQUE, COMMERCIAL,
// DOCUMENTS (full = GESTION), et accès limité à RH (ECRITURE max : pointage mais
// pas de gestion de la paie).
//
// EMPLOYE a accès lecture seule à tous les domaines (LECTURE max).
// (Phase 1 : SOUS_TRAITANT a été renommé EMPLOYE — on garde le case legacy
// le temps de la migration des données.)
//
// Ces règles préservent la compatibilité avec le RBAC existant : un CHEF_PROJET
// peut toujours faire son travail quotidien sans avoir besoin d'une délégation
// explicite, mais le GERANT peut étendre ses droits via une délégation GESTION
// (par exemple pour qu'il puisse gérer la paie).
func hasRoleAccess(role, domain, level string) bool {
        switch role {
        case "CHEF_PROJET":
                switch domain {
                case model.DomainChantier, model.DomainLogistique,
                        model.DomainCommercial, model.DomainDocuments:
                        return true // full access (LECTURE + ECRITURE + GESTION)
                case model.DomainRH:
                        // Can create pointage (ECRITURE) but not manage paie (GESTION)
                        return model.PermLevel(level) <= model.PermLevel(model.PermEcriture)
                }
        case "EMPLOYE", "SOUS_TRAITANT": // SOUS_TRAITANT = legacy, à retirer après migration
                // Read-only access to all domains
                return model.PermLevel(level) <= model.PermLevel(model.PermLecture)
        }
        return false
}
