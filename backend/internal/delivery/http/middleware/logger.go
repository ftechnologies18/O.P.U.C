// Package middleware — logger.go
// Log structuré de chaque requête HTTP (slog).
package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"opuc/internal/delivery/http/handler"
)

// Logger — log structuré de chaque requête (slog).
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := &statusWriter{ResponseWriter: w, status: 200}
			next.ServeHTTP(ww, r)
			log.Info("http",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.status,
				"dur_ms", time.Since(start).Milliseconds(),
				"ip", r.RemoteAddr,
			)
		})
	}
}

// Recover — capte les panics, log + 500 propre (pas de stack trace au client).
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic recovered",
						"err", rec,
						"path", r.URL.Path,
						"stack", string(debug.Stack()),
					)
					handler.WriteError(w, http.StatusInternalServerError, "internal error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// RequestID — ajoute un X-Request-ID unique par requête.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-ID")
		if rid == "" {
			rid = uuid()
		}
		w.Header().Set("X-Request-ID", rid)
		next.ServeHTTP(w, r)
	})
}

// statusWriter capture le status code pour le logging.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
