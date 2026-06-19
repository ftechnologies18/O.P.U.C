// Package middleware — rbac.go
// Contrôle d'accès basé sur les rôles (RBAC).
package middleware

import (
	"net/http"

	"opuc/internal/delivery/http/handler"
	"opuc/internal/infrastructure/database"
)

// RequireRole retourne un middleware qui n'autorise que les rôles listés.
// Usage : router.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Get(...)
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			au := database.FromContext(r.Context())
			if au == nil {
				handler.WriteError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if _, ok := allowed[au.Role]; !ok {
				handler.WriteError(w, http.StatusForbidden, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth — alias sémantique pour juste "être authentifié" (tous rôles).
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		au := database.FromContext(r.Context())
		if au == nil {
			handler.WriteError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}
