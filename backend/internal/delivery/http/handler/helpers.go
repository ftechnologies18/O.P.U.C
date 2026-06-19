// Package handler — helpers + health_handler.go
package handler

import (
        "context"
        "encoding/json"
        "errors"
        "net/http"
        "time"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/infrastructure/database"
)

// WriteJSON écrit une réponse JSON avec le status code donné.
func WriteJSON(w http.ResponseWriter, status int, v any) {
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(status)
        _ = json.NewEncoder(w).Encode(v)
}

// WriteError écrit une ErrorResponse.
func WriteError(w http.ResponseWriter, status int, msg string) {
        WriteJSON(w, status, dto.ErrorResponse{Error: msg})
}

// authUserFromCtx extrait l'AuthUser du context (injecté par middleware auth).
func authUserFromCtx(ctx context.Context) *database.AuthUser {
        return database.FromContext(ctx)
}

// clientIPFromRequest extrait l'IP client (X-Forwarded-For ou RemoteAddr).
func clientIPFromRequest(r *http.Request) string {
        if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
                return xff
        }
        if xri := r.Header.Get("X-Real-IP"); xri != "" {
                return xri
        }
        return r.RemoteAddr
}

// parseDate tries several common date formats used by the API.
// Accepts RFC3339 ("2025-01-30T00:00:00Z") and date-only ("2025-01-30").
// Returns zero time + error if parsing fails.
func parseDate(s string) (time.Time, error) {
        if s == "" {
                return time.Time{}, errors.New("empty date")
        }
        if t, err := time.Parse(time.RFC3339, s); err == nil {
                return t, nil
        }
        if t, err := time.Parse("2006-01-02", s); err == nil {
                return t, nil
        }
        return time.Time{}, errors.New("invalid date format (use RFC3339 or YYYY-MM-DD)")
}

// parseDatePtr — like parseDate but returns a *time.Time (nil if string is empty).
func parseDatePtr(s string) (*time.Time, error) {
        if s == "" {
                return nil, nil
        }
        t, err := parseDate(s)
        if err != nil {
                return nil, err
        }
        return &t, nil
}

// derefStr returns *s value or "" if s is nil. Useful for optional string fields
// when passing to a string-typed helper.
func derefStr(s *string) string {
        if s == nil {
                return ""
        }
        return *s
}

// HealthHandler — GET /api/v1/health
type HealthHandler struct{}

func NewHealthHandler() *HealthHandler { return &HealthHandler{} }

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
        WriteJSON(w, http.StatusOK, dto.HealthResponse{
                Status:  "ok",
                Service: "opuc-api",
                Version: "0.1.0",
                Time:    time.Now().UTC().Format(time.RFC3339),
        })
}
