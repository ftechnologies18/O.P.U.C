# ══════════════════════════════════════════════════════════════════
# O.P.U.C Backend API — Makefile
# ══════════════════════════════════════════════════════════════════

GO        := go
BINARY    := bin/opuc-api
PORT      := 8080

.PHONY: all dev run build test lint clean migrate-rls tidy help

## all : cible par défaut = build
all: build

## dev : lance le serveur en mode dev (hot reload via go run)
dev:
	$(GO) run . 

## run : lance le binaire préalablement buildé
run: build
	./$(BINARY)

## build : compile le binaire
build:
	mkdir -p bin
	$(GO) build -ldflags "-s -w -X main.version=0.1.0" -o $(BINARY) .

## test : lance les tests
test:
	$(GO) test -v -race -cover ./...

## lint : vérifie le code (golangci-lint si dispo, sinon go vet)
lint:
	@command -v golangci-lint >/dev/null 2>&1 && golangci-lint run ./... || $(GO) vet ./...

## migrate-rls : applique les migrations RLS sur Supabase (rôle postgres)
migrate-rls:
	@echo "→ Application des migrations RLS sur Supabase..."
	@for f in migrations/*.sql; do \
		echo "  ↳ $$f"; \
		PGPASSWORD="$(shell grep MIGRATIONS_URL .env 2>/dev/null | sed 's/.*:[^:]*@//' | sed 's|/.*||' | sed 's/.*://;s/@.*//' )" psql "$$(grep MIGRATIONS_URL .env 2>/dev/null | cut -d= -f2- | tr -d '"')" -f "$$f" || true; \
	done
	@echo "✓ Migrations RLS appliquées (vérifiez la sortie pour les erreurs)"

## tidy : go mod tidy
tidy:
	$(GO) mod tidy

## clean : nettoie les artefacts
clean:
	rm -rf bin

## help : liste les cibles
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':' | sed 's/^/  /'
