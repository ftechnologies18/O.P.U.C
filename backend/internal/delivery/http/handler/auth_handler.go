// Package handler — auth_handler.go
// Handlers HTTP pour /api/v1/auth/*.
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	appjwt "opuc/internal/infrastructure/jwt"
	"opuc/internal/usecase/auth"
)

// AuthHandler gère les routes /auth/*.
type AuthHandler struct {
	uc     *auth.Usecase
	signer *appjwt.Signer
	log    *slog.Logger
}

func NewAuthHandler(uc *auth.Usecase, signer *appjwt.Signer, log *slog.Logger) *AuthHandler {
	return &AuthHandler{uc: uc, signer: signer, log: log}
}

// Login — POST /api/v1/auth/login
// Body: { "email": "...", "password": "..." }
// Set cookie httpOnly opuc_session + retourne le user.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Email == "" || req.Password == "" {
		WriteError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	clientIP := clientIPFromRequest(r)
	out, err := h.uc.Login(r.Context(), auth.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	}, clientIP)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidCredentials):
			WriteError(w, http.StatusUnauthorized, "invalid email or password")
		case errors.Is(err, domain.ErrAccountLocked):
			WriteError(w, http.StatusLocked, "account temporarily locked, try later")
		default:
			h.log.Error("login internal", "err", err)
			WriteError(w, http.StatusInternalServerError, "internal error")
		}
		return
	}

	// Set httpOnly cookie (sécurité anti-XSS : le JS ne peut pas le lire)
	http.SetCookie(w, &http.Cookie{
		Name:     "opuc_session",
		Value:    out.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.TLS != nil, // HTTPS en prod
		SameSite: http.SameSiteLaxMode,
		MaxAge:   out.ExpiresIn,
	})

	userJSON, _ := json.Marshal(out.User)
	WriteJSON(w, http.StatusOK, dto.LoginResponse{
		User:          userJSON,
		TwoFARequired: out.TwoFARequired,
		TwoFAVerified: out.TwoFAVerified,
		ExpiresIn:     out.ExpiresIn,
	})
}

// Logout — POST /api/v1/auth/logout
// Invalide le cookie côté client (JWT stateless, pas de blacklist serveur en Phase 0).
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "opuc_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1, // supprime le cookie
	})
	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// Me — GET /api/v1/auth/me
// Retourne le user courant (depuis le JWT validé par middleware).
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.uc.GetCurrentUser(r.Context(), au.UserID)
	if err != nil {
		h.log.Error("me: FindByID", "err", err, "uid", au.UserID)
		WriteError(w, http.StatusInternalServerError, "internal error")
		return
	}

	WriteJSON(w, http.StatusOK, dto.MeResponse{
		ID:           user.ID,
		Email:        user.Email,
		Name:         user.Name,
		Role:         user.Role,
		Telephone:    user.Telephone,
		Active:       user.Active,
		EntrepriseID: user.EntrepriseID,
		TwoFAEnabled: user.TwoFactorEnabled,
	})
}
