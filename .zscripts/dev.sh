#!/bin/bash

set -euo pipefail

# O.P.U.C — dev.sh (sandbox)
# Démarre le frontend Next.js (:3000) ET le backend Go (:8080)
# Le sandbox exécute ce script au boot via /start.sh.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log_step_start() {
        local step_name="$1"
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: $step_name"
        echo "=========================================="
        export STEP_START_TIME
        STEP_START_TIME=$(date +%s)
}

log_step_end() {
        local step_name="${1:-Unknown step}"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - STEP_START_TIME))
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: $step_name"
        echo "[LOG] Step: $step_name | Duration: ${duration}s"
        echo "=========================================="
        echo ""
}

start_mini_services() {
        local mini_services_dir="$PROJECT_DIR/mini-services"
        [ ! -d "$mini_services_dir" ] && return 0

        for service_dir in "$mini_services_dir"/*; do
                [ ! -d "$service_dir" ] && continue
                local service_name
                service_name=$(basename "$service_dir")
                [ ! -f "$service_dir/package.json" ] && continue
                grep -q '"dev"' "$service_dir/package.json" || continue

                echo "Starting mini-service: $service_name"
                (
                        cd "$service_dir"
                        bun install
                        exec bun run dev
                ) >"$PROJECT_DIR/.zscripts/mini-service-${service_name}.log" 2>&1 &
                disown $! 2>/dev/null || true
        done
}

wait_for_service() {
        local host="$1" port="$2" name="$3" max="${4:-60}"
        local attempt=1
        echo "Waiting for $name on $host:$port..."
        while [ "$attempt" -le "$max" ]; do
                if curl -s --connect-timeout 2 --max-time 5 "http://$host:$port" >/dev/null 2>&1; then
                        echo "$name is ready!"
                        return 0
                fi
                echo "  attempt $attempt/$max: $name not ready..."
                sleep 1
                attempt=$((attempt + 1))
        done
        echo "ERROR: $name failed to start within $((max * 2))s"
        return 1
}

# ══════════════════════════════════════════════════════════════════
# VARIABLES D'ENV NEON (le sandbox écrase DATABASE_URL=file:...)
# Migré de Supabase vers Neon Serverless Postgres le 2026-06-19
# ══════════════════════════════════════════════════════════════════
export DATABASE_URL="${NEON_POOLED_URL}"
export DIRECT_URL="${NEON_DIRECT_URL}"
export MIGRATIONS_URL="${NEON_DIRECT_URL}"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="${JWT_SECRET}"
export JWT_SECRET="${JWT_SECRET}"
export JWT_EXPIRATION_HOURS="24"
export FRONTEND_URL="http://localhost:3000"
export APP_ENV="development"
export LOG_LEVEL="debug"
export PORT="8080"
# Cloudflare R2 (file storage)
export R2_API_TOKEN="${R2_API_TOKEN}"
export R2_ACCOUNT_ID="${R2_ACCOUNT_ID}"
export R2_BUCKET="${R2_BUCKET:-opuc-files}"
export PATH="$HOME/go-sdk/go/bin:$HOME/go/bin:$PATH"

cd "$PROJECT_DIR"

if ! command -v bun >/dev/null 2>&1; then
        echo "ERROR: bun is not installed"
        exit 1
fi

# ══════════════════════════════════════════════════════════════════
# FRONTEND (Next.js dans frontend/)
# ══════════════════════════════════════════════════════════════════
log_step_start "frontend: bun install"
cd "$PROJECT_DIR/frontend"
bun install
log_step_end "frontend: bun install"

log_step_start "frontend: prisma db push"
bun run db:push
log_step_end "frontend: prisma db push"

log_step_start "Starting Next.js dev server (port 3000)"
bun run dev &
DEV_PID=$!
log_step_end "Starting Next.js dev server"

log_step_start "Waiting for Next.js dev server"
wait_for_service "localhost" "3000" "Next.js dev server"
log_step_end "Waiting for Next.js dev server"

# ══════════════════════════════════════════════════════════════════
# BACKEND (Go dans backend/)
# ══════════════════════════════════════════════════════════════════
if command -v go >/dev/null 2>&1; then
        log_step_start "backend: go mod download"
        cd "$PROJECT_DIR/backend"
        go mod download 2>&1 || echo "[BACKEND] WARN: go mod download issue"
        log_step_end "backend: go mod download"

        log_step_start "Starting Go backend (port 8080)"
        go run . &
        BACKEND_PID=$!
        log_step_end "Starting Go backend"

        log_step_start "Waiting for Go backend"
        wait_for_service "localhost" "8080" "Go backend API" 30 || echo "[BACKEND] WARN: health check failed (server may still be starting)"
        log_step_end "Waiting for Go backend"
else
        echo "[BACKEND] Go not in PATH, skipping backend"
fi

start_mini_services

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  O.P.U.C — Services started"
echo "══════════════════════════════════════════════════════════════"
echo "  Frontend (Next.js) : http://localhost:3000  (PID: $DEV_PID)"
[ -n "${BACKEND_PID:-}" ] && echo "  Backend  (Go)      : http://localhost:8080  (PID: $BACKEND_PID)"
echo "  API Go (proxy)     : http://localhost:3000/api/v1/*"
echo "══════════════════════════════════════════════════════════════"
echo ""

disown "$DEV_PID" 2>/dev/null || true
disown "${BACKEND_PID:-}" 2>/dev/null || true
unset DEV_PID BACKEND_PID
