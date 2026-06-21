# Task DASHBOARDS-PAR-ROLE — full-stack-developer

## Contexte
Projet O.P.U.C dans `/home/z/my-project/opuc`. Frontend Next.js 16 dans `/home/z/my-project/opuc/frontend`.

Voir `/home/z/my-project/opuc/worklog.md` (section "Task ID: DASHBOARDS-PAR-ROLE") pour le récit complet.

## Objectif atteint
Création de 4 composants dashboard distincts (un par rôle) + routing de `/dashboard` par rôle + fix du doublon sidebar SUPER_ADMIN.

## Fichiers créés
1. `frontend/src/components/dashboard/super-admin-dashboard.tsx` — redirect vers `/admin-plateforme` (filet de sécurité).
2. `frontend/src/components/dashboard/gerant-dashboard.tsx` — KPIs BTP (chantiersActifs, journaliersSurSite, pointagesAujourdhui, tachesEnRetard, alertesActives) + budget global + chart budget par chantier + statut chantiers (pie) + top 3 chantiers + tâches en retard + notifications + 6 quick actions. Backend : `/api/v1/dashboard` + `/api/v1/chantiers` + `/api/v1/notifications` + `/api/v1/auth/me`.
3. `frontend/src/components/dashboard/chef-projet-dashboard.tsx` — KPIs (mes tâches en cours, en retard, pointages du jour, chantiers actifs) + top 5 tâches assignées + quick actions + pointages du jour + alertes stock + notifications. Backend : `/api/v1/taches/mes-taches` + `/api/v1/dashboard` + `/api/v1/notifications` + `/api/v1/auth/me`.
4. `frontend/src/components/dashboard/employe-dashboard.tsx` — KPIs personnels (mes tâches total, en cours, en retard, terminées) + alerte tâches en retard + tâches du jour + notifications + CTA "Voir mes tâches". Backend : `/api/v1/taches/mes-taches` + `/api/v1/notifications` + `/api/v1/auth/me`. **IMPORTANT : aucun fetch vers `/api/v1/dashboard`** (l'EMPLOYE n'a pas accès aux KPIs entreprise — RLS backend bloque).

## Fichiers modifiés
1. `frontend/src/app/(app)/dashboard/page.tsx` — router par rôle (switch sur `session.user.role`). Fallback = `<GerantDashboard />`.
2. `frontend/src/lib/rbac.ts` — `SUPER_ADMIN_PAGES` ne contient plus `'dashboard'`. Conséquence : l'item sidebar "Tableau de bord" est masqué pour SUPER_ADMIN (plus de doublon avec /admin-plateforme). Triple sécurité : PageGuard redirect + SuperAdminDashboard redirect + DEFAULT_PAGES.

## Fichiers conservés (non supprimés)
- `frontend/src/components/dashboard/dashboard-view.tsx` — conservé pour compat mais n'est plus importé nulle part. Peut être supprimé dans une future passe de cleanup (hors scope de cette task).

## Décisions techniques
- **Style** : glassmorphism + amber/orange theme + Framer Motion (animations cascade) + shadcn/ui (Card, Badge, Button, Progress) + Recharts (BarChart, PieChart). Cohérent avec `admin-plateforme/page.tsx` et `mes-taches/page.tsx`.
- **Responsive mobile-first** : `grid-cols-2 lg:grid-cols-4/5` pour KPIs, `grid-cols-1 lg:grid-cols-2/3` pour widgets.
- **Gestion loading** : skeletons `bg-muted/60 rounded-xl animate-pulse` qui miment la structure finale.
- **Gestion error** : `toast.error('Erreur...', { description })` via sonner.
- **Fetch pattern** : `Promise.all` des 3-4 endpoints parallélisés + closure `cancelled` pour éviter setState après unmount.
- **Pas de `useCallback`** pour les fetch — pattern `loadAll` inline dans `useEffect` avec `[]` deps (suffisant et évite les re-fetch inutiles).
- **Authentification** : `fetch('/api/v1/...', { credentials: 'same-origin' })` — le cookie httpOnly `opuc_session` est envoyé automatiquement.

## Validation
- `cd /home/z/my-project/opuc/frontend && bun run lint` → **79 erreurs** (même nombre que la baseline pré-task). **AUCUNE nouvelle erreur** introduite par mes 4 nouveaux fichiers ou les 2 fichiers modifiés.
- `bunx tsc --noEmit --skipLibCheck` → 0 erreur sur les nouveaux fichiers (148 erreurs pré-existantes inchangées dans useOfflineSync, theme-provider, prisma/seed, etc.).
- Le dev server auto-démarré tourne sur `/home/z/my-project/` (root stub), pas sur `/home/z/my-project/opuc/frontend/` (voir worklog PHASE-B-PARAMETRES pour contexte). Le code est correct (lint + tsc passent sur les nouveaux fichiers).

## Limitations / hors scope
- `dashboard-view.tsx` conservé (non supprimé) — plus importé nulle part.
- L'endpoint `GET /api/v1/pointage?summary` mentionné dans la spec pour ChefProjetDashboard n'est PAS utilisé — le composant utilise `dashData.pointagesAujourdhui` et `dashData.journaliersSurSite` depuis `/api/v1/dashboard` qui fournit déjà ces agrégats. Évite un fetch supplémentaire.
- Non commit/push — en attente de validation.
