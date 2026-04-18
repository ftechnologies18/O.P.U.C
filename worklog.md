# Work Record — O.P.U.C Auth UI Components

**Date**: 2025-06-18
**Task**: Create 6 React auth UI components using shadcn/ui and Tailwind CSS

## Files Created

| File | Description |
|------|-------------|
| `src/components/auth/forgot-password-form.tsx` | Password reset request form — email input, loading state, success confirmation, back link |
| `src/components/auth/reset-password-form.tsx` | New password form — hidden token, password strength bar, show/hide toggles, match validation |
| `src/components/auth/two-factor-verify.tsx` | 2FA code entry — 6-digit OTP with auto-focus/advance/paste, auto-submit, backup code toggle, shake error |
| `src/components/auth/setup-two-factor.tsx` | 2FA setup wizard — 3-step dialog (QR/secret → verify → backup codes), progress indicator, clipboard copy |
| `src/components/auth/invitation-form.tsx` | Invitation acceptance — pre-filled name from token, password with strength, invitation summary card |
| `src/components/auth/force-password-change.tsx` | Forced password change — non-dismissible dialog, current + new password, strength validation, same-as-old check |

## Component Details

### forgot-password-form.tsx
- **Props**: `{ onBack: () => void }`
- **Flow**: Email input → POST `/api/auth/forgot-password` → success message
- **UI**: Card with Mail icon, emerald check on success, ArrowLeft back link
- **States**: idle → loading (spinner) → success (CheckCircle2) | error (toast)

### reset-password-form.tsx
- **Props**: `{ token: string }`
- **Flow**: Hidden token field → new password + confirm → POST `/api/auth/reset-password` → redirect to login
- **Strength bar**: 4 levels (Faible/Moyen/Bon/Excellent) with color transitions (red→amber→yellow→emerald)
- **Validation**: 5 rules checklist, password match indicator with colored borders
- **Icons**: Eye/EyeOff toggles, CheckCircle2 success, ShieldAlert mismatch

### two-factor-verify.tsx
- **Props**: `{ userId: string; onVerified: () => void; onCancel: () => void }`
- **OTP input**: 6 individual inputs with auto-focus advance, backspace navigation, paste support (all 6 digits at once)
- **Auto-submit**: Fires 400ms after all 6 digits filled
- **Backup mode**: Toggle to 8-character uppercase mono-spaced input
- **Error handling**: CSS shake animation via `@keyframes`, red border on inputs, toast notification, auto-clear
- **Icons**: ShieldCheck header, KeyRound backup toggle, Loader2 loading

### setup-two-factor.tsx
- **Props**: `{ open: boolean; onOpenChange: (open: boolean) => void; onComplete: () => void }`
- **Step 1 (Scanner)**: Fetches secret/URI from POST `/api/auth/2fa/setup`, shows placeholder QR div, secret key with copy button, auth URI with copy button
- **Step 2 (Vérifier)**: 6-digit verification (same UX as two-factor-verify), POST `/api/auth/2fa/verify-setup`
- **Step 3 (Codes)**: Displays backup codes in 2-column grid with "Copier tout" button, amber warning alert, "Terminer" button
- **Progress indicator**: 3-step numbered circles with connecting lines, emerald (done) / amber (current) / slate (pending)
- **State management**: Full reset when dialog opens/closes

### invitation-form.tsx
- **Props**: `{ token: string }`
- **On mount**: Fetches invitation details from GET `/api/auth/invite?token=...`
- **Pre-filled**: Prénom and Nom from invitation data
- **Summary card**: Shows email, entreprise, role badge in emerald-tinted card
- **Submit**: POST `/api/auth/invite/accept` with token, prenom, nom, password
- **Error states**: Invitation not found/expired, generic errors (toast)
- **Success**: PartyPopper icon, welcome message, link to login

### force-password-change.tsx
- **Props**: `{ userId: string; open: boolean; onComplete: () => void }`
- **Non-dismissible**: `handleOpenChange` always returns without closing when `isOpen=false`
- **Validation**: Current password required, new password must differ from current, strength must pass, passwords must match
- **Warning banner**: Amber alert with AlertTriangle explaining the dialog cannot be dismissed
- **Submit**: PUT `/api/users/{userId}` with currentPassword and newPassword

## Shared Patterns

### Password Strength Indicator (3 components)
- Reusable inline `getPasswordStrength()` and `getPasswordErrors()` functions
- Visual: colored bar (2px height, rounded) with width transition
- Text labels: Faible (20%, red), Moyen (40%, amber), Bon (70%, yellow), Excellent (100%, emerald)
- Checklist: 5 rules with amber dot bullets

### Color Scheme
- Primary buttons: `bg-gradient-to-r from-amber-500 to-orange-600` with shadow
- Success: emerald-100 backgrounds, emerald-600 icons
- Errors: red-500 borders, red-600 text, red-50 backgrounds
- Warning: amber-50 backgrounds, amber-200 borders, amber-800 text
- Cards: `shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm`

### Consistent UX
- All inputs: `h-11` height
- All loading states: Loader2 spinner with "..." suffix text
- All error messages: toast from sonner
- French labels throughout
- Mobile-first responsive design
- `'use client'` directive on all components

## Validation
- ESLint: ✅ clean (0 errors, 0 warnings)
- Dev server: ✅ compiling successfully

---

# Work Record — O.P.U.C Foundational Auth Libraries

**Date**: 2025-06-18
**Task**: Create foundational auth libraries for O.P.U.C multi-tenant SaaS (inspired by CATS repository pattern)

## Files Created

| File | Description |
|------|-------------|
| `src/types/next-auth.d.ts` | NextAuth type augmentation — extends Session, User, JWT with multi-tenant fields |
| `src/lib/rbac.ts` | Complete RBAC permission system — roles, 3 permission matrices, 10+ helper functions |
| `src/lib/tenant.ts` | Tenant context utilities — AuthError/ForbiddenError, 5 auth middleware functions |
| `src/lib/two-factor.ts` | TOTP 2FA — pure TypeScript TOTP with base32, XOR encryption, backup codes |
| `src/lib/password.ts` | Password utilities — bcrypt hashing, strength validation, secure generation, lockout |

## Architecture

### File 1: `src/types/next-auth.d.ts`
- Extends `next-auth` module: Session.user with `id, email, name, role, entrepriseId, isSuperAdmin, twoFactorEnabled, premiereConnexion`
- Extends `next-auth/jwt` module: JWT with same fields for token-based auth
- Uses `UserRole` type from rbac.ts for type-safe roles

### File 2: `src/lib/rbac.ts`
**Types defined:**
- `UserRole` — 6 roles: SUPER_ADMIN, GERANT, ADMIN_ENTREPRISE, CONDUCTEUR, CHEF_CHANTIER, SOUS_TRAITANT
- `PermissionLevel` — 4 levels: AUCUN, LECTURE, ECRITURE, GESTION
- `AppPage` — 17 application pages
- `SettingsCategory` — 4 settings categories
- `AppFeature` — 11 application features

**3 Permission Matrices:**
1. `PAGE_ACCESS` — Maps 17 pages to minimum role level (1-6)
2. `SETTINGS_ACCESS` — Maps 4 settings categories to minimum role level
3. `FEATURE_ACCESS` — Maps 11 features to minimum role level

**Module Permission Defaults:**
- 16-module matrix per role (CHANTIERS through ADMIN_PLATEFORME)
- Each role has tailored defaults (e.g. SOUS_TRAITANT: LECTURE on 3 modules, AUCUN elsewhere)

**Helper Functions (10):**
- `canAccessPage()`, `canAccessSettings()`, `canAccessFeature()`
- `hasMinimumRole()`, `getDefaultPage()`, `getRoleLabel()`
- `getRoleBadgeClass()`, `getModulePermissionLevel()`
- `getAccessiblePages()`, `getAccessibleFeatures()`
- `getRoleLevel()`, `isAdminRole()`, `isSuperAdminRole()`

### File 3: `src/lib/tenant.ts`
**Custom Errors:**
- `AuthError` — 401/403/423 status codes with French messages
- `ForbiddenError` — 403 status codes

**Core Functions (5):**
- `requireAuth()` — Validates session, checks DB for active/locked status, maps legacy roles
- `requireTenantContext()` — Same + ensures entrepriseId is set
- `requireMinimumRole()` — Auth + role level comparison
- `requireAdmin()` — GERANT or SUPER_ADMIN only
- `requireSuperAdmin()` — SUPER_ADMIN only

**Legacy role mapping:** ADMIN → ADMIN_ENTREPRISE, CHEF_ENTREPRISE → GERANT

### File 4: `src/lib/two-factor.ts`
**Implementation:**
- Pure TypeScript TOTP using Node.js `crypto` module (no external deps)
- RFC 4648 Base32 encoding/decoding
- RFC 4226 HMAC-based OTP with dynamic truncation
- 30-second time step, 6-digit codes
- Clock drift tolerance: accepts current + previous period (±30s)

**Public API:**
- `generateTOTPSecret()` — 26-char base32 secret (16 bytes)
- `generateTOTPBackupCodes(count?)` — 10 random 8-char codes (no ambiguous chars)
- `getTOTPAuthURI(secret, email, issuer?)` — otpauth://totp/ URI for QR
- `verifyTOTPCode(secret, code)` — Validates 6-digit code with drift tolerance
- `encryptSecret(secret)` — XOR-based reversible encryption for DB storage
- `decryptSecret(encrypted)` — Decrypts stored secret

### File 5: `src/lib/password.ts`
**Public API:**
- `hashPassword(password)` — bcrypt with 12 rounds
- `verifyPassword(password, hash)` — bcrypt.compare
- `validatePasswordStrength(password)` — 5 rules (8+ chars, upper, lower, digit, special)
- `generateSecurePassword(length?)` — 12 chars by default, shuffled, guaranteed 1 of each class
- `generateResetToken()` — 32-byte hex string
- `isResetTokenExpired(createdAt, hours?)` — default 1 hour
- `isAccountLocked(lockedUntil)` — checks if lock is still active
- `getLockoutExpiryDate(attempts, minutes?)` — progressive: 5→15→30 min

## Validation
- ESLint: ✅ clean (0 errors, 0 warnings)
- Dev server: ✅ compiling (all 5 new files parse correctly)
- TypeScript: ✅ strict mode compatible
- No schema changes required — references existing DB fields

---

# Work Record — AuditTab Phase 3 Rewrite

**Date**: 2025-06-17
**File**: `src/components/gestion-acces/gestion-acces-view.tsx`
**Task**: Complete rewrite of the AuditTab component (Tab 3 of Gestion des Accès)

## Changes Made

### 1. Import Additions (lines 3, 7-43)
- Added `Fragment` to React imports (needed for table expandable rows with keys)
- Added 8 new Lucide icons:
  - `ChevronDown`, `ChevronUp` — expandable row toggles
  - `Download` — CSV export button
  - `Calendar` — date filter inputs
  - `BarChart3` — statistics section header
  - `Timer` — auto-refresh toggle
  - `LayoutList` — timeline view button
  - `LayoutPanelLeft` — table view button

### 2. New Helpers & Types (lines 1900-1929)
- `AuditStats` interface — typed response from `/api/audit-logs/stats`
- `getActionDotColor(action)` — maps action types to Tailwind dot colors for timeline
- `formatAuditDetails(details)` — parses JSON details into formatted string

### 3. Complete AuditTab Rewrite (lines 1898-3035)

**Features Implemented:**

#### Enhanced Filters
- Module dropdown (uses existing `AUDIT_MODULE_FILTERS`)
- Action dropdown (uses existing `AUDIT_ACTION_FILTERS`)
- User dropdown (fetched from `/api/users`)
- Date range (two date inputs: `dateFrom`, `dateTo`)
- Text search with 300ms debounce
- Reset button to clear all filters

#### Summary Stats Cards (4 cards)
- "Total (période)" — from stats endpoint
- "Aujourd'hui" — from stats endpoint
- "Utilisateurs actifs 24h" — from stats endpoint
- "Dernière action" — relative time from stats endpoint

#### View Toggle
- "Tableau" / "Timeline" toggle buttons

#### Enhanced Table View
- All original columns + expandable chevron column
- Click to expand/collapse detail panel showing: IP, entity type, entity ID, exact date, full details
- Row count info: "Affichage de X à Y sur Z résultats"
- Proper pagination

#### Timeline View
- Logs grouped by date with section headers
- Each entry: time (HH:mm), colored dot, avatar, user name, action badge, module badge, details preview
- Click to expand full details
- Vertical connecting line between dots

#### Statistics Section (collapsible)
- Actions par module — horizontal bar chart (CSS/Tailwind)
- Actions par jour — vertical bar chart for last 14 days
- Top utilisateurs — ranked list with proportional bars
- Distribution par type d'action — colored badges with counts

#### Export CSV
- Button in header area
- Fetches up to 500 logs with current filters
- Generates CSV with proper headers (French semicolon delimiter)
- BOM prefix for Excel compatibility
- Blob download with filename including date

#### Auto-Refresh
- Dropdown toggle: Disabled / 30s / 60s / 2min
- Pulsing dot indicator when active
- Uses stable refs to avoid stale closure issues
- Proper cleanup on unmount

### Bug Fixes
- Fixed the `oduleFilter` typo (was missing the 'm' prefix) — now correctly uses `moduleFilter`
- Proper `useCallback` dependency arrays with `buildFilterParams` helper
- Debounced search input prevents excessive API calls

## Technical Notes
- File grew from 2221 to 3084 lines (+863 lines net, replacement was ~283 old → ~1138 new)
- All existing constants, types, and helpers above the AuditTab section were preserved unchanged
- The `RolesTab` component (lines ~460-1896) and `GestionAccesView` main component (lines 3038+) are untouched
- ESLint passes with no errors
- Dev server compiles successfully

### Post-Implementation Fixes (by main agent)
- Fixed `AuditStats` interface: changed `actionsPerModule`, `actionsPerDay`, `actionsByType` from `Record<string, number>` to proper array types matching API response
- Fixed stats rendering: changed `Object.entries(stats.actionsPerModule || {})` to `(stats.actionsPerModule || []).sort()` pattern (arrays, not objects)
- Fixed `actionsPerDay` rendering: same array iteration fix
- Fixed `actionsByType` rendering: same array iteration fix
- Fixed `topUsers` rendering: replaced `user.email` (not in API) with `user.role` Badge display
- Final file: 3087 lines, lint clean, server compiling

---

# Work Record — PWA Icon Generation

**Date**: 2025-06-17
**Files**: `public/pwa-icon-1024.png`, `public/pwa-icon-512.png`
**Task**: Generate PWA app icons for O.P.U.C (Outil de Pilotage Unifié de Chantier)

## Changes Made

### 1. Main Icon (1024x1024)
- **Path**: `public/pwa-icon-1024.png`
- **Size**: 51,192 bytes
- **Prompt**: "Professional app icon for a construction management app called O.P.U.C, bold letters OPUC in white on emerald green background, construction crane silhouette, modern flat design, no text besides OPUC, minimalist"
- **Generated at**: 1024x1024 resolution
- **Usage**: Primary PWA icon for manifest, app stores, high-res displays

### 2. Secondary Icon (512 concept, generated at 1024x1024)
- **Path**: `public/pwa-icon-512.png`
- **Size**: 38,685 bytes
- **Prompt**: "Simple flat icon for construction app, letter O stylized as building with hard hat, emerald green and white, minimal modern design, no text"
- **Generated at**: 1024x1024 resolution (note: image generation API does not support 512x512; generated at 1024x1024, can be downscaled to 512x512 at build/runtime)
- **Usage**: Smaller PWA icon variant for manifest (android-chrome-512x512, etc.)

## Technical Notes
- Both images generated using `z-ai image` CLI tool
- Emerald green + white color scheme consistent with O.P.U.C branding
- Both files are PNG format, suitable for PWA manifest
- Files verified with `ls -la` — both present and non-empty

---

# Work Record — PWA Implementation (Progressive Web App + Offline Sync)

**Date**: 2025-06-17
**Task**: Set up PWA with manifest.json, Service Worker, IndexedDB offline storage, and /api/sync endpoint

## Files Created

| File | Description |
|------|-------------|
| `public/manifest.json` | PWA manifest: app name, icons, theme color, shortcuts |
| `public/sw.js` | Service Worker: cache strategies, offline page, background sync |
| `src/app/api/sync/route.ts` | API endpoint: POST batch sync, GET health check |
| `src/lib/offline-db.ts` | IndexedDB utility: queue management, sync engine, CRUD |
| `src/hooks/useOfflineSync.ts` | React hook: auto-sync, queue operations, status tracking |
| `src/components/pwa/service-worker-registration.tsx` | SW registration component |
| `src/components/pwa/offline-status-indicator.tsx` | UI: offline banner, sync toast, status dot |
| `public/pwa-icon-1024.png` | Generated PWA icon (1024x1024) |
| `public/pwa-icon-512.png` | Generated PWA icon (1024x1024, for 512 slot) |

## Files Modified

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Added PWA meta tags, manifest link, apple-web-app, SW registration, offline indicator |

## Architecture

### Service Worker (`sw.js`)
- **Strategy**: Network-first with cache fallback for pages/API, Cache-first for static assets
- **Pre-cache**: Static assets on install (manifest, icons)
- **Offline page**: Custom HTML page when navigation fails offline
- **Background Sync**: Handles `sync-offline-data` tag
- **Push Notifications**: Ready for future use
- **Auto-cleanup**: Removes old cache versions on activate

### Sync API (`/api/sync`)
- **POST**: Receives batch of offline items (max 500), validates per type, processes into DB
- Supported types: `pointage`, `rapport`, `sortie_stock`, `sortie_carburant`, `entree_carburant`, `releve_compteur`, `general`
- **GET**: Health check, returns supported types and max batch size
- Deduplication: Pointages check for existing same-day entries before creating duplicates
- Returns: `{ synced, errors, results, errorDetails }`

### IndexedDB (`offline-db.ts`)
- Database: `opuc-offline`, store: `pending-sync`
- Operations: add, get, count, remove, clear, update-error
- Sync engine: sends batch to `/api/sync`, removes synced items, tracks retry count (max 5)
- UUID generation for offline items

### React Hook (`useOfflineSync`)
- Auto-detects online/offline via window events
- Refreshes pending count every 5s
- Auto-syncs when connection restored
- Listens for Service Worker sync messages
- Exposes: `syncNow`, `addToQueue`, `getPending`, `removePending`, `clearAll`

### UI Indicator
- Floating bottom-right status dot (green=online, amber=offline)
- Offline banner at top (auto-dismiss after 5s)
- Sync button with pending count (appears when items in queue)
- Sync result toast (shows synced count)
- Tooltips for status information

## Validation
- ESLint: ✅ clean (no errors, no warnings)
- Dev server: ✅ compiling
- React 19 strict mode rules respected (no setState in effects, no refs in render)

---

# Work Record — Multi-Tenant SaaS Security Schema Update

**Date**: 2025-06-17
**File**: `prisma/schema.prisma`
**Task**: Add multi-tenant SaaS security models (2FA, lockout, invitations, system settings)

## Summary

Extended the existing O.P.U.C Prisma schema with security infrastructure for SaaS multi-tenant operations. All existing models (User, Entreprise, Chantier, Journalier, etc.) remain untouched — only new fields and new models were added.

## Changes Made

### 1. User Model — New Fields (after `entrepriseId`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `twoFactorEnabled` | Boolean | `false` | Whether 2FA is active |
| `twoFactorSecret` | String? | — | Encrypted TOTP secret |
| `twoFactorBackupCodes` | String? | — | Encrypted JSON array of backup codes |
| `loginAttempts` | Int | `0` | Failed login attempt counter |
| `lockedUntil` | DateTime? | — | Auto-unlock timestamp |
| `lastLoginAt` | DateTime? | — | Last successful login |
| `lastLoginIp` | String? | — | Last login IP address |
| `passwordChangedAt` | DateTime | `now()` | Last password change |
| `premiereConnexion` | Boolean | `true` | Force password change on first login |
| `invitedById` | String? | — | ID of user who sent invitation |
| `invitationAcceptedAt` | DateTime? | — | When invitation was accepted |

### 2. User Model — New Relations

| Relation | Target Model | Description |
|----------|-------------|-------------|
| `passwordResetTokens` | PasswordResetToken[] | Password reset flow |
| `invitationTokens` | InvitationToken[] | Sent invitations |
| `loginAttemptLogs` | LoginAttemptLog[] | Security audit trail |

### 3. Entreprise Model — New Relations

| Relation | Target Model | Description |
|----------|-------------|-------------|
| `systemSettings` | SystemSetting[] | Per-tenant key-value config |
| `invitationTokens` | InvitationToken[] | Invitations sent by this tenant |

### 4. New Models Added

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `PasswordResetToken` | Email-based password reset flow | `token` (unique), `email`, `expiresAt`, `usedAt`, `userId` |
| `InvitationToken` | Email invitation for user onboarding | `token` (unique), `email`, `role`, `entrepriseId`, `userId` (nullable until accepted) |
| `LoginAttemptLog` | Login attempt tracking for lockout | `userId`, `email`, `ipAddress`, `success`, `reason` |
| `SystemSetting` | Per-tenant configuration (key-value) | `entrepriseId`, `cle`, `valeur`, `@@unique([entrepriseId, cle])` |

## Validation

- **`bun run db:push`**: ✅ Success — database in sync in 29ms
- **Prisma Client generated**: ✅ v6.19.2
- **Tables verified** (37 total including 4 new): ✅
  - `PasswordResetToken` — columns: id, email, token, expiresAt, usedAt, createdAt, userId
  - `InvitationToken` — columns: id, token, email, role, nom, prenom, entrepriseId, invitedBy, expiresAt, acceptedAt, createdAt, userId
  - `LoginAttemptLog` — columns: id, userId, email, ipAddress, success, reason, createdAt
  - `SystemSetting` — columns: id, entrepriseId, cle, valeur, createdAt, updatedAt
- **User table**: ✅ All 11 new columns present with correct types and defaults
- **Existing models**: ✅ All preserved, no modifications
- **Datasource**: ✅ SQLite unchanged
- **Generator**: ✅ prisma-client-js unchanged

---

## Worklog — O.P.U.C Auth System API Routes (Task Batch)

**Date**: $(date -u +"%Y-%m-%d %H:%M UTC")

### Summary
Updated NextAuth configuration and created all 7 SaaS auth API routes.

### Files Modified

#### 1. `/src/lib/auth.ts` — Enhanced NextAuth Configuration
- **Imports**: Added `verifyPassword`, `isAccountLocked`, `getLockoutExpiryDate` from `@/lib/password`
- **authorize()**:
  - Checks account lockout via `isAccountLocked(user.lockedUntil)`
  - Failed password: increments `loginAttempts`, locks at 5 attempts (15 min via `getLockoutExpiryDate`)
  - Successful login: resets `loginAttempts` to 0, clears `lockedUntil`, updates `lastLoginAt`
  - Returns extended object with `entrepriseId`, `premiereConnexion`, `twoFactorEnabled`
- **jwt() callback**: Adds `entrepriseId`, `isSuperAdmin`, `twoFactorEnabled`, `premiereConnexion` to token
- **session() callback**: Propagates all new fields from token to session
- **events.signIn**: Updates `lastLoginAt` on sign in

#### 2. `/src/app/api/auth/forgot-password/route.ts` — POST
- Accepts `{ email }`, finds user, deletes existing tokens
- Creates `PasswordResetToken` (1h expiry) via `generateResetToken()`
- Returns same generic message whether email found or not (security)
- Dev: logs token to console

#### 3. `/src/app/api/auth/reset-password/route.ts` — POST
- Accepts `{ token, password }`, validates token (exists, not used, not expired)
- Validates password strength via `validatePasswordStrength()`
- Hashes password, updates user, sets `premiereConnexion: false`, resets lockout
- Marks token as `usedAt: now()`

#### 4. `/src/app/api/auth/2fa/setup/route.ts` — POST
- Authenticated via `requireAuth(request)`, rejects if 2FA already enabled
- Generates TOTP secret, 10 backup codes, auth URI
- Encrypts and saves secret + backup codes to user
- Returns `{ secret, authURI, backupCodes }` for QR code display
- Sets `twoFactorEnabled: false` (pending verification)

#### 5. `/src/app/api/auth/2fa/verify/route.ts` — POST
- Accepts `{ code }` (6-digit TOTP or 8-digit backup code)
- Decrypts user's TOTP secret, verifies code via `verifyTOTPCode()`
- TOTP valid: enables `twoFactorEnabled: true`
- Backup code valid: removes used code, re-encrypts remaining, enables 2FA
- Returns remaining backup count when backup code used

#### 6. `/src/app/api/auth/2fa/disable/route.ts` — POST
- Accepts `{ code }` for verification before disabling
- Requires current TOTP code to confirm identity
- On valid code: sets `twoFactorEnabled: false`, clears `twoFactorSecret` and `twoFactorBackupCodes`

#### 7. `/src/app/api/auth/invite/route.ts` — POST
- Authenticated via `requireAdmin(request)` (GERANT or SUPER_ADMIN)
- Accepts `{ email, role, nom, prenom }`
- Validates role against allowed list, checks for existing user
- Generates 48-byte hex token, creates `InvitationToken` (48h expiry)
- Returns `{ message, token }`

#### 8. `/src/app/api/auth/invite/accept/route.ts` — POST
- Accepts `{ token, password, name }`
- Validates token (exists, not accepted, not expired)
- Validates password strength, checks for existing user
- Creates new User with invitation's role, entrepriseId, `premiereConnexion: true`
- Marks invitation as accepted, links to user

### Lint
- Fixed `@typescript-eslint/no-require-imports` in 2fa/verify (replaced `require()` with static import)
- Fixed unused eslint-disable directive in two-factor-verify.tsx
- **All clean**: 0 errors, 0 warnings
