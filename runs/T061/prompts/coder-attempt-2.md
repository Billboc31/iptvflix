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


# T061 — Backfill and reconcile already-synced media without TMDB identities

**Source**: GitHub Issue #123

## Description

## Objective

Reprocess the existing IPTVFlix catalog so Movies and Series that were synchronized before title-based TMDB resolution was wired into the ingestion pipeline can be matched, canonicalized and deduplicated without requiring users to delete/recreate sources or perform a destructive full reset.

## Context / Problem

Issue #122 adds the missing behavior for future source synchronization: when Xtream does not provide a usable TMDB ID, IPTVFlix should normalize the provider title, use the existing title matching service and attach the stream as an Availability of the resolved canonical Media.

However, a large catalog has already been ingested under the old behavior. Those existing records may currently have:

- no TMDB identity;
- dirty provider titles used as the Media display title;
- multiple Media rows representing different language/quality streams of the same artwork;
- Availability data that must be preserved during reconciliation.

This ticket is specifically about **backfilling existing persisted data** after #122 is available.

## Included

### Re-evaluate existing unresolved Media

- Identify existing Movies/Series that do not have a usable canonical external identity and are eligible for re-matching.
- Reuse the normalization and confidence-based matching behavior delivered by #122; do not introduce a second matching algorithm.
- Use the best available persisted source signals, including raw provider title, normalized title/year/type and source mappings.
- Process Movies and Series safely and independently.

### Canonical reconciliation

When an existing unresolved Media confidently resolves to a TMDB-backed canonical Media:

- attach/move its Availability records to the canonical Media as appropriate;
- preserve raw provider/source identifiers and variant information;
- promote canonical/enriched title/metadata for the user-facing Media;
- avoid duplicate Media cards for entries that resolve to the same artwork.

If several old Media records resolve to the same canonical identity, reconcile them into one user-facing Media while preserving all legitimate Availability variants.

### Preserve user state and references

Reconciliation must not silently lose user data. Existing references associated with superseded/merged Media must be migrated or preserved according to the repository's model, including where applicable:

- watchlist entries;
- viewing progress/history;
- feedback/likes/dislikes;
- shelf membership;
- follow/tracking state;
- other profile-scoped Media references introduced by the current schema.

The Planner must inspect current foreign keys and uniqueness constraints before choosing the merge strategy.

### Leave ambiguous content intact

- Low-confidence or ambiguous matches remain unresolved.
- Do not delete or hide an existing playable Media merely because TMDB matching fails.
- Preserve retry eligibility for unresolved records.

### Backfill execution model

Provide a safe, explicit way to run the backfill against an existing database. The exact mechanism should fit the existing architecture (job/maintenance command/admin action/startup migration is for the Planner to decide), but it must:

- be resumable/retryable;
- be idempotent;
- expose progress/results sufficiently for diagnostics;
- avoid requiring the source itself to be deleted and re-added;
- avoid blocking normal application usage for an excessive period.

### Scale and TMDB protection

The existing catalog may contain many thousands of unresolved Media records. The backfill must therefore:

- use bounded concurrency/rate limiting compatible with the TMDB integration;
- cache/reuse matching decisions where appropriate;
- avoid repeating expensive work for records already successfully reconciled;
- tolerate temporary TMDB failures and continue/retry safely;
- support partial progress without corrupting the catalog.

### Merge safety / concurrency

- Reconciliation of two or more rows toward one canonical identity must be transactionally safe.
- Database constraints/transactions/locks or equivalent safeguards must prevent duplicate canonical rows and partially migrated references.
- A failure during one Media reconciliation must not leave its Availability or user state split inconsistently across old/new identities.

## Acceptance Criteria

- [ ] Existing Movie records without TMDB IDs can be re-evaluated using the same matching policy as #122.
- [ ] Existing Series records without TMDB IDs can be re-evaluated without mixing Movie and Series identity.
- [ ] Running the backfill does not require deleting/recreating an Xtream source.
- [ ] Multiple previously separate Media records that confidently resolve to the same artwork become one user-facing canonical Media with their valid Availability variants preserved.
- [ ] Canonical/enriched title and metadata replace dirty provider titles in user-facing Media APIs after successful reconciliation.
- [ ] Raw provider titles/IDs remain available at the source/Availability level.
- [ ] Watchlist, progress/history, feedback, shelves and other existing Media references are preserved or migrated deterministically when Media identities are merged.
- [ ] Ambiguous/unmatched Media remain visible/playable and are not falsely merged.
- [ ] The backfill is idempotent: re-running it does not create duplicate Media, Availability rows or user-state references.
- [ ] The backfill is resumable/retryable after interruption or temporary TMDB failure.
- [ ] TMDB calls use bounded concurrency/rate limiting and do not create an uncontrolled burst across the unresolved catalog.
- [ ] Progress/outcome information can distinguish matched, merged, still-unmatched, skipped and failed records sufficiently for diagnostics.
- [ ] Automated tests cover existing-data matching, multi-row merge, Availability preservation, user-state migration, ambiguous match, retry/idempotency and interrupted/failed reconciliation.

## Excluded / Out of scope

- Changing the matching algorithm introduced by #122 except where a defect must be fixed to reuse it safely.
- Bulk-importing TMDB's full catalog.
- Recommendation/shelf generation logic.
- Browser playback compatibility.
- Destructive source reset as the normal solution.

## Dependencies

Requires #122's source-sync title matching/canonical-resolution behavior (or the equivalent reusable matching service) to be available first. This ticket exists to migrate/reconcile data already persisted before that behavior was active.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All T061 implementation tasks are complete. Here's a summary of everything delivered:

**Files created/modified:**
- `apps/api/src/db/schema/reconciliation-runs.ts` — Drizzle schema with partial unique index (`RUNNING` singleton guard)
- `apps/api/migrations/0025_reconciliation_runs.sql` — SQL migration for enum + table
- `apps/api/src/db/schema/index.ts` — added `reconciliation-runs` export
- `apps/api/src/services/media-reconciliation-service.ts` — full service with cursor-based batch loop, transactional merge, dryRun support, and fire-and-forget split (`startRun` / `executeRun` / `reconcile`)
- `apps/api/src/routes/reconcile.ts` — `POST /admin/reconcile` (202 fire-and-forget) + `GET /admin/reconcile/:runId`
- `apps/api/src/index.ts` — wired `MediaReconciliationService` + `reconcileRoutes` into protected scope
- `apps/api/src/services/__tests__/media-reconciliation-service.test.ts` — 11 integration test scenarios
- `apps/api/migrations/meta/_journal.json` — added idx=24 (`0024_fuzzy_starbolt`) and idx=25 (`0025_reconciliation_runs`) entries
- `apps/api/migrations/meta/0025_snapshot.json` — full snapshot with `reconciliation_runs` table and `reconciliation_status` enum added

The two pre-existing TypeScript errors in `authenticateDevice.test.ts` and `playback-resolver.test.ts` are unrelated to T061. No new type errors were introduced.

---

## Review

I have enough information to write the review. Let me compile it now.

---

# PR Review — T061: Backfill and reconcile already-synced media without TMDB identities

## Overview

The implementation adds a `MediaReconciliationService`, an HTTP admin endpoint pair, a `reconciliation_runs` table/migration, and 11 integration tests. The core backfill logic — cursor pagination, transactional merge, user-state migration, rate-limit respect — is well-executed. Several issues require fixes before approval.

---

## Scope compliance

**Included / correct:**
- Reuses `TitleMatchingService` from T060 without modification ✓
- Processes MOVIE and SERIES independently ✓
- Preserves all user-state tables: watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release, profile_taste, media_arrivals, release_events ✓
- Leaves ambiguous/unmatched records intact ✓
- Admin endpoints protected by existing auth middleware ✓
- Rate limiting delegated to `MATCH_CONCURRENCY` / `MATCH_THROTTLE_MS` ✓
- Idempotency via ON CONFLICT DO NOTHING pattern ✓

**No scope drift detected.**

---

## Blocking Issues

### 1. Test 11 does not test cursor resumability from an interrupted run

**Plan acceptance criterion 8:** _"Interrupting the backfill and restarting resumes from the last committed cursor position; records from committed batches are not re-processed."_

Test 11 (`cursor resumability — records from committed batches are not re-processed`) does not test this. What it actually does:

1. Runs full `reconcile()` on 3 movies → all become UNMATCHED
2. Deletes the run row (`await db.delete(reconciliationRuns)`)
3. Runs `reconcile()` again → all 3 re-processed

This tests re-eligibility of UNMATCHED records (already covered by test 9's idempotency pass), not cursor-based resumption. A true cursor resumption test would:
1. Start a run with `startRun()`
2. Manually advance the cursor to simulate a partially completed interrupted run (update `cursorMovieId` to the second movie's ID)
3. Call `executeRun(runId)` directly on the still-RUNNING row
4. Assert only the third movie (after the cursor) was processed

The code correctly reads `cursorMovieId`/`cursorSeriesId` from the DB at the start of each `_processType` call, so the implementation is sound — but the test does not exercise that path. The plan explicitly required this scenario.

**Fix required:** Replace or supplement test 11 with a test that:
- Creates a RUNNING row with `cursorMovieId` set to a mid-batch ID
- Calls `executeRun(runId)` directly
- Asserts that only records with `id > cursorMovieId` are processed

---

### 2. `startRun` race condition — concurrent POST returns 500 instead of 409

```typescript
// apps/api/src/services/media-reconciliation-service.ts:55-67
const [existing] = await db.select(...).from(reconciliationRuns).where(eq(..., 'RUNNING'))
if (existing) throw new ReconciliationAlreadyRunningError(existing.id)
const [run] = await db.insert(reconciliationRuns).values({ status: 'RUNNING', ... }).returning(...)
```

Two simultaneous POST `/admin/reconcile` requests can both pass the SELECT check before either INSERT lands. The partial unique index on `status = 'RUNNING'` correctly rejects the second INSERT with a PostgreSQL constraint violation. However, that constraint error is not a `ReconciliationAlreadyRunningError`, so the route handler's catch block does not intercept it:

```typescript
// apps/api/src/routes/reconcile.ts:23-29
} catch (err) {
  if (err instanceof ReconciliationAlreadyRunningError) {
    return reply.status(409).send({ error: err.message })
  }
  throw err  // constraint error propagates as 500
}
```

Data integrity is preserved by the index. The bug is a wrong HTTP status to the caller.

**Fix required:** Catch the DB unique constraint error in `startRun` and translate it to `ReconciliationAlreadyRunningError`, or use an INSERT ... ON CONFLICT DO NOTHING approach and check the return.

---

## Significant Non-Blocking Issues

### 3. `dryRun` creates DB side effects via `TitleMatchingService`

The plan specifies: _"In dryRun mode: run all queries but wrap everything in a transaction that is rolled back."_

The implementation uses conditional `if (!dryRun)` guards instead of a rolled-back transaction. This means `titleMatchingService.matchBatch()` — called unconditionally — writes to `title_match_results` and creates canonical `movies`/`series` skeleton rows (via `_resolveCanonicalMovie`/`_resolveCanonicalSeries`) even in dryRun mode.

After a dryRun:
- Canonical skeleton rows exist with `matchStatus='MATCHED'` but no availabilities
- Original PENDING rows still exist with their availabilities
- The state is recoverable (the next real run will merge them correctly), but differs from what an operator expects from a "read-only preview"

The plan's rolled-back transaction approach would have prevented this. If changing to a true rolled-back transaction is impractical (concerns about long-held locks), add documentation to the `dryRun` option that explicitly calls out the TitleMatchingService cache writes as a known side effect.

---

### 4. Dead code path at line 237

```typescript
// media-reconciliation-service.ts:237-241
if (matchedResults.length === 0) {
  // Mixed UNMATCHED + AMBIGUOUS already handled above; this path means some MATCHED, some UNMATCHED
  // Fall through: evaluate canonical below
}
```

At this point in the flow:
- `hasFailure` checked → skipped if true
- `hasAmbiguous` checked → skipped if true
- `allUnmatched` checked → skipped if true

The only remaining possibility is at least one MATCHED result, so `matchedResults.length > 0` is guaranteed here. The if-block is unreachable and its comment is incorrect. This is minor quality noise but adds confusion in an already-complex control flow.

---

## Minor Observations

**Input validation absent on admin body:** `batchSize: 0` would produce an infinite loop (LIMIT 0 returns all rows without pagination). Consider clamping batchSize to `max(1, batchSize)`.

**`media_credits`/`media_videos` merge may produce duplicates:** These tables have no unique constraints, so if a canonical was already enriched and the old media also has credits/videos (unlikely but possible), the UPDATE creates duplicate rows. Low risk in practice since unresolved media is typically unenriched.

---

## Correctness Spot-Checks

| Check | Result |
|---|---|
| `discovery_candidates.canonical_movie_id` — no unique constraint, UPDATE is safe | ✓ confirmed via migration 0018 |
| `explicit_feedback.media_type` uses `watchlist_media_type` enum | ✓ confirmed via migration 0016 |
| `follow_release.media_type` uses `watchlist_media_type` | ✓ confirmed via migration 0010 |
| `shelf_members.media_type` uses `shelf_media_type` — correct cast used | ✓ |
| `matchBatch` failure produces `id: ''` + `notes: 'match failed: provider error'` | ✓ confirmed in title-matching-service.ts:267-278 |
| `release_events` migration uses UPDATE (preserving FK for media_arrivals) | ✓ correct improvement over plan's INSERT approach |
| `profile_taste` array replacement via `array_replace` | ✓ correct for text[] columns |
| Cursor persisted after each batch before advancing | ✓ |
| Ambiguous results leave `matchStatus` unchanged | ✓ |

---

## Summary

The implementation is architecturally sound with correct transactional safety, comprehensive user-state migration, and good rate-limit discipline. Two fixes are required:

1. **Test 11** must test actual cursor resumption from a mid-run interrupted state (the code supports it; the test doesn't exercise it).
2. **`startRun` race condition** must be handled so concurrent callers receive 409, not 500.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T061/reviews/implementation-review.md
- generated at: 2026-08-13T10:29:02Z

---

I have enough information to write the review. Let me compile it now.

---

# PR Review — T061: Backfill and reconcile already-synced media without TMDB identities

## Overview

The implementation adds a `MediaReconciliationService`, an HTTP admin endpoint pair, a `reconciliation_runs` table/migration, and 11 integration tests. The core backfill logic — cursor pagination, transactional merge, user-state migration, rate-limit respect — is well-executed. Several issues require fixes before approval.

---

## Scope compliance

**Included / correct:**
- Reuses `TitleMatchingService` from T060 without modification ✓
- Processes MOVIE and SERIES independently ✓
- Preserves all user-state tables: watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release, profile_taste, media_arrivals, release_events ✓
- Leaves ambiguous/unmatched records intact ✓
- Admin endpoints protected by existing auth middleware ✓
- Rate limiting delegated to `MATCH_CONCURRENCY` / `MATCH_THROTTLE_MS` ✓
- Idempotency via ON CONFLICT DO NOTHING pattern ✓

**No scope drift detected.**

---

## Blocking Issues

### 1. Test 11 does not test cursor resumability from an interrupted run

**Plan acceptance criterion 8:** _"Interrupting the backfill and restarting resumes from the last committed cursor position; records from committed batches are not re-processed."_

Test 11 (`cursor resumability — records from committed batches are not re-processed`) does not test this. What it actually does:

1. Runs full `reconcile()` on 3 movies → all become UNMATCHED
2. Deletes the run row (`await db.delete(reconciliationRuns)`)
3. Runs `reconcile()` again → all 3 re-processed

This tests re-eligibility of UNMATCHED records (already covered by test 9's idempotency pass), not cursor-based resumption. A true cursor resumption test would:
1. Start a run with `startRun()`
2. Manually advance the cursor to simulate a partially completed interrupted run (update `cursorMovieId` to the second movie's ID)
3. Call `executeRun(runId)` directly on the still-RUNNING row
4. Assert only the third movie (after the cursor) was processed

The code correctly reads `cursorMovieId`/`cursorSeriesId` from the DB at the start of each `_processType` call, so the implementation is sound — but the test does not exercise that path. The plan explicitly required this scenario.

**Fix required:** Replace or supplement test 11 with a test that:
- Creates a RUNNING row with `cursorMovieId` set to a mid-batch ID
- Calls `executeRun(runId)` directly
- Asserts that only records with `id > cursorMovieId` are processed

---

### 2. `startRun` race condition — concurrent POST returns 500 instead of 409

```typescript
// apps/api/src/services/media-reconciliation-service.ts:55-67
const [existing] = await db.select(...).from(reconciliationRuns).where(eq(..., 'RUNNING'))
if (existing) throw new ReconciliationAlreadyRunningError(existing.id)
const [run] = await db.insert(reconciliationRuns).values({ status: 'RUNNING', ... }).returning(...)
```

Two simultaneous POST `/admin/reconcile` requests can both pass the SELECT check before either INSERT lands. The partial unique index on `status = 'RUNNING'` correctly rejects the second INSERT with a PostgreSQL constraint violation. However, that constraint error is not a `ReconciliationAlreadyRunningError`, so the route handler's catch block does not intercept it:

```typescript
// apps/api/src/routes/reconcile.ts:23-29
} catch (err) {
  if (err instanceof ReconciliationAlreadyRunningError) {
    return reply.status(409).send({ error: err.message })
  }
  throw err  // constraint error propagates as 500
}
```

Data integrity is preserved by the index. The bug is a wrong HTTP status to the caller.

**Fix required:** Catch the DB unique constraint error in `startRun` and translate it to `ReconciliationAlreadyRunningError`, or use an INSERT ... ON CONFLICT DO NOTHING approach and check the return.

---

## Significant Non-Blocking Issues

### 3. `dryRun` creates DB side effects via `TitleMatchingService`

The plan specifies: _"In dryRun mode: run all queries but wrap everything in a transaction that is rolled back."_

The implementation uses conditional `if (!dryRun)` guards instead of a rolled-back transaction. This means `titleMatchingService.matchBatch()` — called unconditionally — writes to `title_match_results` and creates canonical `movies`/`series` skeleton rows (via `_resolveCanonicalMovie`/`_resolveCanonicalSeries`) even in dryRun mode.

After a dryRun:
- Canonical skeleton rows exist with `matchStatus='MATCHED'` but no availabilities
- Original PENDING rows still exist with their availabilities
- The state is recoverable (the next real run will merge them correctly), but differs from what an operator expects from a "read-only preview"

The plan's rolled-back transaction approach would have prevented this. If changing to a true rolled-back transaction is impractical (concerns about long-held locks), add documentation to the `dryRun` option that explicitly calls out the TitleMatchingService cache writes as a known side effect.

---

### 4. Dead code path at line 237

```typescript
// media-reconciliation-service.ts:237-241
if (matchedResults.length === 0) {
  // Mixed UNMATCHED + AMBIGUOUS already handled above; this path means some MATCHED, some UNMATCHED
  // Fall through: evaluate canonical below
}
```

At this point in the flow:
- `hasFailure` checked → skipped if true
- `hasAmbiguous` checked → skipped if true
- `allUnmatched` checked → skipped if true

The only remaining possibility is at least one MATCHED result, so `matchedResults.length > 0` is guaranteed here. The if-block is unreachable and its comment is incorrect. This is minor quality noise but adds confusion in an already-complex control flow.

---

## Minor Observations

**Input validation absent on admin body:** `batchSize: 0` would produce an infinite loop (LIMIT 0 returns all rows without pagination). Consider clamping batchSize to `max(1, batchSize)`.

**`media_credits`/`media_videos` merge may produce duplicates:** These tables have no unique constraints, so if a canonical was already enriched and the old media also has credits/videos (unlikely but possible), the UPDATE creates duplicate rows. Low risk in practice since unresolved media is typically unenriched.

---

## Correctness Spot-Checks

| Check | Result |
|---|---|
| `discovery_candidates.canonical_movie_id` — no unique constraint, UPDATE is safe | ✓ confirmed via migration 0018 |
| `explicit_feedback.media_type` uses `watchlist_media_type` enum | ✓ confirmed via migration 0016 |
| `follow_release.media_type` uses `watchlist_media_type` | ✓ confirmed via migration 0010 |
| `shelf_members.media_type` uses `shelf_media_type` — correct cast used | ✓ |
| `matchBatch` failure produces `id: ''` + `notes: 'match failed: provider error'` | ✓ confirmed in title-matching-service.ts:267-278 |
| `release_events` migration uses UPDATE (preserving FK for media_arrivals) | ✓ correct improvement over plan's INSERT approach |
| `profile_taste` array replacement via `array_replace` | ✓ correct for text[] columns |
| Cursor persisted after each batch before advancing | ✓ |
| Ambiguous results leave `matchStatus` unchanged | ✓ |

---

## Summary

The implementation is architecturally sound with correct transactional safety, comprehensive user-state migration, and good rate-limit discipline. Two fixes are required:

1. **Test 11** must test actual cursor resumption from a mid-run interrupted state (the code supports it; the test doesn't exercise it).
2. **`startRun` race condition** must be handled so concurrent callers receive 409, not 500.

IMPLEMENTATION_FIX_REQUIRED