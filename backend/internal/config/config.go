// Package config charge la configuration depuis les variables d'environnement.
// Pattern 12-factor : toute config vient de l'env, jamais hardcodée.
package config

import (
        "fmt"
        "log/slog"
        "os"
        "strconv"

        "github.com/joho/godotenv"
)

// Config contient toute la configuration de l'application.
type Config struct {
        // ── Serveur HTTP ────────────────────────────────────────────
        Port string `env:"PORT" envDefault:"8080"`
        Env  string `env:"APP_ENV" envDefault:"development"`

        // ── Base de données ─────────────────────────────────────────
        // DatabaseURL : connexion runtime (rôle app_user, RLS appliquée)
        DatabaseURL string `env:"DATABASE_URL,required"`
        // MigrationsURL : connexion admin (rôle postgres, bypass RLS)
        MigrationsURL string `env:"MIGRATIONS_URL,required"`

        // ── JWT ─────────────────────────────────────────────────────
        JWTSecret          string `env:"JWT_SECRET,required"`
        JWTExpirationHours int    `env:"JWT_EXPIRATION_HOURS" envDefault:"24"`

        // ── CORS (frontend) ────────────────────────────────────────
        FrontendURL string `env:"FRONTEND_URL" envDefault:"http://localhost:3000"`

        // ── Cloudflare R2 (file storage) ───────────────────────────
        R2APIToken  string `env:"R2_API_TOKEN"`         // token Cloudflare (cfat_...)
        R2AccountID string `env:"R2_ACCOUNT_ID"`        // account ID Cloudflare
        R2Bucket    string `env:"R2_BUCKET" envDefault:"opuc-files"`

        // ── Logging ─────────────────────────────────────────────────
        LogLevel string `env:"LOG_LEVEL" envDefault:"info"`
}

// Load charge le .env (si présent) puis parse les variables d'environnement.
// En production (Cloudflare Workers / Docker), .env n'existe pas : on lit directement l'env.
func Load() (*Config, error) {
        // godotenv ne fait rien si le fichier n'existe pas (safe en prod)
        _ = godotenv.Load(".env", "../.env")

        cfg := &Config{
                Port:              getEnv("PORT", "8080"),
                Env:               getEnv("APP_ENV", "development"),
                DatabaseURL:       getEnv("DATABASE_URL", ""),
                MigrationsURL:     getEnv("MIGRATIONS_URL", ""),
                JWTSecret:         getEnv("JWT_SECRET", ""),
                JWTExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),
                FrontendURL:       getEnv("FRONTEND_URL", "http://localhost:3000"),
                R2APIToken:        getEnv("R2_API_TOKEN", ""),
                R2AccountID:       getEnv("R2_ACCOUNT_ID", ""),
                R2Bucket:          getEnv("R2_BUCKET", "opuc-files"),
                LogLevel:          getEnv("LOG_LEVEL", "info"),
        }

        if cfg.DatabaseURL == "" {
                return nil, fmt.Errorf("DATABASE_URL is required")
        }
        if cfg.MigrationsURL == "" {
                // Fallback : si MIGRATIONS_URL absent, on suppose que DATABASE_URL est admin
                cfg.MigrationsURL = cfg.DatabaseURL
        }
        if cfg.JWTSecret == "" {
                return nil, fmt.Errorf("JWT_SECRET is required")
        }

        return cfg, nil
}

// IsProduction retourne true si l'app tourne en production.
func (c *Config) IsProduction() bool { return c.Env == "production" }

// LogLevelVar retourne le niveau slog correspondant.
func (c *Config) LogLevelVar() slog.Level {
        switch c.LogLevel {
        case "debug":
                return slog.LevelDebug
        case "warn":
                return slog.LevelWarn
        case "error":
                return slog.LevelError
        default:
                return slog.LevelInfo
        }
}

// ── Helpers (sans dépendance externe) ──────────────────────────

func getEnv(key, fallback string) string {
        if v := os.Getenv(key); v != "" {
                return v
        }
        return fallback
}

func getEnvInt(key string, fallback int) int {
        if v := os.Getenv(key); v != "" {
                if n, err := strconv.Atoi(v); err == nil {
                        return n
                }
        }
        return fallback
}
