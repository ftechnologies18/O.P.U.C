# Task 4 — Chantier Detail View

## Agent: Main Agent
## Date: 2026-04-13

## Summary
Created the comprehensive ChantierDetailView component (`src/components/chantiers/chantier-detail-view.tsx`) — the full detail view for a single construction site (chantier).

## Files Created
- `/home/z/my-project/src/components/chantiers/chantier-detail-view.tsx` (~830 lines)

## Files Modified
- `/home/z/my-project/src/app/page.tsx` — Added import for `ChantierDetailView` and `case 'chantier-detail'` in the view router switch

## Features Implemented

### Header Section
- Back button (ArrowLeft icon) → returns to 'chantiers' view via `setCurrentView('chantiers')`
- Chantier name as h2
- Status badge with color-coded styling
- Edit button → opens edit dialog
- Delete button → opens alert dialog for confirmation

### KPI Cards Row (4 cards)
1. Avancement global — with progress bar underneath
2. Budget prévisionnel — formatted in FCFA with Intl.NumberFormat
3. Journaliers affectés — count from journaliers array
4. Pointages totaux — count from _count.pointages

### Tabs (3 tabs)

**Tab 1: Vue d'ensemble**
- Description card (or "no description" placeholder)
- Info grid: Address, Maître d'ouvrage, Date début, Date fin prévue, Entreprise, Budget réel
- Phases timeline with visual progress indicators (vertical line, colored circles, progress bars)

**Tab 2: Phases & Tâches**
- Collapsible phase cards with:
  - Phase order badge (P1, P2...)
  - Phase avancement progress bar
  - Date range display
  - Task count
  - Delete phase button (with confirmation dialog)
  - Expanded view shows all tasks inside
- Each task row shows:
  - Status badge (color-coded: PLANIFIEE=slate, EN_COURS=amber, TERMINEE=emerald, EN_RETARD=red)
  - Task name, responsable, date
  - Inline avancement edit (click to open number input, Enter to save, Escape to cancel)
  - Delete task button (visible on hover)
- "Add task" button inside each phase
- "Add phase" button at bottom
- Create phase dialog: nom, description, dateDebut, dateFin
- Create task dialog: nom, description, dateDebut, dateFin, tachePrecedenteId
- Empty state when no phases exist

**Tab 3: Équipe**
- List of assigned journaliers (active affectations) with:
  - Avatar (initials in colored circle)
  - Name (prenom + nom)
  - Specialty with Wrench icon
  - Phone with Phone icon
  - "Actif" badge
- Empty state when no journaliers assigned

### Dialogs
- Edit Chantier Dialog: nom, description, adresse, maitreOuvrage, dateDebut, dateFinPrevue, budgetPrevisionnel, statut (select)
- Delete Chantier Alert Dialog
- Create Phase Dialog
- Delete Phase Alert Dialog
- Create Task Dialog (with predecessor task dropdown)
- Delete Task Alert Dialog

### API Integration
- GET /api/chantiers/[id] — fetches full detail on mount
- PUT /api/chantiers/[id] — update chantier
- DELETE /api/chantiers/[id] — delete chantier
- POST /api/chantiers/[id]/phases — create phase
- DELETE /api/chantiers/[id]/phases/[phaseId] — delete phase
- POST /api/chantiers/[id]/phases/[phaseId]/taches — create task
- PUT /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId] — update task avancement
- DELETE /api/chantiers/[id]/phases/[phaseId]/taches/[tacheId] — delete task

### UX Details
- Loading skeleton while fetching
- Toast notifications via sonner for all actions
- Loading spinners on save buttons
- Auto-expands all phases on data load
- Responsive: mobile-first layout, stacks cards on mobile
- Amber/orange construction theme colors
- French locale dates via date-fns

## Verification
- ✅ `bun run lint` passes (0 errors)
- ✅ Dev server compiles successfully
- ✅ Page.tsx updated with 'chantier-detail' route case
