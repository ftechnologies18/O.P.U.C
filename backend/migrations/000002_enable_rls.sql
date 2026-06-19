-- ══════════════════════════════════════════════════════════════════
-- O.P.U.C — Migration 000002 : Activation Row-Level Security (RLS)
-- ══════════════════════════════════════════════════════════════════
-- RLS = défense en profondeur : même si le backend Go oublie le
-- WHERE "entrepriseId" = ?, la DB refuse de retourner les lignes
-- d'un autre tenant.
--
-- Mécanisme :
--   1. SELECT set_config('app.current_tenant', '<entrepriseID>', true)
--   2. SELECT set_config('app.user_role', '<role>', true)
--   3. Les policies USING(...) filtrent automatiquement chaque requête
--
-- IMPORTANT : les colonnes Prisma sont en camelCase (entrepriseId),
-- PAS en snake_case. Les policies doivent référencer "entrepriseId".
--
-- SUPER_ADMIN bypass le filtrage (voit toutes les entreprises).
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Fonctions utilitaires ───────────────────────────────────

-- current_tenant() : retourne l'ID du tenant courant (NULL si non set)
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text AS $$
    SELECT NULLIF(current_setting('app.current_tenant', true), '')::text;
$$ LANGUAGE sql STABLE;

-- is_super_admin() : true si le user courant est SUPER_ADMIN
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
    SELECT COALESCE(current_setting('app.user_role', true), '') = 'SUPER_ADMIN';
$$ LANGUAGE sql STABLE;

-- ── 2. RLS sur les 14 tables tenant-scoped ─────────────────────
-- Toutes ont la colonne "entrepriseId" (camelCase Prisma).

DO $$
DECLARE
    t text;
    tenant_tables text[] := ARRAY[
        'User', 'Entreprise', 'Chantier', 'Client',
        'Journalier', 'SousTraitant', 'Equipement',
        'Devis', 'Contrat', 'Facture',
        'TicketSupport', 'AuditLog', 'PermissionConfig', 'SystemSetting',
        'InvitationToken'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables LOOP
        -- Activer RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        -- FORCE : applique même au owner (sauf superuser qui bypass toujours)
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

        -- Drop anciennes policies (idempotent)
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);

        -- Policy : SUPER_ADMIN voit tout, sinon filtre par entrepriseId
        -- Exception : table Entreprise — filtre par id (le tenant EST l'entreprise)
        IF t = 'Entreprise' THEN
            EXECUTE format($f$
                CREATE POLICY %I ON %I
                FOR ALL
                USING (app_is_super_admin() OR id = app_current_tenant())
                WITH CHECK (app_is_super_admin())
            $f$, t || '_tenant_isolation', t);
        ELSE
            EXECUTE format($f$
                CREATE POLICY %I ON %I
                FOR ALL
                USING (app_is_super_admin() OR "entrepriseId" = app_current_tenant())
                WITH CHECK (app_is_super_admin() OR "entrepriseId" = app_current_tenant())
            $f$, t || '_tenant_isolation', t);
        END IF;

        RAISE NOTICE 'RLS activé sur %', t;
    END LOOP;
END $$;

-- ── 3. Vérification ────────────────────────────────────────────
-- Lister les tables avec RLS activé pour audit :
SELECT tablename, rowsecurity AS rls_enabled, forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
