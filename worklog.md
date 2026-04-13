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
