# Task 21 — Frontend Agent (SPA → App Router migration)

## Task
Convertir la navigation SPA (state-based via `currentView` Zustand) en navigation URL-based
(Next.js App Router). URLs cible: `/dashboard`, `/chantiers`, `/planning`, `/chantiers/[id]`,
etc. — comme https://opuc.vercel.app/planning.

## Scope
- Working directory: `/home/z/my-project/frontend/`
- 9 fichiers modifiés, 24 nouveaux fichiers créés sous `src/app/(app)/`
- Lint: `bun run lint` → EXIT 0
- TypeScript: 0 erreur introduite (3 erreurs pré-existantes résolues par la migration)

## Files modified
1. `src/store/app-store.ts` — Supprimé `currentView` + `setCurrentView`
2. `src/app/page.tsx` — Simplifié (landing/auth flow + redirect `/dashboard`)
3. `src/components/layout/app-layout.tsx` — `usePathname` + `<Link>` au lieu de `setCurrentView`
4. `src/components/layout/search-command.tsx` — `useRouter().push()`
5. `src/components/layout/user-menu.tsx` — Supprimé dead code `setCurrentView`
6. `src/components/dashboard/dashboard-view.tsx` — 6 `router.push()` replacements
7. `src/components/chantiers/chantiers-view.tsx` — `router.push('/chantiers/${id}')`
8. `src/components/chantiers/chantier-detail-view.tsx` — 3 `router.push('/chantiers')`
9. `src/components/planning/planning-view.tsx` — `router.push('/chantiers/${id}')`

## Files created (24)
- `src/app/(app)/layout.tsx` — Auth-gated layout + providers
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/planning/page.tsx`
- `src/app/(app)/chantiers/page.tsx`
- `src/app/(app)/chantiers/[id]/page.tsx` — Sync URL param → `setSelectedChantierId`
- `src/app/(app)/pointage/page.tsx`
- `src/app/(app)/personnel/page.tsx`
- `src/app/(app)/paie/page.tsx`
- `src/app/(app)/sous-traitants/page.tsx`
- `src/app/(app)/stocks/page.tsx`
- `src/app/(app)/budget/page.tsx`
- `src/app/(app)/engins/page.tsx`
- `src/app/(app)/carburant/page.tsx`
- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/devis/page.tsx`
- `src/app/(app)/contrats/page.tsx`
- `src/app/(app)/facturation/page.tsx`
- `src/app/(app)/rapports/page.tsx`
- `src/app/(app)/photos/page.tsx`
- `src/app/(app)/documents/page.tsx`
- `src/app/(app)/support/page.tsx`
- `src/app/(app)/gestion-acces/page.tsx`
- `src/app/(app)/admin-plateforme/page.tsx`
- `src/app/(app)/parametres/page.tsx`

## Architecture decisions

### 1. Providers in (app)/layout.tsx
Le root `src/app/layout.tsx` ne contient PAS ThemeProvider/QueryProvider/AuthProvider
(contrairement à ce que disait l'énoncé du task). Pour ne pas modifier le root layout,
les providers sont montés dans `(app)/layout.tsx` (et restent aussi dans `page.tsx` pour
la landing/auth flow). Légère duplication mais isole correctement les deux contextes
(auth vs app).

### 2. Chantier detail — sync URL → store
Le `ChantierDetailView` lit `selectedChantierId` depuis le Zustand store. Au lieu de
modifier le composant pour utiliser `useParams()`, la page wrapper
`/chantiers/[id]/page.tsx` utilise un `useEffect` qui pousse `params.id` dans
`setSelectedChantierId`. Cela supporte:
- Navigation in-app (ChantiersView/PlanningView/DashboardView appellent déjà
  `setSelectedChantierId(id)` avant `router.push`)
- Accès direct par URL (le wrapper sync le store depuis l'URL)

### 3. Active state sidebar
`pathname === \`/${item.id}\` || pathname.startsWith(\`/${item.id}/\`)`
Couvre `/chantiers` ET `/chantiers/abc` (chantiers reste highlighté).

### 4. Redirect auth
`useEffect` + `window.location.href` plutôt que `router.push` pour garantir un full
reload qui remonte les providers du bon sous-arbre React (root layout vs (app) layout).

## Pre-existing TypeScript errors (NON introduits)
- `src/app/layout.tsx(24,3)` — Viewport.display (Next 16 typing)
- `src/components/auth/login-form.tsx` — framer-motion Variants typing
- `src/components/chantiers/chantier-detail-view.tsx(224)` — Set<unknown> (data.phases any)
- `src/components/planning/planning-view.tsx` — plusieurs erreurs pre-existing
- `src/components/gestion-acces/gestion-acces-view.tsx(35)` — Checkbox icon manquant
- `src/components/pwa/*`, `src/hooks/useOfflineSync.ts`, `src/providers/theme-provider.tsx`

## TS errors RESOLVED by migration
- `src/app/page.tsx(134)` — `premiereConnexion` sur SessionUser (cast type local maintenant)
- `src/components/dashboard/dashboard-view.tsx(571)` — `setCurrentView(action.view)` AppPage
- `src/components/layout/search-command.tsx(70)` — `setCurrentView(viewId)` AppPage
(router.push prend une string libre)

## Verification
```
$ bun run lint
$ eslint .
EXIT: 0
```

## Flow de navigation post-migration
1. Visiteur non-auth sur `/` → LandingPage
2. Clic "Se connecter" → LoginForm
3. Submit → `goApi.login()` + `window.location.href = '/'`
4. `/` recharge → useSession fetch /me → session détecté → useEffect → `window.location.href = '/dashboard'`
5. `/dashboard` → (app)/layout vérifie session → AppLayout render DashboardView
6. Sidebar Link → navigation client-side vers `/planning`, `/chantiers`, etc.
7. SearchCommand (⌘K) → `router.push('/<id>')`
8. Chantiers list clic œil → `setSelectedChantierId(id)` + `router.push('/chantiers/${id}')`
9. Chantier detail back → `router.push('/chantiers')`
10. SignOut → cookie cleared → `window.location.href = '/'` → landing page
