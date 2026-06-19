// Package middleware — auth.go
// Valide le JWT cookie et injecte l'AuthUser dans le context.
package middleware

import (
        "context"
        "net/http"

        "opuc/internal/delivery/http/handler"
        "opuc/internal/infrastructure/database"
        appjwt "opuc/internal/infrastructure/jwt"
)

// CookieName — nom du cookie de session.
const CookieName = "opuc_session"

// Auth — middleware d'authentification.
// Lit le cookie opuc_session, valide le JWT, injecte AuthUser dans le context.
func Auth(signer *appjwt.Signer) func(http.Handler) http.Handler {
        return func(next http.Handler) http.Handler {
                return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                        c, err := r.Cookie(CookieName)
                        if err != nil {
                                handler.WriteError(w, http.StatusUnauthorized, "missing session cookie")
                                return
                        }

                        claims, err := signer.Verify(c.Value)
                        if err != nil {
                                handler.WriteError(w, http.StatusUnauthorized, "invalid or expired session")
                                return
                        }

                        // Si 2FA activée mais pas encore vérifiée → n'autorise que /auth/2fa/*
                        if claims.TwoFAVerified == false && !is2FAPath(r.URL.Path) {
                                handler.WriteError(w, http.StatusForbidden, "2FA verification required")
                                return
                        }

                        au := &database.AuthUser{
                                UserID:        claims.UserID,
                                Email:         claims.Email,
                                Role:          claims.Role,
                                EntrepriseID:  claims.EntrepriseID,
                                TwoFAVerified: claims.TwoFAVerified,
                        }
                        ctx := context.WithValue(r.Context(), database.CtxUserKey, au)
                        next.ServeHTTP(w, r.WithContext(ctx))
                })
        }
}

// is2FAPath retourne true pour les routes accessibles sans 2FA vérifiée.
// Ces routes sont les seules accessibles avec un JWT "pending 2FA" (login flow).
func is2FAPath(path string) bool {
        return path == "/api/v1/auth/2fa/verify" ||
                path == "/api/v1/auth/logout"
}
