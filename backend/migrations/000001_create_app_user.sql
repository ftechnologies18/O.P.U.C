-- ══════════════════════════════════════════════════════════════════
-- O.P.U.C — Migration 000001 : Création du rôle applicatif app_user
-- ══════════════════════════════════════════════════════════════════
-- Rôle non-superuser qui APPLIQUE le Row-Level Security.
-- Le backend Go se connecte avec ce rôle pour les requêtes runtime.
-- Les migrations/seeds utilisent le rôle `postgres` (bypass RLS).
--
-- ⚠️ À exécuter avec le rôle `postgres` (superuser).
-- ══════════════════════════════════════════════════════════════════

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user
         LOGIN PASSWORD 'opuc_app_user_dev_2025'
         NOSUPERUSER NOCREATEDB NOCREATEROLE
         NOREPLICATION CONNECTION LIMIT 50;
      RAISE NOTICE 'Rôle app_user créé avec succès';
   ELSE
      -- Reset password au cas où (idempotent)
      ALTER ROLE app_user PASSWORD 'opuc_app_user_dev_2025';
      RAISE NOTICE 'Rôle app_user existe déjà, password reset';
   END IF;
END $$;

-- Permissions : app_user peut lire/écrire sur toutes les tables du schema public
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Future tables créées par Prisma doivent aussi être accessibles à app_user
ALTER DEFAULT PRIVILEGES IN SCHEMA public
   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
   GRANT USAGE, SELECT ON SEQUENCES TO app_user;
