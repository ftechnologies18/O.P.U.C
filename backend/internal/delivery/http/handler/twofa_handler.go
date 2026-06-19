// Package handler — twofa_handler.go
// Handlers HTTP pour /api/v1/auth/2fa/* (Setup, Verify, Disable).
//
// Toutes les routes sont auth-required (middleware.Auth appliqué au niveau router).
// Le userID est extrait du JWT (auth context) — l'utilisateur opère sur LUI-MÊME
// uniquement, jamais sur un autre user (pas de cross-tenant possible).
//
// Flux frontend typique :
//   1. POST /api/v1/auth/2fa/setup   → reçoit {secret, qrUrl}
//   2. Affiche le QR code (qrcode lib) + le secret en fallback
//   3. L'utilisateur scanne avec Google Authenticator / Authy / 1Password
//   4. POST /api/v1/auth/2fa/verify  {code: "123456"} → 200 OK (2FA activée)
//   5. Au prochain login : POST /api/v1/auth/login renvoie twoFARequired=true
//      → le frontend demande le code, appelle /api/v1/auth/2fa/verify
//   6. POST /api/v1/auth/2fa/disable {password: "..."} → 200 OK (2FA désactivée)
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"opuc/internal/delivery/http/dto"
	"opuc/internal/domain"
	"opuc/internal/usecase/auth"
)

// TwoFAHandler — handlers HTTP pour /api/v1/auth/2fa/*.
type TwoFAHandler struct {
	uc  *auth.Usecase
	log *slog.Logger
}

// NewTwoFAHandler constructeur.
func NewTwoFAHandler(uc *auth.Usecase, log *slog.Logger) *TwoFAHandler {
	return &TwoFAHandler{uc: uc, log: log}
}

// Setup — POST /api/v1/auth/2fa/setup
// Genère un secret TOTP + URL otpauth, sauve le secret sur le user
// (twoFactorEnabled reste false jusqu'à Verify).
//
// Response 200 : {secret, qrUrl}
// Response 401 : non authentifié
// Response 404 : user introuvable (cas anormal, JWT valide mais user supprimé)
func (h *TwoFAHandler) Setup(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	secret, qrURL, err := h.uc.Setup2FA(r.Context(), au.UserID)
	if err != nil {
		h.write2FAError(w, "2fa.Setup", err)
		return
	}

	WriteJSON(w, http.StatusOK, dto.TwoFASetupResponse{
		Secret: secret,
		QrURL:  qrURL,
	})
}

// Verify — POST /api/v1/auth/2fa/verify
// Body : {code: "123456"}
// Valide le code TOTP, set twoFactorEnabled=true.
//
// Response 200 : {ok: true}
// Response 400 : code manquant / pas de secret set
// Response 401 : code invalide
//
// NOTE importante sur le middleware Auth :
//   - Cette route est dans la liste is2FAPath() du middleware → accessible même
//     si le JWT a TwoFAVerified=false (login pending 2FA).
//   - Mais Setup/Disable nécessitent TwoFAVerified=true (cas d'usage : configurer
//     la 2FA quand on est déjà loggé sans 2FA, OU désactiver en connaissant le
//     password). Ces routes ne sont PAS dans is2FAPath → 403 si 2FA non vérifiée.
//   - Verify EST dans is2FAPath (login pending 2FA).
func (h *TwoFAHandler) Verify(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req dto.TwoFAVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Code == "" {
		WriteError(w, http.StatusBadRequest, "code is required")
		return
	}

	if err := h.uc.Verify2FA(r.Context(), au.UserID, req.Code); err != nil {
		h.write2FAError(w, "2fa.Verify", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "twoFactorEnabled": true})
}

// Disable — POST /api/v1/auth/2fa/disable
// Body : {password: "..."}
// Vérifie le password, set twoFactorEnabled=false + clear secret.
//
// Response 200 : {ok: true}
// Response 400 : 2FA pas activée / password manquant
// Response 401 : password invalide
func (h *TwoFAHandler) Disable(w http.ResponseWriter, r *http.Request) {
	au := authUserFromCtx(r.Context())
	if au == nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req dto.TwoFADisableRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Password == "" {
		WriteError(w, http.StatusBadRequest, "password is required")
		return
	}

	if err := h.uc.Disable2FA(r.Context(), au.UserID, req.Password); err != nil {
		h.write2FAError(w, "2fa.Disable", err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "twoFactorEnabled": false})
}

// ── helpers ────────────────────────────────────────────────────

// write2FAError mappe les erreurs domain → HTTP status pour les handlers 2FA.
func (h *TwoFAHandler) write2FAError(w http.ResponseWriter, op string, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteError(w, http.StatusNotFound, "user not found")
	case errors.Is(err, domain.ErrInvalid2FACode):
		h.log.Warn(op, "err", err)
		WriteError(w, http.StatusUnauthorized, "invalid 2FA code")
	case errors.Is(err, domain.ErrInvalidCredentials):
		h.log.Warn(op, "err", err)
		WriteError(w, http.StatusUnauthorized, "invalid password")
	case errors.Is(err, domain.ErrBadRequest):
		WriteError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrInternal):
		h.log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	default:
		h.log.Error(op, "err", err)
		WriteError(w, http.StatusInternalServerError, "internal error")
	}
}
