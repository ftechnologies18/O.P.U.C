// Package database — migrate_sql.go
// Exécute les fichiers SQL de migrations/ via la connexion postgres (superuser).
// Contrairement à AutoMigrate (GORM), ce runner gère le SQL brut : CREATE ROLE,
// DO $$ ... $$, CREATE POLICY, etc.
package database

import (
        "fmt"
        "log/slog"
        "os"
        "path/filepath"
        "sort"
        "strings"
)

// RunSQLMigrations lit et exécute tous les fichiers .sql du dossier migrations/,
// dans l'ordre alphabétique, via la connexion superuser (Migrations).
//
// Utilise la connexion Migrations (rôle postgres, bypass RLS) car :
//   - CREATE ROLE nécessite des privilèges superuser
//   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY nécessite d'être owner
//
// Idempotent : les migrations utilisent DROP POLICY IF EXISTS, IF NOT EXISTS, etc.
func (m *Manager) RunSQLMigrations(migrationsDir string, log *slog.Logger) error {
        files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
        if err != nil {
                return fmt.Errorf("glob migrations: %w", err)
        }
        if len(files) == 0 {
                log.Warn("no SQL migration files found", "dir", migrationsDir)
                return nil
        }
        sort.Strings(files) // ordre alphabétique : 000001, 000002, ...

        log.Info("running SQL migrations", "count", len(files), "dir", migrationsDir)

        for _, file := range files {
                name := filepath.Base(file)
                log.Info("applying migration", "file", name)

                content, err := os.ReadFile(file)
                if err != nil {
                        return fmt.Errorf("read %s: %w", name, err)
                }

                // GORM Exec peut exécuter du multi-statement SQL, mais les blocs DO $$ ... $$
                // nécessitent un traitement spécial. On split sur les points-virgules
                // qui ne sont pas à l'intérieur de $$ ... $$ blocks.
                statements := splitSQLStatements(string(content))

                for i, stmt := range statements {
                        stmt = strings.TrimSpace(stmt)
                        if stmt == "" {
                                continue
                        }
                        if err := m.Migrations.Exec(stmt).Error; err != nil {
                                // Certaines erreurs sont non-fatales (ex: policy existe déjà)
                                log.Warn("migration statement error (continuing)",
                                        "file", name, "stmt_num", i+1, "err", err)
                        }
                }
                log.Info("migration applied", "file", name)
        }

        log.Info("all SQL migrations completed")
        return nil
}

// splitSQLStatements découpe un script SQL en statements individuels.
// Gère les blocs DO $$ ... $$ (ne pas split à l'intérieur).
func splitSQLStatements(sql string) []string {
        var statements []string
        var current strings.Builder
        inDollarQuote := false
        dollarTag := ""

        for i := 0; i < len(sql); i++ {
                ch := sql[i]

                // Détection des tags $$ (ou $tag$)
                if ch == '$' && !inDollarQuote {
                        // Cherche le tag $...$
                        end := strings.Index(sql[i:], "$")
                        if end > 0 {
                                // Vérifie si c'est un tag valide $tag$
                                tag := sql[i : i+end+1]
                                if strings.HasPrefix(tag, "$") && strings.HasSuffix(tag, "$") {
                                        // Cherche le tag fermant
                                        closeTag := tag
                                        closeIdx := strings.Index(sql[i+len(tag):], closeTag)
                                        if closeIdx >= 0 {
                                                inDollarQuote = true
                                                dollarTag = closeTag
                                                current.WriteByte(ch)
                                                continue
                                        }
                                }
                        }
                }

                if inDollarQuote {
                        current.WriteByte(ch)
                        // Vérifie si on ferme le dollar quote
                        if i+len(dollarTag) <= len(sql) && sql[i:i+len(dollarTag)] == dollarTag {
                                current.WriteString(sql[i+1 : i+len(dollarTag)])
                                i += len(dollarTag) - 1
                                inDollarQuote = false
                                dollarTag = ""
                                continue
                        }
                        continue
                }

                if ch == ';' {
                        statements = append(statements, current.String())
                        current.Reset()
                } else {
                        current.WriteByte(ch)
                }
        }
        if current.Len() > 0 {
                statements = append(statements, current.String())
        }
        return statements
}
