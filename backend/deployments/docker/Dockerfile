# ══════════════════════════════════════════════════════════════════
# O.P.U.C Backend API — Dockerfile multi-stage (Cloud Run compatible)
# ══════════════════════════════════════════════════════════════════
# Build : docker build -t opuc-api .
# Run   : docker run -p 8080:8080 --env-file .env opuc-api
#
# Cloud Run : injecte automatiquement PORT (8080) et TERM
# Le binaire Go lit process.env.PORT avec fallback 8080 (voir config.go)
# ══════════════════════════════════════════════════════════════════

# ── Stage 1 : build ─────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Cache des deps : copier go.mod/go.sum avant le code
COPY go.mod go.sum ./
RUN go mod download

# Copier le code et compiler
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.version=0.1.0" \
    -o /opuc-api .

# ── Stage 2 : runtime (Alpine minimal) ──────────────────────────
FROM alpine:3.20

# Certs root pour TLS (Neon HTTPS, Cloudflare R2 HTTPS)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /opuc-api /app/opuc-api

# User non-root (Cloud Run exige UID >= 1000)
RUN adduser -D -u 10001 appuser
USER appuser

# Cloud Run injecte PORT=8080 — le binaire lit process.env.PORT
EXPOSE 8080

# Graceful shutdown : Cloud Run envoie SIGTERM (15s grace period)
ENTRYPOINT ["/app/opuc-api"]
