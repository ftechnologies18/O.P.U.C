# Task ID: SAAS-FRONTEND — Frontend Agent

## Task
Create SaaS platform admin pages (frontend Next.js 16 at `/home/z/my-project/frontend/`)
for the new backend SaaS endpoints (admin dashboard, entreprises, subscriptions,
support-access). Add a new "Plateforme" sidebar section for SUPER_ADMIN, and an
"Accès Support" page for GERANT+.

## Working directory
`/home/z/my-project/frontend/`

## Scope
- 6 page files created (1 redesigned + 5 new)
- 1 layout file updated (`src/components/layout/app-layout.tsx`)
- `bun run lint` → EXIT 0 (0 errors, 0 warnings)
- `bunx tsc --noEmit --skipLibCheck` → 0 errors on new files (5 pre-existing errors
  on `login-form.tsx`, `layout.tsx`, `open-next.config.ts`, `prisma/seed.ts` —
  documented in worklog Task 21, NOT introduced here)

## Files created / modified

### 1. `src/app/(app)/admin-plateforme/page.tsx` — REDESIGNED (was: 7-line stub)
Complete SaaS dashboard for SUPER_ADMIN:
- 4 KPI cards (Entreprises, Users total, MRR FCFA, Trials actifs) — glassmorphism,
  amber/orange gradient, Framer Motion stagger animations.
- Growth chart (recharts AreaChart): entreprises créées par mois, 12 derniers mois.
  Computed client-side from `GET /admin/entreprises` (parsed createdAt).
- Activity feed (right column): trials expirant (3 jours) + nouvelles inscriptions.
- Table: entreprises récentes (nom, plan, statut, action eye → detail).
- Table: demandes support en attente (DEMANDE statut) — scrollable.
- 3 quick-link cards at the bottom (entreprises, abonnements, support-access).
- Parallel `Promise.allSettled` fetches for resilience.
- RBAC guard: shows "Accès restreint" if role !== SUPER_ADMIN.
- Theme: amber/orange/slate/white only. NO indigo/blue.

### 2. `src/app/(app)/admin/entreprises/page.tsx` — NEW
Page de gestion des tenants:
- 3 stat cards (Total, Actives, Suspendues).
- Search input (debounced 400ms) + status filter Select (all/active/suspended).
- Paginated table (page size 10): nom, contact (email/tel), statut badge,
  plan badge, date création, actions (Voir détail + dropdown menu).
- "Nouvelle entreprise" dialog (form: nom*, adresse, telephone, email).
- Row actions: Voir détail, Demander accès support (dialog raison),
  Suspendre/Réactiver (POST /admin/entreprises/{id}/suspend|reactivate).
- Pagination controls (prev/next) when total > pageSize.
- POST support-access/request opens a confirmation AlertDialog before sending.

### 3. `src/app/(app)/admin/entreprises/[id]/page.tsx` — NEW
Détail d'une entreprise:
- Header: back button + nom + actions (Actualiser, Accès support, Éditer,
  Suspendre/Réactiver with AlertDialog).
- 2-col grid: Card infos entreprise (nom, statut, email, tel, adresse, créée le)
  + Card abonnement (plan, statut, montant, trial ends, period end, quotas).
- 4 stat boxes (Utilisateurs, Chantiers, Factures, Stockage).
- Users table (filtered by entrepriseId from `/api/v1/users`). Empty state
  explains that users are only visible if SUPER_ADMIN has an active support
  access (RLS restricts SUPER_ADMIN on tenant-scoped tables — worklog Task 22).
- "Demander accès support" dialog with raison field + 4h warning banner.
- Edit dialog (PUT /admin/entreprises/{id}).
- Suspend AlertDialog (POST /admin/entreprises/{id}/suspend).

### 4. `src/app/(app)/admin/subscriptions/page.tsx` — NEW
Gestion abonnements:
- 4 stat cards (MRR total, Trials actifs, Churn rate %, Total abonnements).
  Churn = canceled / (active + canceled) * 100.
- 3 plan cards (Starter/Pro/Enterprise) with features list, prices, "Le plus
  populaire" badge on Pro. Each card has a "Créer avec ce plan" button.
- 2 filters: plan (all/Starter/Pro/Enterprise) + statut
  (all/TRIAL/ACTIVE/PAST_DUE/CANCELED/EXPIRED).
- Table: entreprise (lookup by entrepriseId), plan badge, statut badge, montant
  FCFA, trial fin, period fin, actions dropdown (Changer le plan, Voir entreprise,
  Annuler l'abonnement).
- Change plan dialog: radio-style buttons for the 3 plans.
- Cancel AlertDialog.
- Create subscription dialog: select entreprise (filtered to those without
  existing sub) + select plan.

### 5. `src/app/(app)/admin/support-access/page.tsx` — NEW
Demandes d'accès support (SUPER_ADMIN):
- 5 stat boxes (En attente, Actifs, Refusés, Expirés, Révoqués).
- Warning banner: "Accès limité à 4h. Actions enregistrées. Gérant doit autoriser."
- Statut filter Select.
- Table: entreprise (with link to detail), raison, statut badge (with icon:
  DEMANDE=amber/Clock, AUTORISE=green/CheckCircle, REFUSE=red/XCircle,
  EXPIRE=slate/Clock, REVOQUE=red/Ban), demandée (date + relative),
  autorisée, expire, actions dropdown (Voir log, Voir entreprise, Révoquer si AUTORISE).
- "Nouvelle demande" dialog: select entreprise + raison textarea (min 10 chars).
- Revoke AlertDialog.
- Log dialog: shows all metadata + actionsLog JSON if present.

### 6. `src/app/(app)/parametres/acces-support/page.tsx` — NEW (GERANT view)
Page d'autorisation des accès support:
- Warning banner (highlighted): "Accès limité à 4h. Toutes les actions
  enregistrées dans un journal d'audit. Vous pouvez révoquer à tout moment."
- 3 stat cards (En attente, Actifs, Historique).
- Active access highlight card (green) — shows remaining time + revoke button.
- Pending table: demandé par (superAdminId), raison, demandée le (date+relative),
  actions (Voir détails, Approuver green, Refuser red).
- History table (read-only): demandé par, raison, statut badge, demandée,
  expire/révoquée. ScrollArea max-h-96.
- Confirm AlertDialog for each action (approve/refuse/revoke) with role-specific
  description ("L'accès sera accordé pour 4h..." / "La demande sera marquée
  comme refusée..." / "L'accès sera immédiatement révoqué...").
- Log dialog for details + actionsLog.
- RBAC guard: SOUS_TRAITANT blocked, GERANT/SUPER_ADMIN allowed.

### 7. `src/components/layout/app-layout.tsx` — MODIFIED
- Added `CreditCard`, `LifeBuoy` to lucide-react imports.
- Added new `NavItem` interface with optional `href?: string` and
  `requiredRoles?: UserRole[]` fields.
- Added new "Plateforme" nav section (between "Documents & Médias" and
  "Configuration") with 4 items, all restricted to SUPER_ADMIN:
  - Dashboard → /admin-plateforme (existing route, moved here)
  - Entreprises → /admin/entreprises (new)
  - Abonnements → /admin/subscriptions (new)
  - Support Access → /admin/support-access (new)
- Removed "Admin Plateforme" from "Configuration" section (now in "Plateforme").
- Added "Accès Support" → /parametres/acces-support in "Configuration" section
  with `requiredRoles: ['GERANT', 'SUPER_ADMIN']`.
- Updated sidebar filter logic: if `item.requiredRoles` is set, check membership;
  otherwise fall back to `canAccessPage` (legacy AppPage ids) or default-show
  for unknown ids.
- Updated active-state detection: uses `item.href || \`/${item.id}\`` instead of
  hardcoded `/${item.id}` (so `/admin/entreprises` and `/admin/entreprises/[id]`
  both highlight the "Entreprises" sidebar item).
- Updated breadcrumb lookup with same href logic.

## API endpoints used (all `credentials: 'same-origin'`)

### SUPER_ADMIN only (under /admin/*):
- `GET  /admin/dashboard` — KPIs (totalEntreprises, totalUsers, activeSubs, trialSubs, mrr)
- `GET  /admin/entreprises?search=&status=&page=&pageSize=` — paginated list
- `POST /admin/entreprises` — create (nom*, adresse, telephone, email)
- `GET  /admin/entreprises/{id}` — detail + stats {users, chantiers, factures} + subscription
- `PUT  /admin/entreprises/{id}` — update (nom, adresse, telephone, email)
- `POST /admin/entreprises/{id}/suspend`
- `POST /admin/entreprises/{id}/reactivate`
- `GET  /admin/subscriptions?plan=&statut=&entrepriseId=` — list
- `POST /admin/subscriptions` — create {entrepriseId, plan}
- `PUT  /admin/subscriptions/{id}` — change plan {plan}
- `POST /admin/subscriptions/{id}/cancel`
- `GET  /admin/support-access?statut=&entrepriseId=&superAdminId=`
- `POST /admin/support-access/request` — {entrepriseId, raison}
- `POST /admin/support-access/{id}/revoke`

### GERANT (under /support-access/*):
- `GET  /support-access` — list for own entreprise (RLS-filtered server-side)
- `POST /support-access/{id}/approve`
- `POST /support-access/{id}/refuse`
- `POST /support-access/{id}/revoke`

## Architecture decisions

### 1. Pages are self-contained `'use client'` components
Each page.tsx is a full React component with its own state, fetch logic, dialogs,
and sub-components — no separate view component (unlike the existing pattern of
`page.tsx renders <XView />`). This keeps the new SaaS pages isolated from the
legacy `admin-plateforme-view.tsx` (which is now dead code, kept in place since
no other file imports it).

### 2. Parallel `Promise.allSettled` fetches
Each dashboard page fetches multiple endpoints in parallel. Using `allSettled`
(rather than `all`) means a single failing endpoint doesn't break the entire
page — partial data is rendered with empty states.

### 3. RLS-aware users table on entreprise detail
The users table on `/admin/entreprises/[id]` fetches `/api/v1/users` and filters
client-side by `entrepriseId`. Per the RLS update in Task 22 (SAAS-BACKEND),
SUPER_ADMIN can ONLY access tenant-scoped tables (User, Chantier, etc.) if they
have an active AUTORISE SupportAccess on that entreprise. The empty state
explicitly tells the SUPER_ADMIN to "Demander l'accès" — graceful UX that
matches the security model.

### 4. Plan configs mirrored from backend
The frontend has its own `PLAN_INFO` constant (Starter/Pro/Enterprise) with
prices and quotas — mirrors the backend `model.PlanConfigs` (Starter=0 FCFA,
Pro=25000 FCFA, Enterprise=75000 FCFA). This is necessary because the backend
`/admin/subscriptions` list returns existing subscriptions but doesn't expose
plan configs as a separate endpoint. Prices/quotas are also displayed in the
3 plan cards on the subscriptions page.

### 5. Glassmorphism + amber/orange theme
All cards use `backdrop-blur-xl bg-white/70 border border-white/60 dark:bg-slate-900/50 dark:border-slate-800/60`
for glassmorphism. Accent colors are amber/orange/slate/red only — NO indigo/blue
(per spec). KPI cards use gradient backgrounds `from-amber-500/15 to-amber-500/5`.

### 6. Framer Motion animations
- Page header: `initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}`.
- KPI cards: staggered `delay: idx * 0.05` for entrance.
- Tables: `<motion.tr layout>` with `<AnimatePresence mode="popLayout">` for
  smooth row add/remove.
- Dialogs: rely on shadcn Dialog's built-in Radix animations.

### 7. Sidebar `requiredRoles` extension
Rather than adding new AppPage entries to `lib/rbac.ts` (which would require
changes to PAGE_ACCESS, MODULE_PERMISSIONS, etc.), the sidebar uses a new
optional `requiredRoles?: UserRole[]` field on nav items. This is more flexible
and keeps the RBAC file untouched. Legacy items still go through `canAccessPage`.

## Verification

```
$ cd /home/z/my-project/frontend && bun run lint
$ eslint .
EXIT: 0  (0 errors, 0 warnings)

$ bunx tsc --noEmit --skipLibCheck
(0 errors on new files; 5 pre-existing TS errors in login-form.tsx, layout.tsx,
open-next.config.ts, prisma/seed.ts — NOT introduced here, documented in worklog Task 21)
```

## Note on dev server
The auto-started dev server (`bun run dev`) is currently running from
`/home/z/my-project/` (the root stub project), NOT from `/home/z/my-project/frontend/`
where the actual O.P.U.C frontend lives. This means the new routes return 404
when accessed via the preview panel — the root project's `src/app/page.tsx` is a
default Next.js stub that doesn't know about the `(app)` route group.

The code itself is correct (lint + tsc pass, all 6 pages properly structured
under `src/app/(app)/admin/*` and `src/app/(app)/parametres/acces-support/`).
The dev server should be restarted from `/home/z/my-project/frontend/` for the
new pages to be served. This is a system-level concern, not a code issue.
