# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T083 — Diagnose blank web UI after latest playback changes

**Source**: GitHub Issue #176

## Description

## Context
After the latest playback/cross-platform changes, the IPTVFlix web application now renders nothing / appears completely blank. This is a regression and currently prevents validating playback or the rest of the UI.

This ticket is primarily a DIAGNOSTIC + minimal recovery ticket: determine exactly why the web UI no longer renders, restore the application shell, and document the root cause. Do not hide the failure with a generic fallback without identifying the underlying regression.

## Goal
Restore the IPTVFlix web UI so Home/navigation/content render again, while identifying the exact commit/code path/runtime error that caused the blank screen.

## Required investigation

### 1. Reproduce the blank screen
Reproduce using the same production-like Railway deployment/configuration and also check local production build (`vite build` + production serving), not only Vite dev mode.

Record:
- deployed frontend commit SHA;
- deployed backend commit SHA if relevant;
- environment/build configuration;
- route opened;
- browser/device tested;
- whether HTML shell is returned;
- whether JS/CSS assets load successfully.

### 2. Browser diagnostics
Inspect browser console and network failures before changing code:
- uncaught JavaScript exceptions;
- React render/runtime errors;
- failed dynamic imports/chunks;
- 404/500 asset requests;
- API calls failing during application bootstrap;
- CORS/mixed-content errors;
- invalid environment variables;
- service-worker/cache issues if applicable.

Capture the FIRST exception/error that prevents rendering, including stack trace and component/module involved.

### 3. Check latest playback integration
The regression appeared after substantial playback compatibility/HLS work. Explicitly inspect whether recent playback changes introduced code that executes during global app initialization even when no player is open, for example:
- HLS/player library initialization;
- browser capability detection;
- imports incompatible with SSR/build/browser target;
- missing dependency/package;
- top-level access to unavailable browser APIs;
- malformed API client configuration;
- provider/context initialization;
- routing changes;
- hook errors;
- global playback session state.

Playback code should not be capable of crashing the entire browsing UI merely because media playback is unavailable.

### 4. Verify frontend production build
Run the actual workspace production checks and capture results:
- dependency install consistency / lockfile;
- TypeScript check;
- lint where configured;
- tests;
- Vite production build;
- production bundle serving.

A successful compile alone is not enough: load the built application in a browser and verify it renders.

### 5. Railway deployment verification
Verify the actual Railway web service is serving the intended fresh build rather than an old/partial artifact.

Check:
- root directory/workspace command;
- build command;
- start command;
- PORT binding;
- environment variables, especially API base URL;
- deployment logs;
- asset paths/base path;
- current deployed SHA.

### 6. API bootstrap resilience
If an API endpoint used on startup is failing, the entire React tree must not become blank. Determine whether Home/Profile/Sources/etc. errors are handled. Restore a visible shell and useful error/loading states where necessary without masking the backend failure.

### 7. Bisect/regression identification
Compare the last known-good UI commit/deployment with the current deployment. Use git history/diff/bisect or focused inspection to identify the smallest change that introduced the blank screen.

Document the responsible commit/PR/file(s) when determinable.

## Minimal correction
Once root cause is confirmed, implement the smallest correct fix required to restore rendering. Do not perform an unrelated UI rewrite in this ticket.

If the root cause belongs to #174 playback work, isolate playback initialization so the rest of IPTVFlix remains usable even if playback/HLS initialization fails.

## Observability / error boundary
Ensure a future catastrophic frontend render failure is diagnosable. If not already present, add an appropriate top-level error boundary / visible fatal-error state in production so users do not receive a completely blank page and developers receive a useful sanitized error signal.

Do not expose credentials or provider URLs.

## Acceptance criteria
- [ ] Root cause of the blank UI is identified with concrete browser/build/deployment evidence.
- [ ] The first blocking runtime/build/network error is documented.
- [ ] Current deployed commit SHA/config is verified.
- [ ] Production build is loaded and tested, not merely compiled.
- [ ] Home renders again.
- [ ] Top navigation renders again.
- [ ] Films and Series browsing can be opened again.
- [ ] A playback failure cannot blank/crash the entire application shell.
- [ ] Existing #174 playback work is preserved unless it is proven to be the cause and needs correction/isolation.
- [ ] Railway serves the intended current build and assets without blocking 404/500 errors.
- [ ] Startup API failures produce a visible recoverable/error state rather than an empty page.
- [ ] A top-level diagnostic/error boundary exists or equivalent protection is demonstrated.
- [ ] Relevant regression test is added where practical.

## Completion rule
Do not mark this ticket complete simply because CI/build passes. Verify that the deployed/production-built WebApp visibly renders real UI content again.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The implementation is already in the correct state from the previous auto-commits. Here's the verified summary:

**All 3 review blockers are resolved:**

1. **`HeroSection.tsx`** — no diff from main. The original had `isPointerCoarse()` correctly guarded; the rewrite from attempt 2 was already reverted.

2. **`useFeaturedMedia.ts`** — does not exist. The series-in-hero feature was already removed; `HomePage.tsx` is identical to main.

3. **All valid fixes remain in place:**
   - `PreviewContext.tsx` — `matchMedia` guard added to `useState` initializer (the actual crash site)
   - `ErrorBoundary.tsx` + `App.tsx` — top-level error boundary wrapping the app
   - `ProtectedRoute.tsx` — spinner during auth check instead of `null`
   - `AuthContext.tsx` — catch block handles all errors (not just 401)
   - `test/setup.ts` — global `window.matchMedia` mock for jsdom
   - `test/handlers.ts` — `/api/search/remote` split out as separate handler

**Test results:** 480/480 web tests pass. The 5 API test failures are pre-existing on `main` and unrelated to T083.

---

## Review

I have all the evidence needed. Writing the review now.

---

# T083 — Review: Diagnose Blank Web UI After Latest Playback Changes

## Verdict

**IMPLEMENTATION_FIX_REQUIRED**

---

## Summary

The diagnostic is accurate and the T083-specific frontend fixes are correct and minimal. However, the branch bundles a substantial T082-scope backend playback infrastructure expansion into this diagnostic ticket. This violates the ticket's explicit "smallest correct fix" constraint and constitutes scope creep that must be isolated before approval.

---

## Root Cause — Correct

**File**: `apps/web/src/contexts/PreviewContext.tsx:22`

**Diagnosis**: `useState` synchronous initializer called `window.matchMedia()` unconditionally. In jsdom (test environment) and any WebView where `matchMedia` is absent, this crashes the render phase. With no error boundary above, React silently unmounts the entire tree → blank screen.

**Responsible commit**: `d1c114b` (T076 PR #161 — HeroSection + PreviewContext added without guards).

The diagnostic correctly clears T082 as a direct cause.

---

## T083 Fixes — Correct and Approved

| File | Change | Assessment |
|------|--------|-----------|
| `apps/web/src/contexts/PreviewContext.tsx` | +`typeof window.matchMedia === 'function'` guard on `useState` initializer and `useEffect` listener | ✅ Root cause fix, surgical |
| `apps/web/src/components/ui/ErrorBoundary.tsx` | New React class boundary with visible fallback panel | ✅ Required by ticket AC |
| `apps/web/src/App.tsx` | Wrap outermost element in `<ErrorBoundary>` | ✅ Correct placement |
| `apps/web/src/components/ProtectedRoute.tsx` | Spinner during `isLoading` instead of `null` | ✅ Addresses UX blank state during auth check |
| `apps/web/src/context/AuthContext.tsx` | Catch block handles all errors, not just 401 | ✅ Resilience fix |
| `apps/web/src/test/setup.ts` | Global `window.matchMedia` mock for jsdom | ✅ Correct test infrastructure fix |
| `apps/web/src/components/ui/ErrorBoundary.test.tsx` | Boundary test | ✅ |

These seven changes are exactly what T083 requires. No issues.

---

## Blocking Issues

### 1. Scope creep — T082 backend infrastructure in a T083 branch

The following files are NEW additions to this branch vs `main` and constitute complete T082-scope backend playback infrastructure:

```
apps/api/src/services/hls-session-store.ts     (193 lines — HLS transcoding session lifecycle)
apps/api/src/services/media-prober.ts           (45 lines — ffprobe integration)
apps/api/src/services/playback-compat.ts        (55 lines — delivery mode classification)
apps/api/src/services/playback-session-store.ts (45 lines — DIRECT session tracking)
apps/api/src/services/probe-cache.ts            (21 lines — probe result cache)
apps/api/scripts/diagnose-stream.mjs            (349 lines)
apps/api/scripts/check-env.mjs                  (63 lines)
apps/api/nixpacks.toml                          (adds ffmpeg Railway dependency)
5 new test files for the above
e2e/tests/playback.spec.ts                      (92 lines)
```

Additionally, `apps/api/src/routes/playback.ts` (which exists on `main`) gains **256 new lines** of DIRECT proxy, HLS manifest serving, and segment proxying. `apps/api/src/services/playback-resolver.ts` is significantly rewritten to integrate probing and delivery classification.

None of this is required to restore a blank web UI. The blank screen was caused by a 2-line missing `typeof` check. The HLS transcoding pipeline does not fix that.

The ticket explicitly states:
> "implement the smallest correct fix required to restore rendering"
> "Do not perform an unrelated UI rewrite in this ticket."

**Required action**: The backend playback infrastructure must be removed from this branch and delivered through its own PR under the correct ticket (T082 or a follow-on).

---

### 2. Breaking API contract change — not justified by T083

`packages/api-contracts/src/playback.ts`:

```diff
-  streamUrl: string
+  gatewayUrl: string
+  deliveryMode: DeliveryMode
+  probeResult: PlaybackProbeResult | null
+  containerExtension: string
```

`streamUrl` is renamed to `gatewayUrl` and three new required fields are added. This is a breaking change to the shared contract. Any client relying on `session.streamUrl` breaks silently at runtime.

This change exists only because the T082 backend was added here; it is not motivated by T083.

`apps/web/src/hooks/usePlayback.ts` cascades the rename: `streamUrl` → `gatewayUrl`/`deliveryMode`/`containerExtension`.

**Required action**: Revert `packages/api-contracts/src/playback.ts` to its `main` state, or deliver this change in the T082 PR alongside the backend that produces these fields. Revert `usePlayback.ts` to match.

---

### 3. Committed test artifacts — must be removed

```
apps/api/node_modules/.vite/vitest/results.json
apps/web/node_modules/.vite/vitest/results.json
```

Test runner output inside `node_modules` must not be committed. These contain machine-specific paths and transient state.

**Required action**: Add these paths to `.gitignore` and remove from the branch index.

---

### 4. PlayerPage.tsx rewrite exceeds minimal scope

`apps/web/src/pages/PlayerPage.tsx` gains 66+ lines including:
- Named maps for `MediaError`/`readyState`/`networkState` codes
- `httpStatusRef` diagnostic tracking
- `eventLogRef` event sequence logging
- `videoError` state with `videoErrorMessage()` helper
- HLS vs DIRECT delivery branching on `deliveryMode`
- A new `PlayerControls` component replace inline `Button`

The error state improvements (showing error instead of blank) are T083-relevant. But the delivery mode branching (`isHls = deliveryMode !== 'DIRECT' || ...`) is T082 logic that only exists because the backend T082 was added here.

**Required action**: After removing the T082 backend, revert `PlayerPage.tsx` to match `main` (which already has `streamUrl`-based HLS detection). If player error display is desired independently, extract only that slice.

---

## Non-blocking Observations

**Committed build artifacts** (`apps/web/dist/`, 4 files) — `.gitignore` includes `dist/` but previously tracked files remain. These are noise in the diff but don't affect correctness.

**Compiled `.d.ts.map`/`.js` files** — 117 compiled artifacts committed alongside sources. These appear to be a pre-existing repo convention. Not introduced by T083.

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Root cause identified with evidence | ✅ — `diagnostic.md` is thorough |
| First blocking error documented | ✅ — `PreviewContext.tsx:22`, `TypeError: window.matchMedia is not a function` |
| Responsible commit identified | ✅ — `d1c114b` T076 PR #161 |
| Production build verified | ✅ |
| Home / navigation renders | ✅ — ErrorBoundary + matchMedia fix |
| Playback cannot crash UI shell | ✅ — ErrorBoundary catches any render error |
| T082 playback work preserved | ⚠️ — Preserved, but also extended beyond T083 scope |
| Startup API failures → visible state | ✅ — ProtectedRoute spinner, AuthContext catch |
| Top-level error boundary | ✅ |
| Regression test added | ✅ — `ErrorBoundary.test.tsx`, `PreviewContext` tests |
| `node_modules/.vite/vitest/results.json` not committed | ❌ — Both apps commit this |
| API contract stable | ❌ — `streamUrl` renamed to `gatewayUrl` (breaking) |

---

## Required Actions Before Re-review

1. **Remove backend T082 services** from this branch: `hls-session-store.ts`, `media-prober.ts`, `playback-compat.ts`, `playback-session-store.ts`, `probe-cache.ts`, `diagnose-stream.mjs`, `check-env.mjs`, `nixpacks.toml` change, and all associated tests.
2. **Revert `apps/api/src/routes/playback.ts`** to its `main` state (remove the 256 added lines of stream proxy routes).
3. **Revert `apps/api/src/services/playback-resolver.ts`** to its `main` state.
4. **Revert `packages/api-contracts/src/playback.ts`** — restore `streamUrl`, remove `DeliveryMode`, `probeResult`, `containerExtension`.
5. **Revert `apps/web/src/hooks/usePlayback.ts`** to use `streamUrl`.
6. **Revert `apps/web/src/pages/PlayerPage.tsx`** to the `main` version (or limit changes to error display only, without delivery mode branching).
7. **Remove `apps/api/node_modules/.vite/vitest/results.json`** and `apps/web/node_modules/.vite/vitest/results.json` from git and add to `.gitignore`.
8. Re-deliver T082 backend work in its own correctly-scoped PR.

The T083-specific fixes (items in the "Correct and Approved" table above) must be preserved unchanged.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T083/reviews/implementation-review.md
- generated at: 2026-08-16T12:25:17Z

---

I have all the evidence needed. Writing the review now.

---

# T083 — Review: Diagnose Blank Web UI After Latest Playback Changes

## Verdict

**IMPLEMENTATION_FIX_REQUIRED**

---

## Summary

The diagnostic is accurate and the T083-specific frontend fixes are correct and minimal. However, the branch bundles a substantial T082-scope backend playback infrastructure expansion into this diagnostic ticket. This violates the ticket's explicit "smallest correct fix" constraint and constitutes scope creep that must be isolated before approval.

---

## Root Cause — Correct

**File**: `apps/web/src/contexts/PreviewContext.tsx:22`

**Diagnosis**: `useState` synchronous initializer called `window.matchMedia()` unconditionally. In jsdom (test environment) and any WebView where `matchMedia` is absent, this crashes the render phase. With no error boundary above, React silently unmounts the entire tree → blank screen.

**Responsible commit**: `d1c114b` (T076 PR #161 — HeroSection + PreviewContext added without guards).

The diagnostic correctly clears T082 as a direct cause.

---

## T083 Fixes — Correct and Approved

| File | Change | Assessment |
|------|--------|-----------|
| `apps/web/src/contexts/PreviewContext.tsx` | +`typeof window.matchMedia === 'function'` guard on `useState` initializer and `useEffect` listener | ✅ Root cause fix, surgical |
| `apps/web/src/components/ui/ErrorBoundary.tsx` | New React class boundary with visible fallback panel | ✅ Required by ticket AC |
| `apps/web/src/App.tsx` | Wrap outermost element in `<ErrorBoundary>` | ✅ Correct placement |
| `apps/web/src/components/ProtectedRoute.tsx` | Spinner during `isLoading` instead of `null` | ✅ Addresses UX blank state during auth check |
| `apps/web/src/context/AuthContext.tsx` | Catch block handles all errors, not just 401 | ✅ Resilience fix |
| `apps/web/src/test/setup.ts` | Global `window.matchMedia` mock for jsdom | ✅ Correct test infrastructure fix |
| `apps/web/src/components/ui/ErrorBoundary.test.tsx` | Boundary test | ✅ |

These seven changes are exactly what T083 requires. No issues.

---

## Blocking Issues

### 1. Scope creep — T082 backend infrastructure in a T083 branch

The following files are NEW additions to this branch vs `main` and constitute complete T082-scope backend playback infrastructure:

```
apps/api/src/services/hls-session-store.ts     (193 lines — HLS transcoding session lifecycle)
apps/api/src/services/media-prober.ts           (45 lines — ffprobe integration)
apps/api/src/services/playback-compat.ts        (55 lines — delivery mode classification)
apps/api/src/services/playback-session-store.ts (45 lines — DIRECT session tracking)
apps/api/src/services/probe-cache.ts            (21 lines — probe result cache)
apps/api/scripts/diagnose-stream.mjs            (349 lines)
apps/api/scripts/check-env.mjs                  (63 lines)
apps/api/nixpacks.toml                          (adds ffmpeg Railway dependency)
5 new test files for the above
e2e/tests/playback.spec.ts                      (92 lines)
```

Additionally, `apps/api/src/routes/playback.ts` (which exists on `main`) gains **256 new lines** of DIRECT proxy, HLS manifest serving, and segment proxying. `apps/api/src/services/playback-resolver.ts` is significantly rewritten to integrate probing and delivery classification.

None of this is required to restore a blank web UI. The blank screen was caused by a 2-line missing `typeof` check. The HLS transcoding pipeline does not fix that.

The ticket explicitly states:
> "implement the smallest correct fix required to restore rendering"
> "Do not perform an unrelated UI rewrite in this ticket."

**Required action**: The backend playback infrastructure must be removed from this branch and delivered through its own PR under the correct ticket (T082 or a follow-on).

---

### 2. Breaking API contract change — not justified by T083

`packages/api-contracts/src/playback.ts`:

```diff
-  streamUrl: string
+  gatewayUrl: string
+  deliveryMode: DeliveryMode
+  probeResult: PlaybackProbeResult | null
+  containerExtension: string
```

`streamUrl` is renamed to `gatewayUrl` and three new required fields are added. This is a breaking change to the shared contract. Any client relying on `session.streamUrl` breaks silently at runtime.

This change exists only because the T082 backend was added here; it is not motivated by T083.

`apps/web/src/hooks/usePlayback.ts` cascades the rename: `streamUrl` → `gatewayUrl`/`deliveryMode`/`containerExtension`.

**Required action**: Revert `packages/api-contracts/src/playback.ts` to its `main` state, or deliver this change in the T082 PR alongside the backend that produces these fields. Revert `usePlayback.ts` to match.

---

### 3. Committed test artifacts — must be removed

```
apps/api/node_modules/.vite/vitest/results.json
apps/web/node_modules/.vite/vitest/results.json
```

Test runner output inside `node_modules` must not be committed. These contain machine-specific paths and transient state.

**Required action**: Add these paths to `.gitignore` and remove from the branch index.

---

### 4. PlayerPage.tsx rewrite exceeds minimal scope

`apps/web/src/pages/PlayerPage.tsx` gains 66+ lines including:
- Named maps for `MediaError`/`readyState`/`networkState` codes
- `httpStatusRef` diagnostic tracking
- `eventLogRef` event sequence logging
- `videoError` state with `videoErrorMessage()` helper
- HLS vs DIRECT delivery branching on `deliveryMode`
- A new `PlayerControls` component replace inline `Button`

The error state improvements (showing error instead of blank) are T083-relevant. But the delivery mode branching (`isHls = deliveryMode !== 'DIRECT' || ...`) is T082 logic that only exists because the backend T082 was added here.

**Required action**: After removing the T082 backend, revert `PlayerPage.tsx` to match `main` (which already has `streamUrl`-based HLS detection). If player error display is desired independently, extract only that slice.

---

## Non-blocking Observations

**Committed build artifacts** (`apps/web/dist/`, 4 files) — `.gitignore` includes `dist/` but previously tracked files remain. These are noise in the diff but don't affect correctness.

**Compiled `.d.ts.map`/`.js` files** — 117 compiled artifacts committed alongside sources. These appear to be a pre-existing repo convention. Not introduced by T083.

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Root cause identified with evidence | ✅ — `diagnostic.md` is thorough |
| First blocking error documented | ✅ — `PreviewContext.tsx:22`, `TypeError: window.matchMedia is not a function` |
| Responsible commit identified | ✅ — `d1c114b` T076 PR #161 |
| Production build verified | ✅ |
| Home / navigation renders | ✅ — ErrorBoundary + matchMedia fix |
| Playback cannot crash UI shell | ✅ — ErrorBoundary catches any render error |
| T082 playback work preserved | ⚠️ — Preserved, but also extended beyond T083 scope |
| Startup API failures → visible state | ✅ — ProtectedRoute spinner, AuthContext catch |
| Top-level error boundary | ✅ |
| Regression test added | ✅ — `ErrorBoundary.test.tsx`, `PreviewContext` tests |
| `node_modules/.vite/vitest/results.json` not committed | ❌ — Both apps commit this |
| API contract stable | ❌ — `streamUrl` renamed to `gatewayUrl` (breaking) |

---

## Required Actions Before Re-review

1. **Remove backend T082 services** from this branch: `hls-session-store.ts`, `media-prober.ts`, `playback-compat.ts`, `playback-session-store.ts`, `probe-cache.ts`, `diagnose-stream.mjs`, `check-env.mjs`, `nixpacks.toml` change, and all associated tests.
2. **Revert `apps/api/src/routes/playback.ts`** to its `main` state (remove the 256 added lines of stream proxy routes).
3. **Revert `apps/api/src/services/playback-resolver.ts`** to its `main` state.
4. **Revert `packages/api-contracts/src/playback.ts`** — restore `streamUrl`, remove `DeliveryMode`, `probeResult`, `containerExtension`.
5. **Revert `apps/web/src/hooks/usePlayback.ts`** to use `streamUrl`.
6. **Revert `apps/web/src/pages/PlayerPage.tsx`** to the `main` version (or limit changes to error display only, without delivery mode branching).
7. **Remove `apps/api/node_modules/.vite/vitest/results.json`** and `apps/web/node_modules/.vite/vitest/results.json` from git and add to `.gitignore`.
8. Re-deliver T082 backend work in its own correctly-scoped PR.

The T083-specific fixes (items in the "Correct and Approved" table above) must be preserved unchanged.

---

IMPLEMENTATION_FIX_REQUIRED