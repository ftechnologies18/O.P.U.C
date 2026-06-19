package domain

import "errors"

// Erreurs domaine réutilisables. Les handlers HTTP les mappent vers des codes HTTP.
var (
	// ErrNotFound — ressource introuvable (404)
	ErrNotFound = errors.New("resource not found")

	// ErrUnauthorized — authentification requise ou invalide (401)
	ErrUnauthorized = errors.New("unauthorized")

	// ErrForbidden — authentifié mais droits insuffisants (403)
	ErrForbidden = errors.New("forbidden")

	// ErrBadRequest — payload invalide (400)
	ErrBadRequest = errors.New("bad request")

	// ErrConflict — conflit (ex: email déjà utilisé) (409)
	ErrConflict = errors.New("conflict")

	// ErrInvalidCredentials — email/password incorrect (401)
	ErrInvalidCredentials = errors.New("invalid credentials")

	// ErrAccountLocked — trop de tentatives de login (423)
	ErrAccountLocked = errors.New("account locked")

	// Err2FARequired — 2FA nécessaire pour compléter l'auth (200 avec flag)
	Err2FARequired = errors.New("2fa required")

	// ErrInvalid2FACode — code TOTP invalide (401)
	ErrInvalid2FACode = errors.New("invalid 2fa code")

	// ErrInternal — erreur interne non classée (500)
	ErrInternal = errors.New("internal error")
)

// IsNotFound helper
func IsNotFound(err error) bool { return errors.Is(err, ErrNotFound) }

// IsUnauthorized helper
func IsUnauthorized(err error) bool { return errors.Is(err, ErrUnauthorized) }

// IsForbidden helper
func IsForbidden(err error) bool { return errors.Is(err, ErrForbidden) }

// IsBadRequest helper
func IsBadRequest(err error) bool { return errors.Is(err, ErrBadRequest) }

// IsConflict helper
func IsConflict(err error) bool { return errors.Is(err, ErrConflict) }
