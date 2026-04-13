# OPUC — Outil de Pilotage Unifié de Chantier — Phase 0 Setup

## Date: 2026-04-13

## Completed Tasks

### 1. Prisma Schema
- Created comprehensive database schema with 20+ models
- Models include: Entreprise, User, Account, Session, VerificationToken, Chantier, Journalier, JournalierAffectation, Pointage, PaiementHebdo, Phase, Tache, StockMateriel, EntreeStock, SortieStock, Equipement, EquipementAffectation, LocationEngin, SousTraitant, ContratST, Photo, RapportJournalier, Notification
- Fixed SQLite compatibility issues (removed `@db.Text` annotations)
- Fixed missing relation for Notification model
- Successfully pushed schema with `bun run db:push`

### 2. Seed Database
- Created `prisma/seed.ts` with comprehensive demo data
- Demo Entreprise: "OPUC Démo SARL"
- 4 demo users with bcrypt hashed passwords (demo123)
- 2 demo Chantiers with budgets and statuses
- 5 demo Journaliers with different specialties
- 5 phases for the first chantier
- 8 demo tasks across phases
- 16 pointages (4 journaliers × 4 days)
- 8 stock materials with initial entries
- 1 daily report
- 4 notifications
- Added seed script to package.json

### 3. Dependencies
- Installed bcryptjs and @types/bcryptjs
- Installed @auth/prisma-adapter (later removed in favor of JWT-only approach)

### 4. NextAuth.js Configuration
- Created `src/lib/auth.ts` with CredentialsProvider
- JWT strategy with role and userId in token
- Custom authorize function with bcrypt password verification
- Session and JWT callbacks for role propagation
- Created `src/app/api/auth/[...nextauth]/route.ts`

### 5. Providers
- Created `src/providers/auth-provider.tsx` (NextAuth SessionProvider)
- Created `src/providers/theme-provider.tsx` (next-themes)

### 6. State Management
- Created `src/store/app-store.ts` with Zustand
- State: currentView, selectedChantierId, sidebarOpen
- Actions for all state transitions

### 7. Theme & Styling
- Updated `src/app/globals.css` with amber/orange color scheme
- Light and dark theme support using oklch colors
- Custom sidebar colors (dark amber theme)
- Custom scrollbar styling
- Fade-in animation utility

### 8. Layout & Navigation
- Created `src/components/layout/app-layout.tsx`
- Full sidebar navigation with 13 items
- Desktop sidebar + mobile hamburger menu
- Header with notifications bell
- Active state highlighting with amber accent
- User info display with avatar and role badge
- Logout button

### 9. Login Page
- Created `src/components/auth/login-form.tsx`
- Professional design with OPUC branding
- Email/password form with validation
- Password show/hide toggle
- Error handling
- Loading states
- Demo credentials hint box

### 10. Main Page
- Updated `src/app/layout.tsx` with French lang, OPUC metadata
- Updated `src/app/page.tsx` with full client-side routing
- Authentication gate with loading spinner
- Session-based view rendering

### 11. Dashboard View
- Created `src/components/dashboard/dashboard-view.tsx`
- 4 summary cards (chantiers actifs, journaliers, pointages, alertes)
- Budget bar chart (prévisionnel vs réel) using recharts
- Chantier status pie chart
- Phase progress bars
- Quick action buttons
- Recent notifications feed
- Data fetched from `/api/dashboard` endpoint

### 12. Placeholder Views
- Created `src/components/dashboard/placeholder-view.tsx`
- Professional "coming soon" cards for all unimplemented modules

### 13. API Endpoints
- `/api/auth/[...nextauth]` — NextAuth
- `/api/dashboard` — Dashboard data

## Verification
- ✅ `bun run lint` passes
- ✅ `bun run db:push` succeeds
- ✅ `bun run db:seed` succeeds
- ✅ Dev server running on port 3000
- ✅ HTTP 200 on `/`
- ✅ HTTP 200 on `/api/auth/session`
- ✅ HTTP 302 on auth callback

## Demo Credentials
- admin@opuc.demo / demo123 (ADMIN)
- chef-entreprise@opuc.demo / demo123 (CHEF_ENTREPRISE)
- conducteur@opuc.demo / demo123 (CONDUCTEUR)
- chef-chantier@opuc.demo / demo123 (CHEF_CHANTIER)

---

# Task 2 — Chantiers (Construction Sites) List View

## Date: 2026-04-13

## Summary
Built the complete Chantiers list view with CRUD operations, filtering, search, KPI cards, and responsive card grid.

## Files Created

### 1. API: `/src/app/api/chantiers/route.ts`
- **GET** — List chantiers with optional `statut` and `search` query params
  - Returns chantiers with phase/journalier counts and computed global avancement
  - Returns KPI summary (total, actifs, enPreparation, termines)
- **POST** — Create a new chantier (nom required)
  - Accepts: nom, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, description

### 2. API: `/src/app/api/chantiers/[id]/route.ts`
- **GET** — Get single chantier with phase/journalier counts
- **PUT** — Update chantier fields + statut
- **DELETE** — Delete chantier (cascades via Prisma)

### 3. Component: `/src/components/chantiers/chantiers-view.tsx`
- **Header** with title + "Nouveau chantier" button (amber-themed)
- **KPI cards row**: Total chantiers, Actifs, En préparation, Terminés (responsive 2→4 cols)
- **Filter tabs**: Tous, En préparation, En cours, En pause, Terminé, Réceptionné
- **Search bar** with icon, searches by nom, adresse, maitreOuvrage
- **Chantier cards grid** (1→2→3 cols responsive) with:
  - Name (bold, line-clamped)
  - Address (truncated, with MapPin icon)
  - Maître d'ouvrage (with User icon)
  - Budget formatted in FCFA (e.g., "150 000 000 FCFA")
  - Status badge (color-coded: amber/emerald/orange/slate/blue)
  - Global avancement progress bar
  - Phase count & journalier count
  - Start/end dates with Clock icon
  - Action buttons: View detail (Eye), Edit (Pencil), Delete (Trash2)
- **Create/Edit dialog** with form: nom, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, description, statut (edit only)
- **Delete confirmation dialog** (AlertDialog)
- **Empty state** with contextual messaging and CTA
- **Loading state** with skeleton cards
- **Framer Motion animations** on card entry (fade in + stagger)
- **Toast notifications** via sonner for all CRUD operations

## Files Modified

### 4. `/src/app/page.tsx`
- Added import for `ChantiersView`
- Added `case 'chantiers'` in view router

## Design Choices
- Amber/orange primary color consistent with construction theme
- Custom filter tabs instead of shadcn Tabs (more compact, mobile-friendly)
- Card-based layout instead of table for richer visual presentation
- Computed `avancementGlobal` (average of phase avancements) in the API
- KPI counts computed server-side for accuracy
- date-fns with fr locale for date formatting
- `Intl.NumberFormat('fr-FR')` for FCFA number formatting

## Verification
- ✅ `bun run lint` passes with no errors
- ✅ Dev server running, GET / returns 200
- ✅ Compilation successful (no TypeScript errors)

---

# Task 4 — Chantier Detail View

## Date: 2026-04-13

## Summary
Created the comprehensive ChantierDetailView component — the full detail page for a single construction site (chantier) with KPI cards, 3 tabs (overview, phases/tasks, team), and full CRUD for phases and tasks.

## Files Created

### 1. Component: `/src/components/chantiers/chantier-detail-view.tsx` (~830 lines)
- **Header**: Back button, chantier name (h2), status badge, edit/delete buttons
- **KPI Cards Row** (4 cards, responsive 2→4 cols):
  - Avancement global (with progress bar)
  - Budget prévisionnel (FCFA formatted)
  - Journaliers affectés (count)
  - Pointages totaux (count from _count.pointages)
- **Tab 1 — Vue d'ensemble**:
  - Description card
  - Info grid: Adresse, Maître d'ouvrage, Date début/fin, Entreprise, Budget réel
  - Phases timeline with visual indicators (circles, vertical lines, progress bars)
- **Tab 2 — Phases & Tâches**:
  - Collapsible phase cards (auto-expanded on load)
  - Each phase: order badge, progress bar, date range, task count
  - Tasks inside each phase: statut badge (color-coded), name, responsable, dates
  - Inline avancement edit (click to open number input, Enter/Escape/blur)
  - Add task button per phase, Add phase button at bottom
  - Create phase dialog (nom, description, dateDebut, dateFin)
  - Create task dialog (nom, description, dates, tachePrecedenteId)
  - Delete phase/task with confirmation dialogs
  - Empty state when no phases
- **Tab 3 — Équipe**:
  - List of active journaliers with avatar (initials), name, specialty, phone
  - "Actif" badge for each member
  - Empty state when no journaliers assigned
- **Edit Chantier Dialog**: Full form (nom, description, adresse, maitreOuvrage, dates, budget, statut)
- **Delete Chantier Alert Dialog**: Warning about irreversible data loss
- **Loading skeleton** while fetching data
- **Toast notifications** for all CRUD operations

## Files Modified

### 2. `/src/app/page.tsx`
- Added import for `ChantierDetailView`
- Added `case 'chantier-detail'` in view router

## API Endpoints Used
- `GET /api/chantiers/[id]` — Full detail with phases, taches, journaliers
- `PUT /api/chantiers/[id]` — Update chantier
- `DELETE /api/chantiers/[id]` — Delete chantier
- `POST /api/chantiers/[id]/phases` — Create phase
- `DELETE /api/chantiers/[id]/phases/[phaseId]` — Delete phase
- `POST /api/chantiers/[id]/phases/[phaseId]/taches` — Create task
- `PUT /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId]` — Update task avancement
- `DELETE /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId]` — Delete task

## Design Choices
- Amber/orange construction theme consistent with project
- Task statut colors: PLANIFIEE (slate), EN_COURS (amber), TERMINEE (emerald), EN_RETARD (red)
- French locale via date-fns, FCFA formatting via Intl.NumberFormat
- Inline avancement editing for quick task progress updates
- Collapsible phases to reduce visual noise (auto-expanded on first load)
- Delete buttons for tasks shown on hover to reduce clutter
- Responsive: mobile-first, stacks cards vertically on small screens

## Verification
- ✅ `bun run lint` passes (0 errors)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'chantier-detail' route case

---

# Task 5-6 — Personnel (Journaliers) Module

## Date: 2026-04-13

## Summary
Built the complete Personnel module with backend APIs and frontend view — CRUD operations for journaliers, chantier assignment management, filtering by specialty/chantier, KPI stats, and responsive list UI.

## Files Created

### 1. API: `/src/app/api/personnel/route.ts`
- **GET** — List all journaliers with optional query params:
  - `?search=` — Filter by nom, prenom, or telephone (contains search)
  - `?specialite=` — Filter by specialty (Maçon, Ferrailleur, Électricien, etc.)
  - `?chantierId=` — Filter by active assignment to a specific chantier
  - Returns journaliers with active affectations (including chantier info: id, nom, statut)
  - Returns KPI summary (total, macons, ferrailleurs, electriciens, autres)
- **POST** — Create a new journalier. Required: nom, prenom. Optional: telephone, specialite.

### 2. API: `/src/app/api/personnel/[id]/route.ts`
- **GET** — Get journalier detail with all affectations and pointage history (last 50)
- **PUT** — Update journalier fields (nom, prenom, telephone, specialite)
- **DELETE** — Delete journalier and cascade delete pointages and affectations

### 3. API: `/src/app/api/personnel/[id]/affectations/route.ts`
- **POST** — Assign journalier to a chantier. Body: { chantierId, dateDebut, dateFin? }
  - Deactivates any existing active assignment to same chantier before creating new one
  - Returns created affectation with chantier info
- **DELETE** — Remove active assignment by query param `?chantierId=`
  - Sets `actif: false` and `dateFin` to current date
  - Returns 404 if no active assignment found

### 4. Component: `/src/components/personnel/personnel-view.tsx` (~560 lines)
- **Header**: "Personnel" title + "Nouveau journalier" button (amber-themed)
- **KPI stats row** (5 cards, responsive 2→3→5 cols):
  - Total journaliers, Maçons, Ferrailleurs, Électriciens, Autres
  - Each with colored icon and count
- **Filter section** (card with search + 2 selects):
  - Search input: searches by nom, prenom, telephone
  - Specialty select: Tous, Maçon, Ferrailleur, Électricien, Plombier, Peintre, Autre
  - Chantier select: Tous les chantiers + dynamically fetched chantier list
- **Journalier list** (vertical card layout):
  - Avatar with initials fallback (amber-themed)
  - Full name (prenom + nom), specialty badge (color-coded per type)
  - Phone number with Phone icon
  - Active affectations shown as inline badges with chantier name + date range
  - Remove assignment button (X icon, visible on hover per affectation badge)
  - "Non affecté" italic text when no active assignments
  - Action buttons: Assign to chantier (UserPlus), Edit (Pencil), Delete (Trash2)
- **Create/Edit dialog**: Form with nom, prenom (side by side), telephone, specialite (select)
- **Assign to chantier dialog**: Chantier select, dateDebut (required), dateFin (optional)
- **Delete confirmation dialog** (AlertDialog): Warns about cascade deletion
- **Remove assignment dialog** (AlertDialog): Confirms deactivation
- **Empty state**: Contextual message + CTA when no filters active
- **Loading state**: Skeleton card rows
- **Framer Motion animations**: Fade-in + stagger on journalier cards
- **Toast notifications** via sonner for all operations
- **Specialty color mapping**: Maçon (amber), Ferrailleur (slate), Électricien (yellow), Plombier (blue), Peintre (purple), Autre (gray)
- **Specialty icon mapping**: Maçon (Wrench), Ferrailleur (Briefcase), Électricien (Zap), Plombier (Droplets), Peintre (Paintbrush)

## Files Modified

### 5. `/src/app/page.tsx`
- Added import for `PersonnelView`
- Added `case 'personnel'` in view router

## Design Choices
- Amber/orange construction theme consistent with existing project
- List layout (vertical cards) instead of grid — better for displaying variable-length assignment data
- Active affectations shown inline per card for quick visibility
- Deactivate-on-assign pattern: existing active assignments are deactivated before creating new ones
- Deactivate-on-remove pattern: assignments are soft-deactivated (actif=false) with dateFin set
- French locale via date-fns for date formatting
- Mobile-first responsive design (filters stack vertically on small screens)

## Verification
- ✅ All personnel API files pass ESLint with 0 errors
- ✅ Dev server compiles successfully (HTTP 200 on /)
- ✅ Page.tsx updated with 'personnel' route case
- ✅ No TypeScript compilation errors

---

# Task 7-8 — Pointage (Daily Attendance) Module

## Date: 2026-04-13

## Summary
Built the complete Pointage module with backend APIs and frontend view — daily attendance tracking for journaliers, batch create/update, history browsing, weekly summary with week navigation, and validation-aware business rules.

## Files Created

### 1. API: `/src/app/api/pointage/route.ts`
- **GET** — List pointages with query params:
  - `?chantierId=` — Filter by chantier
  - `?date=` — Filter by specific date (day range: 00:00–23:59)
  - `?dateDebut=&dateFin=` — Date range filter
  - `?journalierId=` — Filter by journalier
  - `?valide=` — Filter by validation status (true/false)
  - Includes journalier info (id, nom, prenom, specialite) and chantier info (id, nom)
  - Ordered by dateTravail desc
- **POST** — Batch create/update pointages. Body: `{ chantierId, date, chefChantierId, pointages: [...] }`
  - Upsert logic: uses unique constraint (journalierId + chantierId + dateTravail)
  - Existing pointages are updated; new ones are created
  - Validated pointages are skipped (returns skipped flag)
  - Returns array of created/updated/skipped pointages

### 2. API: `/src/app/api/pointage/[id]/route.ts`
- **PUT** — Update a single pointage (present, tauxJournalier, observation)
  - Returns 403 if pointage is validated (valide=true)
  - Returns 404 if not found
- **DELETE** — Delete a single pointage
  - Returns 403 if validated, 404 if not found

### 3. API: `/src/app/api/pointage/summary/route.ts`
- **GET** — Weekly summary for a chantier. Query params:
  - `?chantierId=` (required)
  - `?semaine=` — ISO week format (YYYY-WNN) or any date within the week
  - Defaults to current week if no semaine provided
  - Returns: weekStart, weekEnd, summary (per journalier: days, totalAmount, details), grandTotal, totalDays

### 4. API: `/src/app/api/pointage/affectations/route.ts`
- **GET** — Get active journalier affectations for a chantier
  - Query param: `?chantierId=` (required)
  - Returns affectations with journalier info (id, nom, prenom, specialite)
  - Ordered by dateDebut desc

### 5. Component: `/src/components/pointage/pointage-view.tsx` (~490 lines)
- **Header**: "Pointage Journalier" title with ClipboardList icon
- **Selection card** (4-col responsive grid):
  - Chantier selector (Select component, shows only EN_COURS chantiers)
  - Date picker (Popover + Calendar with fr locale)
  - Quick date buttons: "Aujourd'hui" / "Hier"
  - Info box: journalier count, present count, running total in FCFA
- **Tab 1 — Pointage form**:
  - List of journaliers assigned to selected chantier
  - Each row: Checkbox (present/absent), avatar + name + specialty, taux journalier input (number, FCFA label), observation input
  - Taux pre-filled with last known value for this journalier on this chantier
  - When unchecked (absent): row greyed out, taux and observation disabled
  - Real-time running total (present count + FCFA total) at bottom
  - "Enregistrer le pointage" button (top + bottom of form)
  - Desktop: 4-column grid layout; Mobile: stacked with inline labels
- **Tab 2 — Historique**:
  - Shows last 7 days of pointages for selected chantier
  - Table columns: Date, Journalier (with specialty), Présent (badge), Taux, Montant, Statut (Validé/En attente)
  - Lazy-loaded on first tab visit
  - Resets when chantier changes
- **Tab 3 — Résumé Hebdo**:
  - Weekly summary table: Journalier (avatar + name), Spécialité, Jours travaillés (badge), Montant total
  - Grand total row in footer (amber-highlighted)
  - Week navigation: prev/next buttons with formatted week label
  - Future weeks disabled (cannot navigate past current week)
  - Lazy-loaded on first tab visit

## Files Modified

### 6. `/src/app/page.tsx`
- Added import for `PointageView`
- Added `case 'pointage'` in view router

## Business Rules Implemented
1. Chef de chantier selects date + chantier → sees all assigned journaliers
2. Per journalier: present/absent toggle, free taux journalier, observation
3. Taux pre-filled from last pointage on this chantier
4. Upsert: unique constraint (journalierId + chantierId + dateTravail) prevents duplicates
5. Validated pointages cannot be modified or deleted (403 response)
6. Toast notifications for success/warning (skipped validated) / error

## Design Choices
- Amber/orange construction theme consistent with project
- Tabs instead of collapsible sections for cleaner navigation
- Lazy-loading for history and summary data (only fetched when tab is active)
- Real-time running total with FCFA formatting
- Mobile-first responsive: stacked inputs with labels on small screens, 4-col grid on desktop
- date-fns with fr locale; `Intl.NumberFormat('fr-FR')` for FCFA
- shared `EmptyState` sub-component for consistent empty states

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'pointage' route case

---

# Task 11 — Stocks (Inventory Management) Module

## Date: 2026-04-13

## Summary
Built the complete Stocks module with backend APIs and frontend view — inventory management per chantier, real-time stock level calculation, entries (livraisons/deliveries), exits (consommations/consumption), alert system for low stock, and comprehensive CRUD operations.

## Files Created

### 1. API: `/src/app/api/stocks/route.ts`
- **GET** — List stock items for a chantier. Query params: `?chantierId=` (required), `?categorie=`.
  - Calculates in real-time (never stored):
    - `quantiteDisponible` = SUM(entrees.quantite) - SUM(sorties.quantite)
    - `valeurStock` = quantiteDisponible × weighted average prixUnitaire
    - `enAlerte` = quantiteDisponible <= seuilAlerte
  - Returns `_count` of entrees and sorties
  - Returns KPI summary: totalMateriaux, valeurTotale, articlesEnAlerte
- **POST** — Create a stock material. Body: { chantierId, reference, designation, categorie, unite, seuilAlerte }

### 2. API: `/src/app/api/stocks/[id]/route.ts`
- **PUT** — Update stock material (reference, designation, categorie, unite, seuilAlerte)
- **DELETE** — Delete stock material with cascading deletion of related entrees and sorties

### 3. API: `/src/app/api/stocks/entrees/route.ts`
- **GET** — List stock entries. Query params: `?chantierId=`, `?stockId=`, `?dateDebut=`, `?dateFin=`
  - Includes stock info (reference, designation, unite)
  - Ordered by dateEntree desc
- **POST** — Create stock entry. Body: { stockId, chantierId, quantite, prixUnitaire, fournisseur, numeroBL, dateEntree }
  - Validates: stockId, chantierId, quantite > 0, prixUnitaire >= 0

### 4. API: `/src/app/api/stocks/sorties/route.ts`
- **GET** — List stock exits. Query params: `?chantierId=`, `?stockId=`, `?dateDebut=`, `?dateFin=`
  - Includes stock info and tache info (if linked)
  - Ordered by dateSortie desc
- **POST** — Create stock exit. Body: { stockId, chantierId, quantite, tacheId, operateur, motif, dateSortie }
  - **Business rule**: validates quantite <= available stock (SUM entrees - SUM sorties)
  - Returns 400 with `quantiteDisponible` if exceeds available stock

### 5. API: `/src/app/api/stocks/entrees/[id]/route.ts`
- **DELETE** — Delete a stock entry

### 6. API: `/src/app/api/stocks/sorties/[id]/route.ts`
- **DELETE** — Delete a stock exit

### 7. Component: `/src/components/stocks/stocks-view.tsx` (~750 lines)
- **Header**: "Stocks" title with Package icon + "Ajouter un matériau" button (amber-themed)
- **Chantier selector** card at the top (required to see any stock data)
- **KPI cards row** (3 cards, responsive 1→3 cols):
  - Total matériaux (amber icon)
  - Valeur totale du stock (emerald icon, FCFA formatted)
  - Articles en alerte (red icon, highlighted when > 0)
- **Alerts banner**: Red-bordered card listing all materials at or below seuilAlerte as clickable badges
- **Tab 1 — Inventaire**:
  - Search input + category filter select (gros_oeuvre, finition, electricite, plomberie, divers)
  - Responsive table: Réf., Désignation, Catégorie, Unité, Stock dispo., Seuil, Valeur, Statut, Actions
  - Color-coded stock level badges: green (OK), amber (< 2x seuil), red (<= seuil)
  - Action buttons per row: Quick add entry (→), Edit (Pencil), Delete (Trash2)
  - Hover-reveal action buttons on desktop
  - Empty state with CTA when no materials
- **Tab 2 — Entrées (Livraisons)**:
  - Entry form (left column): matériau select (with available stock hint), quantité, prix unitaire, fournisseur, N° BL, date
  - Entries history table (right column): Date, Matériau, Qté, Prix total, Fournisseur, N° BL
  - Filter by material select
  - Delete button per entry
- **Tab 3 — Sorties (Consommations)**:
  - Sortie form (left column): matériau select (with available stock display), quantité (with stock warning), tâche (optional, fetched from chantier phases/tasks), opérateur, motif, date
  - Sorties history table (right column): Date, Matériau, Qté, Opérateur, Motif, Tâche
  - Filter by material select
  - Delete button per sortie
- **Create/Edit material dialog**: Form with reference, designation, categorie, unité (9 options), seuilAlerte
- **Delete confirmation dialog**: Warning about irreversible cascade deletion
- **Loading state**: Skeleton cards while fetching
- **Framer Motion animations**: Fade-in + stagger on KPI cards and table rows
- **Toast notifications** via sonner for all CRUD operations

## Files Modified

### 8. `/src/app/page.tsx`
- Added import for `StocksView`
- Added `case 'stocks'` in view router

## Business Rules Implemented
1. Each chantier has isolated stock inventory (filtered by chantierId)
2. Stock disponible = SUM(entrees.quantite) - SUM(sorties.quantite) — calculated in real-time, NEVER stored
3. Valeur stock = quantiteDisponible × weighted average prixUnitaire from all entries
4. Alert when stock falls below seuilAlerte (red banner + badge + KPI highlight)
5. Sortie blocked if quantity exceeds available stock (400 response with available quantity)
6. Stock entries link to supplier and BL number (delivery tracking)
7. Sorties can optionally link to a task (tâche)

## Design Choices
- Amber/orange theme consistent with construction project
- Three-tab layout: Inventaire, Entrées, Sorties for clean navigation
- Lazy-loading for entrees/sorties data (only fetched when tab is active)
- Color-coded stock levels: green (OK), amber (< 2x seuil), red (<= seuil) for visual urgency
- Alert banner auto-collapse when no items in alert
- French locale via date-fns, FCFA formatting via Intl.NumberFormat
- Mobile-first responsive: stacked forms on small screens, side-by-side on desktop
- Action buttons hover-reveal on desktop to reduce visual clutter
- Task (tâche) dropdown fetched from the selected chantier's phases/tasks

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully (HTTP 200 on /)
- ✅ Page.tsx updated with 'stocks' route case

---

# Task 9-10 — Paie Hebdomadaire (Weekly Payment) Module

## Date: 2026-04-13

## Summary
Built the complete Paie Hebdomadaire module with backend APIs and frontend view — weekly payment summary generation from pointages, conductor validation workflow with partial payment support, notification creation, and comprehensive payment management table with filters.

## Files Created

### 1. API: `/src/app/api/paie/route.ts`
- **GET** — List all paiements with query params:
  - `?chantierId=` — Filter by chantier
  - `?statut=` — Filter by statut (EN_ATTENTE, VALIDE, PARTIELLEMENT_VERSE, or TOUS for all)
  - `?semaineDebut=` — Filter by week start date
  - Includes journalier info (id, nom, prenom, specialite) and validePar info (id, name)
  - Ordered by createdAt desc

### 2. API: `/src/app/api/paie/generate/route.ts`
- **POST** — Generate weekly payment summary. Body: `{ chantierId, semaineDebut (ISO date of Monday) }`
  - Computes Monday 00:00 to Sunday 23:59 for the given week
  - Queries all pointages for the chantier within the week where present=true
  - Groups by journalier
  - For each journalier: calculates montantCalcule = sum of tauxJournalier
  - Upsert logic: creates new PaiementHebdo or updates existing (only if EN_ATTENTE)
  - Validated/skipped paiements are returned with skipped flag
  - Returns array of created/updated/skipped records

### 3. API: `/src/app/api/paie/[id]/route.ts`
- **GET** — Payment detail with related pointages
  - Includes journalier full info, validePar info
  - Fetches related pointages for the journalier+chantier+week (present=true)
- **PUT** — Validate payment. Body: `{ montantVerse, modePaiement, datePaiement, differenceComment, valideParId }`
  - Validates: montantVerse required, modePaiement required, datePaiement required
  - Returns 404 if not found, 400 if already validated
  - Determines statut: VALIDE if montantVerse >= montantCalcule, PARTIELLEMENT_VERSE otherwise
  - Marks all related pointages (journalier+chantier+week, present=true, valide=false) as valide=true
  - Creates a Notification for the first active CHEF_CHANTIER user
  - Returns paiement + pointagesValidated count
- **DELETE** — Cancel/delete payment
  - If validated: reverts related pointages to valide=false before deletion
  - Hard delete the PaiementHebdo record

### 4. Component: `/src/components/paie/paie-view.tsx` (~600 lines)
- **Header**: "Paie Hebdomadaire" title with Wallet icon
- **Selection card** (4-col responsive grid):
  - Chantier selector (Select component, shows only EN_COURS chantiers)
  - Week picker with prev/next navigation (formatted in French: "13 Jan – 19 Jan 2025")
  - "Générer le récapitulatif" button (amber-themed, with loading spinner)
  - Info box: journalier count, en attente count, total FCFA
- **Filter tabs**: TOUS, EN_ATTENTE, VALIDÉS, PARTIELS (amber-highlighted active tab)
- **Payment summary table** with columns:
  - Journalier (avatar with initials + name + specialty)
  - Jours travaillés (estimated badge from taux)
  - Montant calculé (formatted FCFA)
  - Montant versé (formatted FCFA or "—")
  - Écart (calculated: versé - calculé, colored red/green)
  - Mode de paiement (Espèces, Mobile Money, Virement)
  - Date de paiement
  - Statut badge (EN_ATTENTE amber, VALIDE emerald, PARTIELLEMENT_VERSE orange)
  - Actions: View detail (Eye), Validate (CheckCircle2, only EN_ATTENTE), Delete (Trash2, only EN_ATTENTE)
- **Summary footer**: Total calculé, Total versé, Total écart (amber-highlighted row)
- **Validate dialog**: Form with montant versé (with écart preview), mode paiement select, date paiement input, commentaire optionnel, "Confirmer le paiement" button
- **Detail dialog**: Shows payment info (amounts, statut, mode, date, validateur), difference comment (orange banner), and list of related pointages with date + taux + validation status
- **Delete confirmation dialog** (AlertDialog): Warns about pointage reversion for validated payments
- **Empty state**: Contextual message with CTA when no payments found
- **Loading state**: Skeleton rows while fetching
- **Toast notifications** for all operations (generate, validate, delete, errors)

## Files Modified

### 5. `/src/app/page.tsx`
- Added import for `PaieView`
- Added `case 'paie'` in view router

## Business Rules Implemented (from CDC)
1. Weekly summary auto-generated for selected week (Monday–Sunday)
2. For each journalier: montantCalcule = sum of tauxJournalier for days where present=true
3. Conductor validates: enters montantVerse (can differ from calculated), modePaiement, datePaiement
4. Statut workflow: EN_ATTENTE → VALIDE (if montantVerse >= montantCalcule) or PARTIELLEMENT_VERSE
5. After validation, related pointages get `valide = true`
6. Chef de chantier receives PAIEMENT notification on validation
7. Delete reverts: validated pointages are set back to valide=false

## Design Choices
- Amber/orange construction theme consistent with project
- Table layout for payment data (better for side-by-side financial comparison)
- Filter tabs for quick status-based filtering
- Validate dialog shows real-time écart preview as user types montantVerse
- Detail dialog shows underlying pointages for transparency
- French locale via date-fns (startOfWeek/endOfWeek with weekStartsOn: 1), FCFA via Intl.NumberFormat
- Days worked estimated from tauxJournalier pattern (heuristic: divides by common daily rates)
- Week navigation with prev/next buttons, formatted in French

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'paie' route case

---

# Task 7 — Planning / Gantt Module

## Date: 2026-04-13

## Summary
Built the complete Planning / Gantt module — an interactive Gantt chart visualization for construction site phases and tasks, with chantier selector, month/week zoom, color-coded status bars, tooltips, detail dialogs, collapsible phases, today line, and responsive scroll.

## Files Created

### 1. Component: `/src/components/planning/planning-view.tsx` (~530 lines)
- **Header**: "Planning" title with GanttChart icon + legend (status colors + today line)
- **Chantier selector**: Dropdown using shadcn Select, auto-selects first chantier with phases
- **Zoom controls**: Toggle between month view and week view (ZoomIn/ZoomOut buttons)
- **Interactive Gantt chart**:
  - **Left column** (280px fixed): Phase/task names with hierarchy
    - Phase rows: bold name, collapsible (chevron toggle), amber avancement badge
    - Task rows: indented, color-coded left dot by statut, clickable
    - Synchronized vertical scroll with timeline body
  - **Timeline area**: Scrollable horizontal Gantt bars
    - **Timeline header**: Month labels or week labels depending on zoom
    - **Vertical grid lines** between time slots for visual alignment
    - **Phase bars**: 18px thick, amber gradient showing avancement overlay, label text
    - **Task bars**: 14px thin, color-coded by statut with avancement progress overlay
      - PLANIFIEE: slate/gray
      - EN_COURS: amber
      - TERMINEE: emerald
      - EN_RETARD: red
    - **Today line**: Red dashed vertical line at current date position
    - **Dot markers** for tasks without dates
  - **Bar positioning**: CSS-based — left = (dateDebut - timelineStart) / totalDays × 100%, width = duration / totalDays × 100%
  - **1-month padding** on each side of the timeline range
- **Tooltip on hover**: Shows task/phase name, date range, avancement %, responsable, statut badge
- **Click on task/phase bar**: Opens detail dialog with:
  - Statut badge (color-coded)
  - Avancement progress bar
  - Date début / Date fin
  - Duration (jours)
  - Responsable
  - Description
  - Task list for phases (with avancement badges)
- **Summary stats** below Gantt: Phases count, Tasks count, En cours, En retard
- **Empty state**: Contextual messaging when no chantier selected or no phases with dates
- **Loading states**: Skeleton header + controls + spinner card

## Files Modified

### 2. API: `/src/app/api/chantiers/[id]/route.ts`
- Updated GET endpoint `include` to return phases with nested taches (ordered by ordre) and tache responsable info
- Added pointages to `_count` select
- This ensures both the Planning view and Chantier Detail view get full phase/task data

### 3. `/src/app/page.tsx`
- Added import for `PlanningView`
- Added `case 'planning'` in view router

## Design Choices
- Amber/orange theme consistent with construction project
- Custom Gantt implementation using CSS positioning (no external library)
- Phase bars use amber gradient overlay for avancement visualization
- Task bars have background (light) + foreground (progress overlay) layered approach
- Synchronized scroll between left column names and right timeline body
- date-fns with fr locale for all date formatting and timeline calculations
- `differenceInDays`, `eachWeekOfInterval`, `eachMonthOfInterval`, `addMonths`, `startOfMonth`, `endOfMonth` for timeline math
- shadcn/ui: Card, Select, Badge, Button, Tooltip (with Provider), Dialog, ScrollArea, Separator, Skeleton, Progress
- Responsive: Left column fixed width, timeline scrolls horizontally, max-height on Gantt body

## Gantt Implementation Details
1. Collect all dateDebut/dateFin from phases and tasks
2. Find earliest and latest dates, add 1-month padding on each side
3. Compute totalDays = differenceInDays(rangeEnd, rangeStart) + 1
4. Generate time slots: months (eachMonthOfInterval) or weeks (eachWeekOfInterval, weekStartsOn: 1)
5. Each slot width = slot duration / totalDays × 100%
6. Bar positioning: left = (dateDebut - rangeStart) / totalDays × 100%, width = duration / totalDays × 100%
7. Today line: same left calculation with current date

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully (✓ Compiled in ~250ms)
- ✅ Page.tsx updated with 'planning' route case

---

# Task 6 — Budget (Budget Tracking) Module

## Date: 2026-04-13

## Summary
Built the complete Budget Tracking module with backend API and frontend view — dynamic budget analysis computed from 3 real cost sources (personnel, matériaux, sous-traitants), alert levels (OK/ATTENTION/CRITIQUE), comparison charts, historical spending area chart, and detailed breakdown table.

## Files Created

### 1. API: `/src/app/api/budget/[chantierId]/route.ts`
- **GET** — Full budget analysis for a chantier:
  - **Personnel cost**: SUM(tauxJournalier) from validated pointages where present=true
  - **Matériaux cost**: SUM(sorties.quantite × weighted average prixUnitaire from entrees) per material
    - Pre-fetches all entrees grouped by stockId (avoids N+1 queries)
    - Computes weighted average: Σ(qty × price) / Σ(qty) per stock material
  - **Sous-traitants cost**: SUM(montantHT) from contrats where statut != 'ANNULE'
  - **Totals**: coutTotal, ecart (prévisionnel - réel), ecartPourcentage
  - **Alert levels**: OK (< 80%), ATTENTION (>= 80%), CRITIQUE (>= 100%)
  - **Historical data**: Monthly cumulative spending (grouped by startOfMonth), sorted chronologically
    - Merges costs from all 3 sources with their respective dates
  - **Repartition**: Per-category breakdown with reel amounts and % of total

### 2. Component: `/src/components/budget/budget-view.tsx` (~500 lines)
- **Header**: "Suivi Budgétaire" title with PieChart icon + "Actualiser" refresh button
- **Chantier selector**: Card with dropdown (auto-selects from global store)
- **Main budget card**:
  - Large budget prévisionnel display (formatted FCFA)
  - Alert level badge (OK = emerald, ATTENTION = amber, CRITIQUE = red) with icon
  - Budget réel (dépenses) with colored progress bar:
    - Green < 60%, Amber 60-80%, Red > 80%
  - Custom ColoredProgress component (div-based, not limited by Radix indicator)
  - Écart display (absolute + percentage, color-coded green/red)
- **Breakdown cards** (3 cards, responsive 1→3 cols):
  - Personnel (blue icon): cost + % of total + progress bar
  - Matériaux (amber icon): cost + % of total + progress bar
  - Sous-traitants (violet icon): cost + % of total + progress bar
- **Comparison chart** (Recharts BarChart):
  - Prévisionnel vs Réel bars grouped by category
  - Categories: Personnel (40%), Matériaux (35%), Sous-traitants (25%), Total
  - Custom tooltip with FCFA formatting
  - Short number formatting on Y-axis (K, M, Md)
- **Historical spending chart** (Recharts AreaChart):
  - Monthly cumulative spending as gradient-filled area
  - Red dashed reference line at budget prévisionnel level
  - Empty state when no historical data
- **Detailed breakdown table**:
  - Columns: Catégorie (with icon), Budget Prévu (— since global), Dépensé (Réel), Écart (color-coded), % Consommé (color-coded)
  - Total row highlighted with muted background
  - Color thresholds: emerald < 60%, amber 60-80%, red > 80%
- **Loading states**: Skeleton cards for all sections
- **Empty states**: Contextual messaging for no chantier / no data
- **Framer Motion animations**: Fade-in on all cards with stagger delays

## Files Modified

### 3. `/src/app/page.tsx`
- Added import for `BudgetView`
- Added `case 'budget'` in view router

## Business Rules Implemented (from CDC)
1. Budget réel is dynamically calculated (never stored):
   - Personnel = SUM(tauxJournalier) from validated pointages (present=true, valide=true)
   - Matériaux = SUM(sorties.quantite × weighted average prixUnitaire) per material
   - Sous-traitants = SUM(montantHT) from contrats (statut != 'ANNULE')
2. Alert thresholds: 80% ATTENTION, 100%+ CRITIQUE
3. Historical data: cumulative monthly spending merged from all 3 sources
4. Weighted average prix: Σ(qty_i × price_i) / Σ(qty_i) from all entrees per stock material

## Design Choices
- Amber/orange chart palette (Prévisionnel = #d97706, Réel = #f59e0b)
- Custom ColoredProgress component instead of shadcn Progress (needed dynamic color classes)
- Per-category color scheme: Personnel (blue), Matériaux (amber), Sous-traitants (violet)
- Previsionnel split: 40% Personnel, 35% Matériaux, 25% Sous-traitants (heuristic for comparison chart)
- FCFA formatting via Intl.NumberFormat('fr-FR'), short format for chart axes
- Recharts: BarChart with grouped bars + AreaChart with gradient fill + ReferenceLine for budget limit
- French locale via date-fns for month labels in historical data

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'budget' route case

---

# Task 9 — Photothèque (Photo Gallery) Module

## Date: 2026-04-13

## Summary
Built the complete Photothèque module with backend APIs and frontend view — photo gallery management per chantier with category filtering, gallery/list view modes, CRUD operations, placeholder image support, and comprehensive metadata display.

## Files Created

### 1. API: `/src/app/api/photos/route.ts`
- **GET** — List photos with query params:
  - `?chantierId=` — Filter by chantier (required for meaningful results)
  - `?phaseId=` — Filter by phase
  - `?tacheId=` — Filter by task
  - `?categorie=` — Filter by category (avancement, incident, reception, materiau, document)
  - `?auteurId=` — Filter by author
  - `?dateDebut=&dateFin=` — Date range filter on datePrise
  - `?search=` — Search in legende (contains)
  - `?cursor=&limit=` — Cursor-based pagination (limit 50 default)
  - Includes prisePar name, phase name, tache name
  - Returns stats by category (total, avancement, incident, reception, materiau, document)
- **POST** — Create a photo entry. Body: { chantierId, phaseId, tacheId, rapportId, priseParId, datePrise, legende, categorie, urlOriginale, urlThumbnail }
  - Validates required fields: chantierId, priseParId, datePrise, urlOriginale
  - Supports placeholder URLs for demo mode

### 2. API: `/src/app/api/photos/[id]/route.ts`
- **GET** — Get photo detail with all metadata (chantier, phase, tache, rapport, prisePar)
- **PUT** — Update photo (legende, categorie, phaseId, tacheId)
  - Validates phaseId and tacheId belong to the same chantier
- **DELETE** — Delete photo (hard delete)

### 3. Component: `/src/components/photos/photos-view.tsx` (~960 lines)
- **Header**: "Photothèque" title with Camera icon + "Ajouter une photo" button (amber-themed)
- **Chantier selector** card (required to see photos)
- **KPI stats row** (6 cards, responsive 2→3→6 cols):
  - Total photos, Avancement, Incidents, Réceptions, Matériaux, Documents
  - Each with colored icon and count
- **Filter bar**:
  - Search input: searches by légende
  - Category filter chips: Tous, Avancement, Incident, Réception, Matériau, Document (colored badges)
  - Phase filter dropdown (populated from selected chantier's phases)
  - Date range filter (start → end)
  - "Réinitialiser" clear filters button
- **View mode toggle**: Gallery (grid) and List (table) with amber-highlighted active state
- **Gallery view** (default):
  - Responsive grid: 2 cols mobile, 3 tablet, 4 desktop
  - Each photo card:
    - Thumbnail image (or placeholder with category-colored background + icon)
    - Category badge overlay (top-left)
    - Hover overlay with action buttons (View, Edit, Delete)
    - Légende, date (formatted in French), author name
    - Phase/tâche path (truncated)
    - Image error fallback to placeholder
  - Framer Motion stagger animations on card entry
- **List view**:
  - Responsive table: Aperçu (thumbnail), Légende, Catégorie, Date, Phase/Tâche, Auteur, Actions
  - Hide columns on smaller screens
  - Action buttons: View, Edit, Delete
  - Framer Motion fade-in animations
- **Detail dialog**:
  - Full-size image (or large placeholder)
  - Read-only metadata: Date de prise, Prise par, Phase, Tâche
  - Category badge + légende display
  - Edit mode: toggle to edit catégorie (select) and légende (textarea)
  - Delete button at bottom
  - Created date footer
- **Add photo dialog**:
  - Chantier selector (auto-filled from current selection)
  - Phase select (optional, dynamic from selected chantier)
  - Tâche select (optional, filtered by selected phase)
  - Date de prise (required, defaults to today)
  - Catégorie select (with colored dot indicators)
  - URL input (optional, placeholder used if empty)
  - Légende textarea
- **Placeholder system**:
  - Category-colored backgrounds: avancement (amber), incident (red), reception (emerald), materiau (blue), document (purple)
  - Category icon + "Photo non disponible" text
  - Graceful fallback on image load error
- **Empty state**: Camera icon with contextual messaging
- **Loading state**: Skeleton card grid (8 cards)
- **Toast notifications** via sonner for all CRUD operations

## Files Modified

### 4. `/src/app/page.tsx`
- Added import for `PhotosView`
- Added `case 'photos'` in view router

## Category Color Scheme
- avancement: amber (bg-amber-100, text-amber-800)
- incident: red (bg-red-100, text-red-800)
- reception: emerald (bg-emerald-100, text-emerald-800)
- materiau: blue (bg-blue-100, text-blue-800)
- document: purple (bg-purple-100, text-purple-800)

## Design Choices
- Amber/orange construction theme consistent with project
- Gallery view as default for visual browsing
- Placeholder system for demo mode (no actual file upload)
- Cursor-based pagination for scalability
- Category chips as toggle filters (click to select, click again to deselect)
- Inline image error fallback to placeholder
- Framer Motion animations on gallery cards and list rows
- French locale via date-fns for all date formatting
- Mobile-first responsive: 2-col grid on mobile, 4-col on desktop

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully (HTTP 200 on /)
- ✅ Page.tsx updated with 'photos' route case

---

# Task 8 — Rapports Journaliers (Daily Reports) Module

## Date: 2026-04-13

## Summary
Built the complete Rapports Journaliers module with backend APIs and frontend view — daily construction site reports with weather tracking, workforce count, work descriptions, incidents, observations, photo association, month-based navigation, full CRUD operations, and print-friendly detail view.

## Files Created

### 1. API: `/src/app/api/rapports/route.ts`
- **GET** — List rapports with query params:
  - `?chantierId=` — Filter by chantier
  - `?dateDebut=&dateFin=` — Date range filter on dateRapport
  - `?search=` — Text search across travauxRealises, incidents, observations
  - Includes auteur info (id, name, email) and chantier info (id, nom)
  - Includes photo count per rapport
  - Returns KPI summary: total, rapportsToday
- **POST** — Create a rapport. Body: { chantierId, auteurId, dateRapport, meteo, effectifPresent, travauxRealises, incidents, observations }
  - Validates: chantierId, auteurId, dateRapport, travauxRealises required
  - Returns created rapport with auteur and chantier info

### 2. API: `/src/app/api/rapports/[id]/route.ts`
- **GET** — Get rapport detail with full photo list (id, legende, categorie, urlOriginale, urlThumbnail, datePrise)
  - Includes auteur info, chantier info (with adresse), and photos
  - Returns 404 if not found
- **PUT** — Update rapport fields (dateRapport, meteo, effectifPresent, travauxRealises, incidents, observations)
  - Validates travauxRealises is non-empty when provided
  - Returns 404 if not found
- **DELETE** — Delete rapport
  - Detaches linked photos (sets rapportId to null) before deletion
  - Returns success with count of detached photos
  - Returns 404 if not found

### 3. Component: `/src/components/rapports/rapports-view.tsx` (~620 lines)
- **Header**: "Rapports Journaliers" title with FileText icon + "Nouveau rapport" button (amber-themed)
- **KPI cards row** (3 cards, responsive 1→3 cols):
  - Total rapports (amber icon)
  - Rapports today (emerald icon)
  - Photos associées (blue icon, sum of all photo counts)
- **Filter card** (4-col responsive grid):
  - Chantier selector: "Tous les chantiers" + dynamically fetched chantier list
  - Month navigation: prev/next buttons with formatted month label (French locale), calendar popover for date selection
  - Search input with debounced search (400ms) across travauxRealises, incidents, observations
  - "Mois actuel" quick button to jump back to current month
- **Rapport cards list** (vertical card layout):
  - Date block: prominent day number + abbreviated month/year in amber-styled box
  - Weather badge: ☀️ Ensoleillé (amber), ⛅ Nuageux (slate), 🌧️ Pluie (blue), 🚫 Arrêt intempérie (red)
  - Effectif présent badge (blue, with Users icon)
  - Photo count badge (purple, with Camera icon)
  - Chantier name with 📍 icon
  - Travaux réalisés (truncated at 180 chars)
  - Incident indicator (red warning text)
  - Author name in footer
  - Action buttons: View (Eye), Edit (Pencil), Delete (Trash2)
- **Create dialog**: Full form with:
  - Chantier selector (pre-filled from filter if set)
  - Date picker (Calendar popover, default today)
  - Météo radio group: 4 visual options with icons (Sun, Cloud, CloudRain, Ban) in 2×2 grid, color-coded selection
  - Effectif présent (number input)
  - Travaux réalisés (textarea, required)
  - Incidents (textarea)
  - Observations (textarea)
- **Edit dialog**: Same form without chantier selector
- **View detail dialog** (max-w-2xl):
  - Header with chantier name, date, author
  - Print button (triggers window.print)
  - Key info cards row: Weather (emoji + label), Effectif, Photo count
  - Travaux réalisés (full text in muted bg)
  - Incidents (red-styled card, only shown if present)
  - Observations (muted bg card, only shown if present)
  - Photo gallery grid (2×3 cols, placeholder with ImageOff icon, legende + catégorie badge)
  - Print-optimized layout (hidden dialog controls, print-only title)
- **Delete confirmation dialog** (AlertDialog): Warns about irreversible deletion, notes photos are preserved
- **Empty state**: Contextual CloudSun illustration, message adapts to filters/search, CTA button when no filters active
- **Loading state**: Skeleton cards
- **Framer Motion animations**: Fade-in + stagger on KPI cards and rapport cards
- **Toast notifications** via sonner for all CRUD operations

## Files Modified

### 4. `/src/app/page.tsx`
- Added import for `RapportsView`
- Added `case 'rapports'` in view router

## Weather Mapping
- `ensoleille` → ☀️ "Ensoleillé" (amber-100/800 bg/text)
- `nuageux` → ⛅ "Nuageux" (slate-100/700 bg/text)
- `pluie` → 🌧️ "Pluie" (blue-100/700 bg/text)
- `arret_intemperie` → 🚫 "Arrêt intempérie" (red-100/700 bg/text)
- Also supports legacy accented value `ensoleillé` → maps to same entry

## Design Choices
- Amber/orange construction theme consistent with project
- Card-based list layout with prominent date blocks (visual calendar feel)
- Month-based navigation instead of date range for simpler UX
- RadioGroup for weather selection (visual, tactile, color-coded options)
- Photo gallery section in detail dialog uses placeholder thumbnails (ImageOff icon) since photo upload is not yet implemented
- Print-friendly dialog: uses `print:hidden` / `hidden print:block` classes
- Debounced search (400ms) to avoid excessive API calls
- French locale via date-fns for all date formatting
- Mobile-first responsive: stacked filters on small screens, inline date blocks on cards

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully (✓ Compiled in ~340ms)
- ✅ Page.tsx updated with 'rapports' route case

---

# Task 10 — Sous-traitants (Subcontractors) Module

## Date: 2026-04-13

## Summary
Built the complete Sous-traitants module with backend APIs and frontend view — CRUD operations for subcontractors (sous-traitants), contrat management per subcontractor, statut workflow (EN_COURS/RECEPTIONNE/SOLDE/ANNULE), search, KPI stats, and responsive card grid.

## Files Created

### 1. API: `/src/app/api/sous-traitants/route.ts`
- **GET** — List all sous-traitants with optional query params:
  - `?search=` — Filter by raisonSociale or specialite (contains search)
  - `?specialite=` — Filter by specialite exact match
  - Returns sous-traitants with `_count` of contrats
  - Returns KPI summary (totalSousTraitants, contratsEnCours, montantTotalEngage)
- **POST** — Create a new sous-traitant. Required: raisonSociale. Optional: rccm, contact, specialite, rib.

### 2. API: `/src/app/api/sous-traitants/[id]/route.ts`
- **GET** — Get sous-traitant detail with all contrats (includes chantier info: id, nom, statut)
- **PUT** — Update sous-traitant fields (raisonSociale, rccm, contact, specialite, rib)
- **DELETE** — Delete sous-traitant and cascade delete all associated contrats

### 3. API: `/src/app/api/sous-traitants/[id]/contrats/route.ts`
- **GET** — List contrats for a sous-traitant. Query params:
  - `?chantierId=` — Filter by chantier
  - `?statut=` — Filter by statut (EN_COURS, RECEPTIONNE, SOLDE, ANNULE)
  - Includes chantier info (id, nom, statut)
- **POST** — Create a contrat. Body: { chantierId, objetTravaux, montantHT, dateDebut?, dateFin?, conditions? }
  - Validates: chantierId required, objetTravaux required, montantHT >= 0

### 4. API: `/src/app/api/sous-traitants/[id]/contrats/[contratId]/route.ts`
- **PUT** — Update contrat fields (statut, montantHT, objetTravaux, dateDebut, dateFin, conditions)
  - Validates statut: EN_COURS, RECEPTIONNE, SOLDE, ANNULE
- **DELETE** — Delete a contrat (returns 404 if not found)

### 5. Component: `/src/components/sous-traitants/sous-traitants-view.tsx` (~680 lines)
- **Header**: "Sous-traitants" title + "Nouveau sous-traitant" button (amber-themed)
- **KPI cards row** (3 cards): Total sous-traitants, Contrats en cours, Montant total engagé (FCFA)
- **Search bar**: Searches by raison sociale or spécialité
- **Sous-traitant cards grid** (1→2→3 cols responsive):
  - Raison sociale (bold) with Building2 icon, RCCM, Contact, Spécialité badge (violet), Contrats count, RIB (masked), Actions
- **Create/Edit dialog**: raisonSociale, rccm, contact, specialite, rib
- **View detail dialog**: Sous-traitant info + contrats list with inline statut editing
- **Create contrat dialog**: chantierId, objetTravaux, montantHT, dates, conditions
- **Inline statut editor**: Click badge → select → confirm
- **Statut colors**: EN_COURS (amber), RECEPTIONNE (emerald), SOLDE (blue), ANNULE (red)
- **Toast notifications** for all CRUD operations

## Files Modified

### 6. `/src/app/page.tsx`
- Added `case 'sous-traitants'` in view router (import already existed)

## Verification
- ✅ `bun run lint` passes (0 errors, 0 warnings)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'sous-traitants' route case
