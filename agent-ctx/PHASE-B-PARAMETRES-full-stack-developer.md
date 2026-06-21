# PHASE-B-PARAMETRES — full-stack-developer

## Task
Réécrire `frontend/src/components/parametres/parametres-view.tsx` pour utiliser les endpoints
backend EXISTANTS au lieu des endpoints `/api/v1/parametres` inexistants.

## Endpoints utilisés (tous existants — aucun nouvel endpoint créé)
| # | Méthode | Path | Usage dans le composant |
|---|---------|------|-------------------------|
| 1 | GET    | /api/v1/auth/me           | Charge le user courant au mount |
| 2 | PUT    | /api/v1/users/{id}        | Sauvegarde profil (name, telephone) |
| 3 | POST   | /api/v1/auth/2fa/setup    | Génère secret + qrUrl pour setup 2FA |
| 4 | POST   | /api/v1/auth/2fa/verify   | Valide code TOTP → active 2FA |
| 5 | POST   | /api/v1/auth/2fa/disable  | Désactive 2FA (body: {password}) |

## Fichiers modifiés
1. **`frontend/src/components/parametres/parametres-view.tsx`** (1140 lignes, réécriture complète)
   - Charge le user via `goApi.me()` (au lieu de fetch `/api/v1/parametres`).
   - Sauve le profil via `goApi.put('/users/{id}', { name, telephone })` (au lieu de PUT /parametres).
   - 2 sub-composants : `TwoFASetupDialog` et `TwoFADisableDialog`.
   - Onglet "Sécurité" : 2FA fonctionnelle (setup QR + verify + disable), password change
     avec message "Bientôt disponible" (pas d'endpoint self-service).
   - Onglet "Notifications" : localStorage (comme avant).
   - Onglet "Apparence" : utilise `theme !== undefined` de next-themes au lieu d'un state `mounted`.
   - 5 autres onglets conservés (langue, raccourcis, données, à propos) avec ajustements mineurs.

## Package ajouté
- `qrcode.react@4.2.0` — rendering SVG du QR code TOTP (composant `<QRCodeSVG>`).

## Patterns lint — `react-hooks/set-state-in-effect`
L'ancien fichier avait 3 erreurs lint de ce type. Pour les éviter :
- Fetch du user au mount : async IIFE dans useEffect + `let active = true` + cleanup.
- Init notifPrefs : idem, async IIFE avec `await Promise.resolve()` puis setState.
- Init 2FA setup dialog : tout dans async IIFE (setStep/setError inclus).
- Pas de state `mounted` séparé (utilise `theme !== undefined` de next-themes).
Résultat : le fichier passe `bunx eslint` avec EXIT 0.

## Décisions
1. **Entreprise card supprimée** : `/auth/me` ne retourne que `entrepriseId` (pas les détails).
   Au lieu d'afficher un card vide, l'ID tronqué est montré dans "Détails du compte".
2. **Password change "Bientôt disponible"** : `PUT /users/{id}` n'accepte pas `password`
   (DTO `UpdateUserRequest` = name/telephone/role/fonction/active uniquement). `POST /users/{id}/reset-password`
   est réservé aux admins (RBAC: SUPER_ADMIN, GERANT). Pas d'endpoint self-service →
   pas d'UI factice, message honnête + orientation admin.
3. **Session refresh après update** : `goApi.me()` est appelé après chaque PUT /users/{id} et chaque
   opération 2FA pour rafraîchir l'état local. Le `SessionProvider` (auth-session.tsx) ne expose
   pas de méthode `refresh()` — l'header global sera mis à jour au prochain reload. Un event
   custom `opuc-profile-updated` est dispatché pour permettre à d'autres composants de réagir.
4. **2FA dialogs en sub-composants** : isolent l'état (setup/verify/done, password, error) et
   sont réutilisables. Le dialog de setup gère les 3 étapes (loading → qr → done) avec
   reset automatique 200ms après fermeture pour éviter le flicker.

## Validation
- `cd /home/z/my-project/opuc/frontend && bunx eslint src/components/parametres/parametres-view.tsx`
  → EXIT 0 (0 erreur, 0 warning).
- `bunx tsc --noEmit --skipLibCheck` → 0 erreur sur parametres-view.tsx.
- `bun run lint` (project-wide) : 79 erreurs au total (3 de moins qu'avant — les 3 de l'ancien
  parametres-view.tsx sont corrigées). Les 79 restantes sont dans d'autres fichiers
  (use-mobile.ts, useOfflineSync.ts, personnel-view.tsx, engins-view.tsx, etc.) — non concernées.

## Notes
- Dev server tourne sur `/home/z/my-project/` (root stub), pas sur `/home/z/my-project/opuc/frontend/`
  (même situation que worklog SAAS-FRONTEND). Le code est correct (lint + tsc passent).
- Non commit/push.
