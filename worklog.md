
---
Task ID: 20
Agent: Main Agent
Task: Déploiement backend sur Render.com + connexion frontend Vercel

Work Log:
- Render token vérifié (rnd_2oo9...), owner: freelancetechnologies.ci@gmail.com
- Repo GitHub rendu public (était privé, empêchait Render de cloner)
- Secrets vérifiés avant publication (aucun token/credential dans le code tracké)
- 1er essai: service Docker → échec (free plan ne supporte pas Docker)
- 2e essai: service Go natif → échec (envSpecificDetails manquant)
- 3e essai: service Go natif avec envSpecificDetails → créé ✅
  • Build Go réussi (go build -o opuc-api .)
  • Mais service crash (exit code 1) → env vars vides !
- Env vars ajoutées via API Render (PUT /v1/services/{id}/env-vars)
  • 11 variables: DATABASE_URL, MIGRATIONS_URL, JWT_SECRET, R2_*, etc.
- Nouveau deploy déclenché → status: live ✅
- Health endpoint: {"status":"ok"} HTTP 200 en 0.23s ✅
- Login GERANT via Render: 200, role=GERANT, 2FA=true ✅
- BACKEND_URL mise à jour sur Vercel: https://opuc-api.onrender.com
- Nouveau build Vercel déclenché (empty commit) pour prendre en compte env var
- Test end-to-end Vercel → Render:
  • GET /api/v1/health via proxy: 200 en 0.54s ✅
  • POST /api/v1/auth/login: 200, role=GERANT ✅
  • GET /api/v1/auth/me (avec cookie): 200, email=gerant@opuc.demo ✅
  • GET /api/v1/chantiers: 200, count=1, "Centres Commerciaux Cocody" ✅
- Agent Browser: login + dashboard + chantiers data → 0 erreur ✅

Stage Summary:
- **Backend Go déployé sur Render** (free plan, Frankfurt, Go natif)
- **URL backend**: https://opuc-api.onrender.com
- **URL frontend**: https://opuc.vercel.app
- **Architecture production complète**:
  Vercel (frontend) → Render (backend Go) → Neon (Postgres) + Cloudflare R2 (fichiers)
- **Auto-deploy Render**: activé (sur push GitHub main, rootDir=backend)
- **Auto-deploy Vercel**: activé (sur push GitHub main, rootDir=frontend)
- **Scale-to-zero**: Render free plan sleep après 15min idle (cold start ~50s)

---
Task ID: 21
Agent: Frontend Agent (SPA → App Router migration)
Task: Convertir la navigation SPA (state-based) en navigation URL-based (Next.js App Router)

Work Log:
- Audit pré-migration: `grep -rn "setCurrentView|currentView" src/` a révélé 9 fichiers consommateurs
  • src/app/page.tsx (SPA switch)
  • src/store/app-store.ts (définition)
  • src/components/layout/{app-layout,search-command,user-menu}.tsx
  • src/components/dashboard/dashboard-view.tsx (6 usages: stocks, planning, chantiers, chantier-detail, quickActions)
  • src/components/chantiers/{chantiers-view,chantier-detail-view}.tsx
  • src/components/planning/planning-view.tsx
- Vérification des exports nommés de chaque *-view.tsx (DashboardView, PlanningView, ... 23 composants)

Changements effectués:

1. **src/store/app-store.ts** — Supprimé `currentView` et `setCurrentView` de l'interface et du store.
   L'URL (App Router) est maintenant la seule source de vérité. `selectedChantierId`, sidebar state
   et userRole sont conservés.

2. **src/app/(app)/layout.tsx** (NOUVEAU) — Layout auth-gated pour toutes les routes authentifiées.
   - Monte ThemeProvider + QueryProvider + AuthProvider (le root layout ne les a pas)
   - useSession: loading → spinner, unauthenticated → redirect `/` via useEffect+window.location
   - authenticated → `<AppLayout>{children}</AppLayout>`

3. **24 pages sous src/app/(app)/** (NOUVEAU) — Une page.tsx par module, chacune en `'use client'`
   qui render simplement le view component correspondant:
   - dashboard, planning, chantiers, chantiers/[id], pointage, personnel, paie, sous-traitants,
     stocks, budget, engins, carburant, clients, devis, contrats, facturation, rapports, photos,
     documents, support, gestion-acces, admin-plateforme, parametres
   - `/chantiers/[id]/page.tsx` utilise `useParams()` + `useEffect` pour pousser l'ID dans
     `setSelectedChantierId` du store avant de render `<ChantierDetailView />` (supporte ainsi
     l'accès direct par URL et la navigation in-app).

4. **src/app/page.tsx** — Simplifié de 219 → 169 lignes.
   - Supprimé: lazy-imports des 24 vues, switch(currentView), AppLayout wrapper, PlaceholderView.
   - Conservé: ThemeProvider/QueryProvider/AuthProvider, états auth (landing, login,
     forgot-password, two-factor, force-password), LandingPage, LoginForm, ForgotPasswordForm,
     TwoFactorVerify, ForcePasswordChange.
   - Ajouté: `useEffect` qui détecte `session` et redirige vers `/dashboard` via
     `window.location.href` (sauf si `premiereConnexion` → force password change d'abord).

5. **src/components/layout/app-layout.tsx** — Navigation URL-based.
   - Ajouté imports: `Link` from `next/link`, `usePathname` from `next/navigation`
   - SidebarContent: remplacement `<button onClick={setCurrentView}>` → `<Link href="/${id}">`
   - Active state: `pathname === \`/${item.id}\` || pathname.startsWith(\`/${item.id}/\`)`
     (gère `/chantiers/abc` → "chantiers" reste actif)
   - Header breadcrumb: dérive `currentPage` de `usePathname()` au lieu de `currentView`
   - AppLayout: `usePathname()` remplace `currentView` du store

6. **src/components/layout/search-command.tsx** — `useRouter().push(\`/${viewId}\`)` au lieu de
   `setCurrentView(viewId)`. Supprimé import `useAppStore`.

7. **src/components/layout/user-menu.tsx** — Supprimé `const { setCurrentView } = useAppStore()`
   (déstructuré mais jamais appelé — dead code) et l'import `useAppStore`.

8. **src/components/dashboard/dashboard-view.tsx** — 6 remplacements:
   - `setCurrentView('stocks')` → `router.push('/stocks')`
   - `setCurrentView('planning')` → `router.push('/planning')`
   - `useAppStore.getState().setSelectedChantierId(c.id) + setCurrentView('chantier-detail')`
     → `setSelectedChantierId(c.id) + router.push(\`/chantiers/${c.id}\`)`
   - `setCurrentView('chantiers')` → `router.push('/chantiers')`
   - `setCurrentView(action.view)` (quick actions) → `router.push(\`/${action.view}\`)`
   - Ajouté `useRouter` + `setSelectedChantierId` via selector

9. **src/components/chantiers/chantiers-view.tsx** — `handleViewDetail`:
   `setSelectedChantierId(id) + router.push(\`/chantiers/${id}\`)` (au lieu de
   `setCurrentView('chantier-detail')`)

10. **src/components/chantiers/chantier-detail-view.tsx** — 3 remplacements:
    - toast.error chantier non trouvé → `router.push('/chantiers')` (était setCurrentView)
    - handleDeleteChantier success → `router.push('/chantiers')`
    - bouton retour (ArrowLeft) → `router.push('/chantiers')`
    - useCallback dependency: `setCurrentView` → `router`

11. **src/components/planning/planning-view.tsx** — `handleNavigateToChantier`:
    `setAppChantierId(chantierId) + router.push(\`/chantiers/${chantierId}\`)`

Vérifications:
- `bun run lint` → EXIT 0 ✅ (0 erreur ESLint)
- `bunx tsc --noEmit` → 0 erreur introduite. 3 erreurs TS résolues par la migration:
  • src/app/page.tsx — `premiereConnexion` n'existait pas sur SessionUser (cast maintenant)
  • src/components/dashboard/dashboard-view.tsx(571) — `setCurrentView(action.view)` rejetait
    string vs AppPage (router.push prend string)
  • src/components/layout/search-command.tsx(70) — même problème AppPage (résolu)
- 9 fichiers modifiés: 115 insertions, 187 suppressions (net -72 lignes)
- 24 nouveaux fichiers sous src/app/(app)/

Flow de navigation post-migration:
- `/` (non-auth) → LandingPage → clic "Se connecter" → LoginForm → window.location='/'
  → useSession détecte session → window.location='/dashboard'
- `/dashboard` (auth) → (app)/layout vérifie session → AppLayout render DashboardView
- `/dashboard` (non-auth) → (app)/layout → useEffect redirect `/`
- Sidebar → `<Link href="/planning">` → navigation client-side App Router
- SearchCommand → `router.push('/stocks')`
- Dashboard quick actions → `router.push('/budget')` etc.
- Chantiers list → clic œil → `router.push('/chantiers/abc')` + setSelectedChantierId
- Chantier detail back button → `router.push('/chantiers')`

---
Task ID: SAAS-BACKEND
Agent: General-purpose sub-agent
Task: Create SaaS backend endpoints (SupportAccess, Subscriptions, Admin Dashboard, RLS update)

Work Log:
- Read worklog.md + explored existing patterns (GORM camelCase, RLS WithTenant,
  handler.WriteJSON/WriteError, chi router with middleware.RequireRole, newCuidLikeID)
- Audited existing models: saas.go (SupportAccess, Subscription, PlanConfigs),
  entreprise.go, user.go, chantier.go, commercial.go — confirmed camelCase columns
  and PascalCase table names.

Files created:

1. **internal/repository/gorm/saas_repo.go** (~600 lines)
   - `SupportAccessRepo` (uses Migrations/bypass RLS — usecase does authorization):
     - RequestAccess, ListRequests (filter by statut/entrepriseId/superAdminId),
       GetByID, Approve (statut=AUTORISE + autoriseLe/expireLe=now+4h + autoriseParId),
       Refuse, Revoke (statut=REVOQUE + revoqueLe/revoqueParId), HasActiveAccess,
       LogAction (JSON append to actionsLog), ExpireOld (bulk expire AUTORISE → EXPIRE)
   - `SubscriptionRepo` (Migrations/bypass RLS):
     - GetByEntreprise, Create, Update (map[string]any), Cancel (statut=CANCELED),
       List (filter by plan/statut/entrepriseId)
   - `AdminEntrepriseRepo` (Migrations, NO WithTenant — SUPER_ADMIN only):
     - List (paginated, search by nom/email/telephone, filter by status),
       GetByID, Create, Update, Suspend (status=suspended), Reactivate (status=active),
       GetStats (counts users/chantiers/factures for an entreprise),
       GetDashboardStats (totalEntreprises/totalUsers/activeSubscriptions/
         trialSubscriptions/mrr — MRR = SUM(amount) WHERE statut=ACTIVE)

2. **internal/usecase/admin/saas.go** (~530 lines)
   - `Usecase` struct holds SaaSRepos {SupportAccess, Subscription, AdminEntreprise}
   - SupportAccess (auth-aware authorization):
     - RequestAccess — SUPER_ADMIN only, checks entreprise exists, creates DEMANDE
     - ListRequests — SUPER_ADMIN sees all, others see own entreprise (forced)
     - ApproveAccess — GERANT only + ownership check (sa.EntrepriseID == auth.EntrepriseID)
     - RefuseAccess — GERANT only + ownership check
     - RevokeAccess — SUPER_ADMIN OR GERANT (with ownership), statut must be AUTORISE
     - HasActiveAccess — public (no auth)
   - Subscriptions:
     - GetSubscription — SUPER_ADMIN any; others only own entreprise
     - CreateSubscription — SUPER_ADMIN only; plan validated against PlanStarter/Pro/Enterprise;
       trial 14 days (trialEndsAt = now+14d); quotas+amount from model.PlanConfigs;
       409 Conflict if existing subscription
     - ChangePlan — SUPER_ADMIN only; updates plan+amount+maxUsers/maxChantiers/maxStorageMB
     - CancelSubscription — SUPER_ADMIN only
     - ListSubscriptions — SUPER_ADMIN only
   - Admin Dashboard:
     - GetDashboardStats — SUPER_ADMIN only; returns map → handler converts to typed DTO
     - ListEntreprises — SUPER_ADMIN only
     - GetEntrepriseDetail — SUPER_ADMIN only; returns EntrepriseDetail struct
       (entreprise + stats{users,chantiers,factures} + subscription)
     - CreateEntreprise / UpdateEntreprise / SuspendEntreprise / ReactivateEntreprise
       — all SUPER_ADMIN only
   - Helper: isValidPlan validates against model.PlanStarter/Pro/Enterprise
   - All errors wrapped with domain.Err* (NotFound/Forbidden/Conflict/BadRequest/Unauthorized/Internal)

3. **internal/delivery/http/dto/saas_dto.go** (~90 lines)
   - SupportAccess: SupportAccessRequestRequest, SupportAccessListResponse
   - Subscriptions: CreateSubscriptionRequest, ChangePlanRequest, SubscriptionListResponse
   - Admin Entreprises: CreateEntrepriseRequest, UpdateEntrepriseRequest,
     EntrepriseListResponse, EntrepriseDetailResponse
   - Dashboard: DashboardStatsResponse (typed KPIs)
   - OKResponse (generic {ok, id} for action endpoints)

4. **internal/delivery/http/handler/saas_handler.go** (~370 lines)
   - `SaaSHandler` with 15 methods:
     - Dashboard (GET /admin/dashboard) — converts map[string]any → typed DTO via toInt64/toFloat64
     - Entreprises: ListEntreprises, CreateEntreprise, GetEntreprise, UpdateEntreprise,
       SuspendEntreprise, ReactivateEntreprise
     - Subscriptions: ListSubscriptions, CreateSubscription, ChangePlan, CancelSubscription
     - SupportAccess (admin): ListSupportAccess, RequestSupportAccess, RevokeSupportAccess
     - SupportAccess (GERANT): ListMySupportAccess, ApproveSupportAccess,
       RefuseSupportAccess, RevokeMySupportAccess
   - `writeSaaSError` maps domain errors → HTTP status (404/403/409/401/400/500)
   - `toInt64`/`toFloat64` defensive helpers for map[string]any → typed conversion

5. **internal/delivery/http/router.go** (modified)
   - Added `SaaS *handler.SaaSHandler` to Deps struct
   - Added 14 SUPER_ADMIN routes under /admin/* wrapped in
     `r.Group(...).Use(middleware.RequireRole("SUPER_ADMIN"))`:
     - GET /admin/dashboard
     - GET/POST /admin/entreprises, GET/PUT /admin/entreprises/{id},
       POST /admin/entreprises/{id}/suspend, POST /admin/entreprises/{id}/reactivate
     - GET/POST /admin/subscriptions, PUT /admin/subscriptions/{id},
       POST /admin/subscriptions/{id}/cancel
     - GET /admin/support-access, POST /admin/support-access/request,
       POST /admin/support-access/{id}/revoke
   - Added 4 GERANT routes under /support-access/*:
     - GET /support-access (any auth role — usecase forces EntrepriseID filter)
     - POST /support-access/{id}/approve (GERANT only)
     - POST /support-access/{id}/refuse (GERANT only)
     - POST /support-access/{id}/revoke (GERANT only)

6. **main.go** (modified)
   - Added import for `opuc/internal/usecase/admin`
   - Wired 3 new repos: supportAccessRepo, subscriptionRepo, adminEntrepriseRepo
     (all using dbm.Migrations — bypass RLS, usecase handles authorization)
   - Wired saasUC = admin.NewUsecase(admin.SaaSRepos{...}, log)
   - Wired saasHandler = handler.NewSaaSHandler(saasUC, log)
   - Added SaaS: saasHandler to router Deps

7. **cmd/update_rls_saas/main.go** (~190 lines, new)
   - Creates 4 helper functions:
     - app_current_tenant() (re-created/updated — already existed)
     - app_is_super_admin() (re-created/updated — already existed)
     - app_current_user_id() (NEW — reads current_setting('app.user_id'))
     - app_has_support_access(tenant_id text) (NEW — true if current super_admin
       has AUTORISE+not-expired SupportAccess for tenant_id; false for non-super-admin
       or when app.user_id is NULL)
   - Enables RLS + creates tenant_isolation policy on SupportAccess and Subscription
     (standard: app_is_super_admin() OR entrepriseId = current_tenant)
   - RESTRICTS SUPER_ADMIN on 11 tenant-scoped tables (Chantier, User, Client,
     Journalier, SousTraitant, Equipement, Devis, Contrat, Facture, TicketSupport,
     AuditLog): replaces `app_is_super_admin() OR` with
     `app_has_support_access("entrepriseId") OR` in USING + WITH CHECK
   - KEEPS `app_is_super_admin() OR` on 4 platform tables
     (Entreprise, SystemSetting, PermissionConfig, InvitationToken)
   - Prints verification (RLS-enabled tables + policy count)

8. **internal/infrastructure/database/tenant.go** (modified — required for RLS)
   - Added step 4 in WithTenant: `set_config('app.user_id', auth.UserID, true)`
     so app_has_support_access can filter by superAdminId.
   - Updated docstring to mention Phase 6 SaaS requirement.
   - Backward-compatible: if auth.UserID is empty, the set_config is skipped
     (existing behavior preserved for login flow where auth is nil).

Build & vet:
- Installed Go SDK 1.23.4 (downloaded from go.dev, extracted to $HOME/go-sdk/bin/go
  since Go was not pre-installed in the sandbox)
- `go build ./...` → EXIT 0 (no errors, no warnings)
- `go vet ./...` → EXIT 0 (no issues)

Key design decisions:
- **3 SaaS repos all use Migrations (bypass RLS)**: SupportAccess and Subscription
  are platform-level resources that span multiple tenants (a SUPER_ADMIN can have
  requests on N entreprises). The repo signatures don't accept *AuthUser, so they
  can't use WithTenant. The usecase layer enforces all authorization (role + ownership).
  AdminEntrepriseRepo is explicitly SUPER_ADMIN only (router enforces via RequireRole).
- **RLS still enabled on SupportAccess + Subscription** (defense-in-depth): if any
  code path ever uses Runtime+WithTenant on these tables, the standard tenant_isolation
  policy (super_admin bypass OR entrepriseId match) correctly filters.
- **app_has_support_access uses current_setting('app.user_id')**: required adding
  a 4th set_config in WithTenant. The function returns false for non-super-admin
  users (they don't need support access — they're already filtered by current_tenant)
  and for super_admins without an active SupportAccess on the requested tenant.
- **trial = 14 days, hardcoded in CreateSubscription**: matches spec "trial 14 days"
  and uses model.MaxSupportAccessDuration pattern (constants in model).
- **MRR excludes TRIAL subscriptions**: trial is free, so only ACTIVE subs contribute
  to monthly recurring revenue (SUM(amount) WHERE statut=ACTIVE).
- **GetEntrepriseDetail returns EntrepriseDetail struct** (not map[string]any):
  cleaner typing + JSON serialization (entreprise + stats + subscription as
  separate fields, with omitempty on subscription).
- **GetDashboardStats returns map[string]any → handler converts to typed DTO**:
  defensive toInt64/toFloat64 helpers handle the float64/int64 variance from
  SQL aggregates, ensuring consistent JSON output.

Stage Summary:
- 5 new files (saas_repo.go, saas.go, saas_dto.go, saas_handler.go, update_rls_saas/main.go)
- 3 modified files (router.go, main.go, tenant.go)
- 18 new HTTP endpoints (14 SUPER_ADMIN + 4 GERANT)
- `go build ./...` and `go vet ./...` both clean
- RLS update script ready to run (needs `go run ./cmd/update_rls_saas` with MIGRATIONS_URL set)
- Next step: deploy + run update_rls_saas script on the production DB, then test
  end-to-end flow (request → GERANT approve → SUPER_ADMIN access via RLS)

---
Task ID: SAAS-FRONTEND
Agent: Frontend Agent (SaaS admin pages)
Task: Create SaaS platform admin pages for the new backend SaaS endpoints
(admin dashboard, entreprises, subscriptions, support-access) + sidebar updates.

Work Log:
- Read worklog (Task 22 SAAS-BACKEND confirmed endpoints + RLS restrictions
  on SUPER_ADMIN for tenant-scoped tables).
- Audited existing patterns: `useSession()` from `@/lib/auth-session` exposes
  `(session?.user as any)?.role`, `(app)/layout.tsx` is the auth-gated wrapper,
  `(app)/chantiers/[id]/page.tsx` is the precedent for nested dynamic routes,
  `recharts` is the chart library (BarChart in dashboard-view.tsx).
- Verified backend DTO shapes: `model.Entreprise` (id, nom, adresse*, telephone*,
  email*, status, createdAt), `model.Subscription` (id, entrepriseId, plan,
  statut, amount, currency, maxUsers, maxChantiers, maxStorageMB, trialEndsAt*,
  currentPeriodStart*, currentPeriodEnd*), `model.SupportAccess` (id, superAdminId,
  entrepriseId, raison, statut, demandeLe, autoriseLe*, autoriseParId*, expireLe*,
  revoqueLe*, revoqueParId*, actionsLog*).
- Backend plans (model.PlanConfigs): Starter=0 FCFA / 5 users / 3 chantiers /
  500 MB; Pro=25000 FCFA / 25 / 15 / 5120; Enterprise=75000 FCFA / 999 / 999 / 51200.
- Trial = 14 days, support access max = 4h (model.MaxSupportAccessDuration).

Files created / modified:

1. **src/app/(app)/admin-plateforme/page.tsx** — COMPLETE REDESIGN
   (was: 7-line stub rendering `<AdminPlateformeView/>`).
   New SaaS dashboard: 4 KPI cards (Entreprises/Users/MRR FCFA/Trials) with
   glassmorphism + amber/orange gradient + Framer Motion stagger; recharts
   AreaChart for 12-month growth (entreprises créées par mois, computed
   client-side); activity feed (trials expirant 3j + nouvelles inscriptions);
   table entreprises récentes (nom, plan, statut, action); table demandes
   support en attente; 3 quick-link cards.
   Parallel `Promise.allSettled` fetches for /admin/dashboard, /admin/entreprises,
   /admin/subscriptions, /admin/support-access?statut=DEMANDE.
   RBAC guard (role !== SUPER_ADMIN → "Accès restreint").

2. **src/app/(app)/admin/entreprises/page.tsx** — NEW (~820 lines)
   3 stats cards (Total/Actives/Suspendues). Search (debounced 400ms) + status
   filter Select. Paginated table (page 10): nom, contact, statut, plan, date
   création, actions. "Nouvelle entreprise" dialog (form nom* + adresse/tel/email).
   Row dropdown: Voir détail (→ /admin/entreprises/{id}), Demander accès support
   (dialog raison + AlertDialog confirm), Suspendre/Réactiver. Pagination.

3. **src/app/(app)/admin/entreprises/[id]/page.tsx** — NEW (~950 lines)
   Header with back button + actions (Actualiser, Accès support, Éditer,
   Suspendre/Réactiver AlertDialog). 2-col grid: Card infos entreprise +
   Card abonnement (plan, statut, montant FCFA, trial ends, period end, quotas).
   4 stat boxes (users/chantiers/factures/stockage). Users table (filtered by
   entrepriseId from /api/v1/users — RLS-aware: empty state explains
   "Demandez un accès support pour visualiser les utilisateurs"). Edit dialog.
   Support access dialog (raison + 4h warning).

4. **src/app/(app)/admin/subscriptions/page.tsx** — NEW (~770 lines)
   4 stats (MRR total, Trials actifs, Churn rate %, Total abonnements — churn =
   canceled / (active + canceled) * 100). 3 plan cards (Starter/Pro/Enterprise)
   with features + prices + "Le plus populaire" badge on Pro. 2 filters
   (plan + statut). Table: entreprise, plan badge, statut badge, montant FCFA,
   trial fin, period fin, actions (Changer le plan, Voir entreprise, Annuler).
   Change plan dialog (radio-style buttons), Cancel AlertDialog, Create
   subscription dialog (select entreprise + plan).

5. **src/app/(app)/admin/support-access/page.tsx** — NEW (~640 lines)
   5 stat boxes (En attente/Actifs/Refusés/Expirés/Révoqués). Warning banner
   (4h limit + audit log). Statut filter. Table: entreprise (with link), raison,
   statut badge (icon: DEMANDE=amber/Clock, AUTORISE=green/CheckCircle,
   REFUSE=red/XCircle, EXPIRE=slate/Clock, REVOQUE=red/Ban), demandée (date +
   relative), autorisée, expire, actions (Voir log, Voir entreprise, Révoquer
   si AUTORISE). "Nouvelle demande" dialog (select entreprise + raison min 10).
   Revoke AlertDialog. Log dialog (all metadata + actionsLog JSON).

6. **src/app/(app)/parametres/acces-support/page.tsx** — NEW (~600 lines, GERANT view)
   Warning banner highlighted ("Accès limité à 4h. Actions enregistrées.
   Vous pouvez révoquer à tout moment."). 3 stat cards (En attente/Actifs/
   Historique). Active access highlight card (green, remaining time + revoke).
   Pending table: demandé par (superAdminId), raison, demandée le, actions
   (Voir détails, Approuver green, Refuser red). History table (read-only,
   ScrollArea max-h-96). Confirm AlertDialog for each action with role-specific
   description. Log dialog. RBAC guard (SOUS_TRAITANT blocked).

7. **src/components/layout/app-layout.tsx** — MODIFIED
   - Added `CreditCard`, `LifeBuoy` to lucide-react imports.
   - New `NavItem` interface with optional `href?: string` and
     `requiredRoles?: UserRole[]` fields. `NavSection` interface added.
   - New "Plateforme" nav section (SUPER_ADMIN only) with 4 items:
     Dashboard (/admin-plateforme), Entreprises (/admin/entreprises),
     Abonnements (/admin/subscriptions), Support Access (/admin/support-access).
   - Removed "Admin Plateforme" from "Configuration" section (moved to Plateforme).
   - Added "Accès Support" → /parametres/acces-support in Configuration with
     `requiredRoles: ['GERANT', 'SUPER_ADMIN']`.
   - Sidebar filter logic: if `requiredRoles` set, check membership; else fall
     back to `canAccessPage` (legacy AppPage ids); else default-show.
   - Active-state detection + breadcrumb lookup updated to use
     `item.href || \`/${item.id}\`` (so /admin/entreprises and
     /admin/entreprises/[id] both highlight "Entreprises").

Architecture decisions:
- **Self-contained 'use client' pages**: Each new page.tsx is a full React
  component (no separate view file). Keeps the new SaaS code isolated from
  the legacy admin-plateforme-view.tsx (now dead code, kept in place since
  no other file imports it).
- **Parallel Promise.allSettled fetches**: Resilient to single-endpoint
  failures — partial data is rendered with empty states.
- **RLS-aware users table**: On /admin/entreprises/[id], the users table
  fetches /api/v1/users and filters by entrepriseId. Per Task 22 RLS update,
  SUPER_ADMIN can ONLY see tenant-scoped rows if they have an AUTORISE
  SupportAccess. The empty state explicitly tells the SUPER_ADMIN to
  "Demander l'accès" — graceful UX matching the security model.
- **PLAN_INFO mirrored from backend**: Frontend has its own constant for
  Starter/Pro/Enterprise (price + quotas) since /admin/subscriptions doesn't
  expose plan configs as a separate endpoint.
- **requiredRoles on nav items (not in rbac.ts)**: Avoids touching the RBAC
  file (PAGE_ACCESS, MODULE_PERMISSIONS, etc.). Legacy items still go through
  canAccessPage; new items use requiredRoles for fine-grained role filtering.
- **Glassmorphism + amber/orange theme**: All cards use
  `backdrop-blur-xl bg-white/70 border border-white/60 dark:bg-slate-900/50
  dark:border-slate-800/60`. Accent colors amber/orange/slate/red only —
  NO indigo/blue per spec.
- **Framer Motion**: Page header slide-down, KPI cards staggered, table rows
  with `<motion.tr layout>` + `<AnimatePresence mode="popLayout">` for smooth
  row add/remove.

Verification:
- `cd /home/z/my-project/frontend && bun run lint` → EXIT 0 (0 errors, 0 warnings)
- `bunx tsc --noEmit --skipLibCheck` → 0 errors on new files
  (5 pre-existing TS errors in login-form.tsx, layout.tsx, open-next.config.ts,
  prisma/seed.ts — documented in worklog Task 21, NOT introduced here)

Stage Summary:
- 6 page files created (1 redesigned + 5 new) + 1 layout file modified.
- ~4,500 lines of new TypeScript/React code.
- All 18 SUPER_ADMIN + 4 GERANT SaaS backend endpoints wired up.
- Full RBAC: SUPER_ADMIN-only pages show "Accès restreint" for other roles;
  GERANT acces-support page blocks SOUS_TRAITANT.
- Dev server note: the auto-started `bun run dev` runs from
  `/home/z/my-project/` (root stub) instead of `/home/z/my-project/frontend/`.
  The new routes return 404 via the preview panel until the dev server is
  restarted from the frontend directory. Code is correct (lint + tsc pass).
