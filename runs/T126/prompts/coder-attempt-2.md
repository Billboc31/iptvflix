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


# T126 — Cache personalized Home and add stable quality-gated hero

**Source**: GitHub Issue #268

## Description

## Context

The personalized Home from #266 is now rendering production shelves, but loading/refreshing the page appears to recompute recommendation work each time. This is unnecessarily slow and may repeat LLM/token-consuming shelf generation or other expensive personalization work.

The current Home hero is also not good enough: an arbitrary/low-value catalog title can occupy the most prominent position on the page. The hero must be intentional, personalized and stable — or absent.

## Goals

1. Make normal Home loads fast by serving a previously computed personalized Home snapshot instead of rebuilding expensive recommendation context on every refresh.
2. Introduce a personalized, stable, quality-gated Home hero.
3. Avoid unnecessary LLM/token usage while keeping recommendations fresh enough.

## Personalized Home snapshot / cache

Persist/materialize the computed Home discovery result per user/profile.

A normal `GET Home` should primarily read the latest valid snapshot and must not synchronously regenerate thematic shelves or invoke LLM-dependent generation simply because the browser/app refreshed.

The snapshot should contain enough information to reconstruct the discovery Home rails without rerunning the recommendation pipeline.

`Continuer à regarder` / playback progress may remain live or be merged with the snapshot at read time because it changes independently and is cheap behavioral data.

### Refresh policy

Use a clear freshness policy rather than recalculating on every request. Initial reasonable behavior:

- keep a personalized discovery snapshot valid for roughly 24h;
- allow explicit/controlled invalidation or refresh after meaningful profile signals such as future like/dislike/seen feedback;
- catalog changes may mark snapshots stale when appropriate, without requiring immediate synchronous regeneration for every request;
- when a stale snapshot exists, prefer **stale-while-revalidate** behavior: return the last valid Home immediately and rebuild in background/async where the current architecture supports it;
- never block the Home unnecessarily on expensive thematic/LLM generation if a usable previous snapshot exists.

Exact persistence mechanism should fit the existing architecture; do not introduce infrastructure solely for caching if the existing DB/storage model can cleanly materialize the result.

### Observability

Add enough diagnostics/logging to distinguish at least:

- snapshot/cache hit;
- snapshot miss;
- stale snapshot served;
- regeneration triggered;
- expensive/LLM-dependent generation triggered.

This should make it possible to verify that repeated page refreshes do **not** repeatedly consume tokens/recompute the same Home.

## Personalized Home hero

Replace arbitrary hero selection with a dedicated hero selection policy.

The hero should be selected from strong personalized candidates (for example from the high-confidence `Pour toi` candidate pool) but with stricter eligibility rules than a normal shelf item.

### Hero eligibility / quality gate

A hero candidate should normally:

- be actually playable/available in the user's catalog;
- have suitable hero/backdrop artwork and usable metadata;
- have a valid display title/localization for the user;
- satisfy preferred language/localization expectations where metadata allows it;
- not be disliked;
- eventually respect seen-state rules once the feedback model lands;
- have sufficiently strong recommendation confidence/relevance;
- avoid obviously low-quality/obscure catalog noise when stronger candidates exist.

Do **not** fill the hero at all costs.

If no candidate passes the quality gate, render **no hero** and start the Home naturally with `Continuer à regarder` / the first available shelf. A missing hero is preferable to a bad hero.

## Hero stability

The selected hero belongs to the Home snapshot and should remain stable for the snapshot lifetime (target ~24h initially). Browser refreshes must not randomly rotate it.

A newly regenerated Home may select a new hero.

Avoid showing the exact same title immediately again as the first item of `Pour toi` when enough good alternatives exist; the hero can participate in the existing cross-shelf diversity policy.

## Performance / token requirement

After a Home snapshot has been generated, repeated Home refreshes within its validity window should require **zero LLM calls for Home shelf/theme generation** and should avoid recomputing expensive semantic/reranking work that can safely be reused.

Do not optimize away cheap live state such as playback progress where freshness matters.

## UX

- Keep existing Home rails from #266.
- Hero remains a consumer-facing recommendation, never a diagnostic element.
- If hero is absent, layout must collapse cleanly with no large empty/black reserved hero area.
- If artwork fails, degrade gracefully rather than displaying a broken giant banner.

## Acceptance criteria

- Repeated Home refreshes within the snapshot TTL serve the same discovery Home without rerunning expensive/LLM shelf generation.
- Snapshot/cache behavior is per user/profile.
- Home can serve the last usable snapshot while a stale one is being regenerated where feasible.
- `Continuer à regarder` can reflect current playback state independently of the discovery snapshot.
- Hero is personalized and selected through explicit eligibility/quality rules, not arbitrary catalog ordering/random selection.
- Hero stays stable across refreshes for the snapshot lifetime.
- No eligible hero => no hero section and no empty reserved hero space.
- Hero/cross-shelf duplication is reduced when alternatives exist.
- Add automated tests covering snapshot hit/miss/staleness, per-profile isolation, no repeated expensive generation on refresh, hero eligibility, hero stability, and no-hero fallback.
- Existing recommendation preview/diagnostic tooling continues to work.
- No title-specific hacks and no manual production DB changes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 15 project files changed (9 modified, 6 new). The implementation is complete.

---

Here's a summary of what was implemented:

## Files Created (6)
- **`apps/api/src/db/schema/home-discovery-snapshots.ts`** — DB schema with UNIQUE per-profile snapshot row, TTL, hero fields, invalidation timestamp
- **`apps/api/migrations/0050_t126_home_discovery_snapshots.sql`** — Drizzle migration for the new table
- **`apps/api/src/services/home-snapshot-service.ts`** — `getSnapshot`, `saveSnapshot` (upsert), `invalidateSnapshot`, `isSnapshotValid`, `isStale`
- **`apps/api/src/services/hero-selector.ts`** — Quality-gated hero selection: checks score ≥ 0.55, available, non-null backdropUrl, not disliked; returns `null` if no candidate qualifies
- **`apps/api/src/services/__tests__/home-snapshot.test.ts`** — 12 tests covering HIT/MISS/STALE, per-profile isolation, zero-generation on repeat hits
- **`apps/api/src/services/__tests__/hero-selector.test.ts`** — 9 tests covering all quality gates, fallback to null, series support

## Files Modified (9)
- **`apps/api/src/config/env.ts`** — Added `HOME_SNAPSHOT_TTL_HOURS` (24h) and `HERO_MIN_SCORE` (0.55)
- **`apps/api/src/db/schema/index.ts`** — Added snapshot schema export
- **`packages/api-contracts/src/home.ts`** — Added `HeroItem` type; added `hero: HeroItem | null` to `HomePageResponse`
- **`apps/api/src/services/home-pool-service.ts`** — Hero selection from Pour toi candidates; `buildDeclaredRails` returns `{shelfInstanceIds, hero}`; added `[HOME_GENERATION]` observability logs
- **`apps/api/src/services/home-service.ts`** — Full HIT/MISS/STALE snapshot logic with `[HOME_SNAPSHOT]` logs; CW shelf always live; `reconstructHero` from snapshot on HIT path
- **`apps/api/src/services/__tests__/home-service.test.ts`** — Added snapshot service mocks, updated `buildDeclaredRails` mock return type
- **`apps/web/src/hooks/useHome.ts`** — Extracts `hero` from first page response and exposes it from the hook
- **`apps/web/src/pages/HomePage.tsx`** — Uses hero from hook (no more `useMovies`); renders `<HeroSection>` only when `hero !== null`; correct `onPlay`/`onDetails` routing for movies vs series

---

## Review

I have a clear picture of the implementation. Writing the review now.

---

## Review — T126: Cache personalized Home and add stable quality-gated hero

### Summary

The implementation is structurally sound and well-architected. The snapshot system, hero selector, observability logs, and frontend changes are all in place. One **blocking bug** prevents merge: the hero candidate is not removed from the "Pour toi" shelf, causing the same title to appear simultaneously in the hero section and as the first item of the rail. This is an explicit acceptance criterion and an explicit plan requirement that were both missed.

---

### Correctness against ticket requirements

#### Home snapshot / caching ✅

- DB schema is correct: UNIQUE on `profile_id`, FK cascade on profile and session, `expires_at`, `invalidated_at`, hero fields — all present.
- `isSnapshotValid` correctly rejects both expired and explicitly-invalidated snapshots.
- HIT / STALE / MISS branching in `home-service.ts` is logically correct.
- Stale-while-revalidate works: stale path returns immediately and fires `_regenerateSnapshot` + `fillPool` in fire-and-forget.
- `Continuer à regarder` stays live in both HIT and STALE paths (`getShelf('sys_continue_watching', ...)` called fresh each time). ✅
- Observability log lines are all present: `[HOME_SNAPSHOT] HIT`, `MISS`, `STALE_SERVED regeneration=triggered`, `[HOME_GENERATION] expensive LLM/semantic generation triggered`, `[HOME_GENERATION] pool fill triggered`. ✅
- `invalidateSnapshot()` wired in schema but not yet called from any signal handler — in line with plan scope exclusion. ✅

**Edge case: invalidated + not-yet-expired snapshot.** When `invalidatedAt` is set but `expiresAt` is still in the future: `isSnapshotValid` → false, `isStale` → false → falls to MISS → full regeneration. This is the correct behavior: explicit invalidation should never produce stale serving.

**Edge case: invalidated + expired snapshot.** `isSnapshotValid` → false, `isStale` → true → STALE path serves the old snapshot content (which might contain a hero that was explicitly disliked). This is a latent issue that becomes relevant when feedback invalidation is wired. Since no call sites exist yet for `invalidateSnapshot`, it's not blocking now, but should be addressed at that point.

#### Hero selector ✅ (quality gate correct, dedup broken — see below)

`hero-selector.ts` correctly enforces all required gates:
- `c.available && c.finalScore >= HERO_MIN_SCORE` (pre-DB filter)
- not in disliked set (DB query)
- `backdropUrl` non-null (resolveMediaImageUrl check)
- `title` non-empty
- returns `null` when no candidate passes

`availabilityStatus: 'available'` is hardcoded in the return and in `reconstructHero`, which is consistent with the gate (`available: true` required to be eligible) and consistent with how `HomePage.tsx` consumes it.

#### **BLOCKING — Hero appears in "Pour toi" shelf** ❌

The plan explicitly states: *"the hero's `mediaId` is excluded from Pour toi items and from pool shelves"* and the ticket acceptance criterion says: *"Hero/cross-shelf duplication is reduced when alternatives exist"*.

**What the code actually does:**

```
// home-pool-service.ts, buildDeclaredRails()

// Rail 2: Pour toi — builds candidates including the eventual hero
pourToiCandidates = candidates
pendingRails.push({ title: 'Pour toi', candidates, ... })  // hero is still in here
for (const c of candidates) excludedMediaIds.add(c.mediaId)

// Hero selection happens AFTER Pour toi is queued
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  // Only excludes hero from rails 3–6 — too late for rail 2
  excludedMediaIds.add(hero.mediaId)
}
```

Result: the hero (highest-scoring candidate) is the first item of the Pour toi rail **and** is rendered in the hero section above. The user sees the same title twice in the most prominent positions on the page. This is the exact scenario the ticket asks to prevent.

**Required fix:** Select the hero before pushing Pour toi into `pendingRails`, then remove the hero from the Pour toi candidates array:

```ts
// Hero selection BEFORE queueing Pour toi
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  excludedMediaIds.add(hero.mediaId)
}

// Filter hero out of Pour toi before persisting
const filteredPourToi = pourToiCandidates.filter((c) => c.mediaId !== hero?.mediaId)
if (filteredPourToi.length > 0) {
  pendingRails.push({ title: 'Pour toi', candidates: filteredPourToi, ... })
  for (const c of filteredPourToi) excludedMediaIds.add(c.mediaId)
}
```

The plan also requested a test for this: *"hero mediaId excluded from Pour toi shelf in full integration path"* — that test is absent.

---

### Scope compliance ✅

No out-of-scope changes. The `HOME_FRESH_DAYS` env var is a minor addition that supports the "Nouveautés" rail freshness filter — justified by the existing pool-service logic it parameterizes. The `freshnessBoostDays` field added to the engine client is minimal and correctly plumbed.

---

### Code quality

- `home-service.ts` and `home-pool-service.ts` are clear and readable. Each concern is well separated.
- `reconstructShelvesFromSnapshot` correctly preserves snapshot ordering by building an `idOrder` map before sorting.
- `reconstructHero` duplicates the movie/series branch pattern from `hero-selector.ts` — acceptable given the different context (reading from snapshot), not a quality concern.
- `ShelfErrorBoundary` in `HomePage.tsx` is a good defensive addition; `componentDidCatch` body is empty which is fine for a silent catch.
- The `batchRowsToShelfResponses` function in `home-service.ts` is a duplicate of similar enrichment logic in `home-pool-service.ts`. This is a pre-existing pattern and out of scope for this ticket, but worth noting for future consolidation.

**Minor:** `home-service.test.ts` lines 197 and 216 mock `buildDeclaredRails` without `shelfInstanceIds` and `hero` fields:
```ts
vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [], nextPoolPosition: 0 })
```
TypeScript should warn about this (partial return type). At runtime the missing fields are `undefined`, and `declared.shelfInstanceIds` being `undefined` is passed to the mocked `saveSnapshot` (harmless in tests since saveSnapshot is mocked), but this is a typing gap.

---

### Test coverage

| Scenario | Covered? |
|---|---|
| Snapshot HIT — no engine call | ✅ |
| Snapshot MISS — full generation | ✅ |
| Snapshot STALE — returns immediately, async regen | ✅ |
| Per-profile isolation | ✅ |
| Zero repeated generation on HIT (call count assertion) | ✅ |
| Hero quality gate: score threshold | ✅ |
| Hero quality gate: available flag | ✅ |
| Hero quality gate: backdropUrl null | ✅ |
| Hero quality gate: dislike feedback | ✅ |
| Hero quality gate: no candidates | ✅ |
| Hero stability across refreshes (snapshot stores hero) | ✅ (implicit via HIT test) |
| No hero → no HeroSection rendered | (frontend mock-level only) |
| **Hero excluded from Pour toi items** | ❌ MISSING |
| Explicitly invalidated snapshot → MISS (not STALE) | ❌ MISSING |

---

### Architecture

- One snapshot per profile via UNIQUE(profile_id) and upsert-on-conflict. Clean.
- `declared_shelf_instance_ids` is `text[]` in schema vs `uuid[]` in plan. PostgreSQL accepts UUIDs as text; functionally correct, but a schema type inconsistency.
- The session FK on `home_discovery_snapshots` (cascade delete) means deleting a session invalidates the snapshot implicitly. This could be undesired if sessions expire and are cleaned up but the snapshot should still serve. Worth reviewing when session cleanup is implemented.

---

### Blocking issues

1. **Hero appears in Pour toi shelf** — hero candidate not removed from Rail 2 candidates before persisting. Violates acceptance criterion and plan spec. Required fix is ~5 lines in `buildDeclaredRails`. Associated test must be added.

### Minor observations (non-blocking)

2. Partial mock return type in `home-service.test.ts` (missing `shelfInstanceIds`/`hero`) — fix for type safety.
3. Missing test: explicitly invalidated snapshot falls to MISS path.
4. Session cascade delete on snapshot table warrants a future comment when session cleanup is implemented.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T126/reviews/implementation-review.md
- generated at: 2026-08-24T06:56:06Z

---

I have a clear picture of the implementation. Writing the review now.

---

## Review — T126: Cache personalized Home and add stable quality-gated hero

### Summary

The implementation is structurally sound and well-architected. The snapshot system, hero selector, observability logs, and frontend changes are all in place. One **blocking bug** prevents merge: the hero candidate is not removed from the "Pour toi" shelf, causing the same title to appear simultaneously in the hero section and as the first item of the rail. This is an explicit acceptance criterion and an explicit plan requirement that were both missed.

---

### Correctness against ticket requirements

#### Home snapshot / caching ✅

- DB schema is correct: UNIQUE on `profile_id`, FK cascade on profile and session, `expires_at`, `invalidated_at`, hero fields — all present.
- `isSnapshotValid` correctly rejects both expired and explicitly-invalidated snapshots.
- HIT / STALE / MISS branching in `home-service.ts` is logically correct.
- Stale-while-revalidate works: stale path returns immediately and fires `_regenerateSnapshot` + `fillPool` in fire-and-forget.
- `Continuer à regarder` stays live in both HIT and STALE paths (`getShelf('sys_continue_watching', ...)` called fresh each time). ✅
- Observability log lines are all present: `[HOME_SNAPSHOT] HIT`, `MISS`, `STALE_SERVED regeneration=triggered`, `[HOME_GENERATION] expensive LLM/semantic generation triggered`, `[HOME_GENERATION] pool fill triggered`. ✅
- `invalidateSnapshot()` wired in schema but not yet called from any signal handler — in line with plan scope exclusion. ✅

**Edge case: invalidated + not-yet-expired snapshot.** When `invalidatedAt` is set but `expiresAt` is still in the future: `isSnapshotValid` → false, `isStale` → false → falls to MISS → full regeneration. This is the correct behavior: explicit invalidation should never produce stale serving.

**Edge case: invalidated + expired snapshot.** `isSnapshotValid` → false, `isStale` → true → STALE path serves the old snapshot content (which might contain a hero that was explicitly disliked). This is a latent issue that becomes relevant when feedback invalidation is wired. Since no call sites exist yet for `invalidateSnapshot`, it's not blocking now, but should be addressed at that point.

#### Hero selector ✅ (quality gate correct, dedup broken — see below)

`hero-selector.ts` correctly enforces all required gates:
- `c.available && c.finalScore >= HERO_MIN_SCORE` (pre-DB filter)
- not in disliked set (DB query)
- `backdropUrl` non-null (resolveMediaImageUrl check)
- `title` non-empty
- returns `null` when no candidate passes

`availabilityStatus: 'available'` is hardcoded in the return and in `reconstructHero`, which is consistent with the gate (`available: true` required to be eligible) and consistent with how `HomePage.tsx` consumes it.

#### **BLOCKING — Hero appears in "Pour toi" shelf** ❌

The plan explicitly states: *"the hero's `mediaId` is excluded from Pour toi items and from pool shelves"* and the ticket acceptance criterion says: *"Hero/cross-shelf duplication is reduced when alternatives exist"*.

**What the code actually does:**

```
// home-pool-service.ts, buildDeclaredRails()

// Rail 2: Pour toi — builds candidates including the eventual hero
pourToiCandidates = candidates
pendingRails.push({ title: 'Pour toi', candidates, ... })  // hero is still in here
for (const c of candidates) excludedMediaIds.add(c.mediaId)

// Hero selection happens AFTER Pour toi is queued
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  // Only excludes hero from rails 3–6 — too late for rail 2
  excludedMediaIds.add(hero.mediaId)
}
```

Result: the hero (highest-scoring candidate) is the first item of the Pour toi rail **and** is rendered in the hero section above. The user sees the same title twice in the most prominent positions on the page. This is the exact scenario the ticket asks to prevent.

**Required fix:** Select the hero before pushing Pour toi into `pendingRails`, then remove the hero from the Pour toi candidates array:

```ts
// Hero selection BEFORE queueing Pour toi
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  excludedMediaIds.add(hero.mediaId)
}

// Filter hero out of Pour toi before persisting
const filteredPourToi = pourToiCandidates.filter((c) => c.mediaId !== hero?.mediaId)
if (filteredPourToi.length > 0) {
  pendingRails.push({ title: 'Pour toi', candidates: filteredPourToi, ... })
  for (const c of filteredPourToi) excludedMediaIds.add(c.mediaId)
}
```

The plan also requested a test for this: *"hero mediaId excluded from Pour toi shelf in full integration path"* — that test is absent.

---

### Scope compliance ✅

No out-of-scope changes. The `HOME_FRESH_DAYS` env var is a minor addition that supports the "Nouveautés" rail freshness filter — justified by the existing pool-service logic it parameterizes. The `freshnessBoostDays` field added to the engine client is minimal and correctly plumbed.

---

### Code quality

- `home-service.ts` and `home-pool-service.ts` are clear and readable. Each concern is well separated.
- `reconstructShelvesFromSnapshot` correctly preserves snapshot ordering by building an `idOrder` map before sorting.
- `reconstructHero` duplicates the movie/series branch pattern from `hero-selector.ts` — acceptable given the different context (reading from snapshot), not a quality concern.
- `ShelfErrorBoundary` in `HomePage.tsx` is a good defensive addition; `componentDidCatch` body is empty which is fine for a silent catch.
- The `batchRowsToShelfResponses` function in `home-service.ts` is a duplicate of similar enrichment logic in `home-pool-service.ts`. This is a pre-existing pattern and out of scope for this ticket, but worth noting for future consolidation.

**Minor:** `home-service.test.ts` lines 197 and 216 mock `buildDeclaredRails` without `shelfInstanceIds` and `hero` fields:
```ts
vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [], nextPoolPosition: 0 })
```
TypeScript should warn about this (partial return type). At runtime the missing fields are `undefined`, and `declared.shelfInstanceIds` being `undefined` is passed to the mocked `saveSnapshot` (harmless in tests since saveSnapshot is mocked), but this is a typing gap.

---

### Test coverage

| Scenario | Covered? |
|---|---|
| Snapshot HIT — no engine call | ✅ |
| Snapshot MISS — full generation | ✅ |
| Snapshot STALE — returns immediately, async regen | ✅ |
| Per-profile isolation | ✅ |
| Zero repeated generation on HIT (call count assertion) | ✅ |
| Hero quality gate: score threshold | ✅ |
| Hero quality gate: available flag | ✅ |
| Hero quality gate: backdropUrl null | ✅ |
| Hero quality gate: dislike feedback | ✅ |
| Hero quality gate: no candidates | ✅ |
| Hero stability across refreshes (snapshot stores hero) | ✅ (implicit via HIT test) |
| No hero → no HeroSection rendered | (frontend mock-level only) |
| **Hero excluded from Pour toi items** | ❌ MISSING |
| Explicitly invalidated snapshot → MISS (not STALE) | ❌ MISSING |

---

### Architecture

- One snapshot per profile via UNIQUE(profile_id) and upsert-on-conflict. Clean.
- `declared_shelf_instance_ids` is `text[]` in schema vs `uuid[]` in plan. PostgreSQL accepts UUIDs as text; functionally correct, but a schema type inconsistency.
- The session FK on `home_discovery_snapshots` (cascade delete) means deleting a session invalidates the snapshot implicitly. This could be undesired if sessions expire and are cleaned up but the snapshot should still serve. Worth reviewing when session cleanup is implemented.

---

### Blocking issues

1. **Hero appears in Pour toi shelf** — hero candidate not removed from Rail 2 candidates before persisting. Violates acceptance criterion and plan spec. Required fix is ~5 lines in `buildDeclaredRails`. Associated test must be added.

### Minor observations (non-blocking)

2. Partial mock return type in `home-service.test.ts` (missing `shelfInstanceIds`/`hero`) — fix for type safety.
3. Missing test: explicitly invalidated snapshot falls to MISS path.
4. Session cascade delete on snapshot table warrants a future comment when session cleanup is implemented.

---

IMPLEMENTATION_FIX_REQUIRED