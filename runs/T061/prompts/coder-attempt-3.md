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

Both changes look correct. Here's a summary of what was done:

---

**Fix 1 — `startRun` race condition (blocking issue #2)**

Added `isUniqueConstraintError` helper that checks for Postgres error code `'23505'`. The `INSERT` in `startRun` is now wrapped in a try/catch: if a concurrent request races past the initial `SELECT` and triggers the partial unique index, the constraint error is caught, translated to `ReconciliationAlreadyRunningError`, and the route returns 409 as expected.

**Fix 2 — Test 11 cursor resumability (blocking issue #1)**

Replaced the old test (which re-ran `reconcile()` twice and tested UNMATCHED re-eligibility — already covered by test 9) with a test that exercises the actual cursor code path:
1. Creates 3 movies with availabilities
2. Calls `startRun()` to get a live RUNNING row
3. Manually sets `cursorMovieId` to `sortedIds[1]` via `db.update` (simulating a mid-run crash after the first two movies committed)
4. Calls `executeRun(runId)` directly on that still-RUNNING row
5. Asserts `processedCount === 1` (only the movie with `id > sortedIds[1]` was fetched) and that the first two movies remain `PENDING` (untouched by this resume)

**Also cleaned up:**
- Dead code block at the `matchedResults.length === 0` check (unreachable — removed)
- `batchSize` clamped to `Math.max(1, ...)` to prevent the infinite-loop edge case with `batchSize: 0`

---

## Review

Now I have a complete picture. Let me write the review.

---

## Review — T061: Backfill and Reconcile Already-Synced Media Without TMDB Identities

### Summary

The implementation is structurally sound: the schema, cursor-based pagination, transactional merge, rate-limiting delegation, and the public HTTP API all align with the plan. Service logic is correctly scoped to ticket requirements. However, the test suite has a material gap — most of the user-state migration path is implemented but not covered — and two issues in the migration logic warrant verification before approval.

---

### Correctness relative to ticket requirements

#### ✅ Core backfill mechanics

- Cursor-based pagination (`id > cursorId ORDER BY id LIMIT batchSize`) is correct for UUID ordering and resumability.
- Partial unique index on `status = 'RUNNING'` correctly enforces single-execution invariant.
- `startRun()` handles the race condition between the SELECT guard and the INSERT via `isUniqueConstraintError()` catch — 409 returned instead of 500.
- `executeRun()` persists cursor and incremental counts after each batch, before advancing.
- Unresolved media remains PENDING/UNMATCHED and playable (never silently deleted).
- `matchStatus IN ('PENDING', 'UNMATCHED')` correctly excludes already-MATCHED rows.

#### ✅ Matching reuse

The service delegates entirely to `TitleMatchingService.matchBatch()` from T060. No second matching algorithm introduced.

#### ✅ Availability migration

Non-conflicting availabilities are moved via UPDATE with `NOT EXISTS` guard; conflicting ones (same provider/providerItemId on canonical) are deleted. Correct.

#### ✅ Basic user-state migration

Watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release all use INSERT ON CONFLICT DO NOTHING + DELETE pattern. Canonical row wins on conflict. Consistent with the plan.

#### ⚠️ release_events + media_arrivals — implemented correctly but NOT tested

The plan specified a simpler `INSERT ON CONFLICT DO NOTHING + DELETE` for `release_events`. The implementation correctly realized this won't work (INSERT would create new rows with new IDs, breaking `media_arrivals.release_event_id` FK references) and implemented a 4-step approach instead:

1. UPDATE non-conflicting `release_events` to `canonicalId` (preserving row IDs so FK from `media_arrivals` remains valid)
2. UPDATE `media_arrivals.media_id` to `canonicalId`
3. DELETE `media_arrivals` whose `release_event_id` still points to old events (those that conflicted)
4. DELETE remaining old `release_events`

This is the right approach, but the added complexity is entirely untested. Any regression in this path (wrong event_type list in the CASE, wrong FK chain order) would silently produce broken data.

#### ⚠️ `::watchlist_media_type` cast on `media_arrivals` — risk of runtime failure

`_migrateUserState`, line 549:
```typescript
WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
```

`media_arrivals.media_type` may not use the `watchlist_media_type` enum. If the schema defines a distinct `arrival_media_type` (or similar), this will throw at runtime during any SERIES merge. No test exercises the SERIES path of `_migrateUserState`, so this would not be caught in CI.

**Required action**: Verify the actual `media_arrivals.media_type` enum name against the schema and correct the cast if it differs.

#### ✅ `profile_taste` migration

`array_replace()` on text arrays is correct for this schema shape.

#### ⚠️ `media_credits`/`media_videos` potential duplicates

The implementation uses direct UPDATE (not INSERT ON CONFLICT DO NOTHING):
```sql
UPDATE media_credits SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = 'MOVIE'
```

If the canonical was already enriched (has credits/videos) and the old media also has credits/videos, the canonical accumulates duplicates after merge. The plan acknowledges unresolved media is typically unenriched, but this is a silent data quality risk for any edge case where it isn't.

---

### Scope compliance

No scope creep. The service correctly excludes:
- Episode-level reconciliation
- TitleMatchingService internals
- Frontend/UI changes
- Source delete/recreate flow

`mediaType` option correctly isolates MOVIE and SERIES processing paths.

---

### Code quality

- Service structure is clean, private methods are well-separated.
- No N+1 queries — `_fetchAvailabilities` bulk-fetches per page.
- `batchSize = Math.max(1, ...)` guard prevents infinite loop with zero input.
- `dryRun` uses conditional guards rather than the plan-specified rollback transaction. Side effects from `TitleMatchingService` (writes to `title_match_results`, canonical skeleton creation) still occur in dryRun mode. Operators running a preview run will see unexpected rows. This diverges from the plan spec:
  > "In `dryRun` mode: run all queries but wrap everything in a transaction that is rolled back"

- TMDB failure detection at line 228 is brittle:
  ```typescript
  const hasFailure = results.some((r) => r.id === '' && r.notes?.includes('provider error'))
  ```
  This string-sentinel coupling to `TitleMatchingService`'s internal error format means any change in that service's error signaling silently breaks failure handling here.

---

### Test coverage

| Scenario | Status |
|---|---|
| Single movie match | ✅ Test 1 |
| Series type isolation | ✅ Test 2 |
| Multi-row merge + availability preservation | ✅ Test 3 |
| Watchlist migration | ✅ Test 4 |
| Viewing progress conflict | ✅ Test 5 |
| Ambiguous match | ✅ Test 6 |
| No availabilities (skipped) | ✅ Test 7 |
| Already MATCHED excluded | ✅ Test 8 |
| Idempotency | ✅ Test 9 |
| TMDB failure mid-batch | ✅ Test 10 |
| Cursor resumability | ✅ Test 11 |
| **explicit_feedback migration** | ❌ Not tested |
| **shelf_members migration** | ❌ Not tested |
| **follow_release migration** | ❌ Not tested |
| **release_events migration** | ❌ Not tested |
| **media_arrivals migration** | ❌ Not tested |

The ticket acceptance criteria states: *"Automated tests cover existing-data matching, multi-row merge, Availability preservation, user-state migration, ambiguous match, retry/idempotency and interrupted/failed reconciliation."*

"User-state migration" is explicitly listed. The test suite covers only 2 of 7 user-state tables. `release_events`/`media_arrivals` — the most complex migration path — has zero coverage.

---

### Blocking issues

**1. Missing user-state migration tests** (blocker)

`explicit_feedback`, `shelf_members`, `follow_release`, `release_events`, and `media_arrivals` are all migrated in `_migrateUserState` but none are tested. The ticket acceptance criteria explicitly calls for user-state migration tests. Tests for at least `explicit_feedback` (simple path) and `release_events`/`media_arrivals` (complex FK chain) are required.

**2. `::watchlist_media_type` cast on `media_arrivals`** (blocker if wrong)

Must verify the actual enum type used for `media_arrivals.media_type`. If it's anything other than `watchlist_media_type`, SERIES merges will throw a Postgres type error at runtime with no test catching it.

---

### Non-blocking observations

**3. `dryRun` side effects** — `TitleMatchingService` still writes to DB in dryRun mode. Document this limitation explicitly in the route body schema or JSDoc, or flag it as a known deviation from plan.

**4. TMDB failure detection string sentinel** — Consider exposing a typed `failed: boolean` field on match results rather than `r.notes?.includes('provider error')`.

**5. `media_credits`/`media_videos` duplicates** — Low risk in practice but worth noting. If this ever triggers for an already-enriched canonical, duplicates would require manual cleanup.

**6. Silent endpoint suppression without TMDB_API_KEY** — `POST /admin/reconcile` returns 404 when key is absent. A 503 with a clear message would be more operator-friendly.

---

### Required before approval

1. Add tests for at minimum: `explicit_feedback` migration, and the `release_events` + `media_arrivals` FK chain (simulate a SERIES or MOVIE merge where both old and canonical have release events with conflicting and non-conflicting entries).
2. Verify the `media_arrivals.media_type` enum name against the current schema and correct the cast at line 549 if needed.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T061/reviews/implementation-review.md
- generated at: 2026-08-13T10:38:57Z

---

Now I have a complete picture. Let me write the review.

---

## Review — T061: Backfill and Reconcile Already-Synced Media Without TMDB Identities

### Summary

The implementation is structurally sound: the schema, cursor-based pagination, transactional merge, rate-limiting delegation, and the public HTTP API all align with the plan. Service logic is correctly scoped to ticket requirements. However, the test suite has a material gap — most of the user-state migration path is implemented but not covered — and two issues in the migration logic warrant verification before approval.

---

### Correctness relative to ticket requirements

#### ✅ Core backfill mechanics

- Cursor-based pagination (`id > cursorId ORDER BY id LIMIT batchSize`) is correct for UUID ordering and resumability.
- Partial unique index on `status = 'RUNNING'` correctly enforces single-execution invariant.
- `startRun()` handles the race condition between the SELECT guard and the INSERT via `isUniqueConstraintError()` catch — 409 returned instead of 500.
- `executeRun()` persists cursor and incremental counts after each batch, before advancing.
- Unresolved media remains PENDING/UNMATCHED and playable (never silently deleted).
- `matchStatus IN ('PENDING', 'UNMATCHED')` correctly excludes already-MATCHED rows.

#### ✅ Matching reuse

The service delegates entirely to `TitleMatchingService.matchBatch()` from T060. No second matching algorithm introduced.

#### ✅ Availability migration

Non-conflicting availabilities are moved via UPDATE with `NOT EXISTS` guard; conflicting ones (same provider/providerItemId on canonical) are deleted. Correct.

#### ✅ Basic user-state migration

Watchlist, viewing_progress, explicit_feedback, shelf_members, follow_release all use INSERT ON CONFLICT DO NOTHING + DELETE pattern. Canonical row wins on conflict. Consistent with the plan.

#### ⚠️ release_events + media_arrivals — implemented correctly but NOT tested

The plan specified a simpler `INSERT ON CONFLICT DO NOTHING + DELETE` for `release_events`. The implementation correctly realized this won't work (INSERT would create new rows with new IDs, breaking `media_arrivals.release_event_id` FK references) and implemented a 4-step approach instead:

1. UPDATE non-conflicting `release_events` to `canonicalId` (preserving row IDs so FK from `media_arrivals` remains valid)
2. UPDATE `media_arrivals.media_id` to `canonicalId`
3. DELETE `media_arrivals` whose `release_event_id` still points to old events (those that conflicted)
4. DELETE remaining old `release_events`

This is the right approach, but the added complexity is entirely untested. Any regression in this path (wrong event_type list in the CASE, wrong FK chain order) would silently produce broken data.

#### ⚠️ `::watchlist_media_type` cast on `media_arrivals` — risk of runtime failure

`_migrateUserState`, line 549:
```typescript
WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
```

`media_arrivals.media_type` may not use the `watchlist_media_type` enum. If the schema defines a distinct `arrival_media_type` (or similar), this will throw at runtime during any SERIES merge. No test exercises the SERIES path of `_migrateUserState`, so this would not be caught in CI.

**Required action**: Verify the actual `media_arrivals.media_type` enum name against the schema and correct the cast if it differs.

#### ✅ `profile_taste` migration

`array_replace()` on text arrays is correct for this schema shape.

#### ⚠️ `media_credits`/`media_videos` potential duplicates

The implementation uses direct UPDATE (not INSERT ON CONFLICT DO NOTHING):
```sql
UPDATE media_credits SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = 'MOVIE'
```

If the canonical was already enriched (has credits/videos) and the old media also has credits/videos, the canonical accumulates duplicates after merge. The plan acknowledges unresolved media is typically unenriched, but this is a silent data quality risk for any edge case where it isn't.

---

### Scope compliance

No scope creep. The service correctly excludes:
- Episode-level reconciliation
- TitleMatchingService internals
- Frontend/UI changes
- Source delete/recreate flow

`mediaType` option correctly isolates MOVIE and SERIES processing paths.

---

### Code quality

- Service structure is clean, private methods are well-separated.
- No N+1 queries — `_fetchAvailabilities` bulk-fetches per page.
- `batchSize = Math.max(1, ...)` guard prevents infinite loop with zero input.
- `dryRun` uses conditional guards rather than the plan-specified rollback transaction. Side effects from `TitleMatchingService` (writes to `title_match_results`, canonical skeleton creation) still occur in dryRun mode. Operators running a preview run will see unexpected rows. This diverges from the plan spec:
  > "In `dryRun` mode: run all queries but wrap everything in a transaction that is rolled back"

- TMDB failure detection at line 228 is brittle:
  ```typescript
  const hasFailure = results.some((r) => r.id === '' && r.notes?.includes('provider error'))
  ```
  This string-sentinel coupling to `TitleMatchingService`'s internal error format means any change in that service's error signaling silently breaks failure handling here.

---

### Test coverage

| Scenario | Status |
|---|---|
| Single movie match | ✅ Test 1 |
| Series type isolation | ✅ Test 2 |
| Multi-row merge + availability preservation | ✅ Test 3 |
| Watchlist migration | ✅ Test 4 |
| Viewing progress conflict | ✅ Test 5 |
| Ambiguous match | ✅ Test 6 |
| No availabilities (skipped) | ✅ Test 7 |
| Already MATCHED excluded | ✅ Test 8 |
| Idempotency | ✅ Test 9 |
| TMDB failure mid-batch | ✅ Test 10 |
| Cursor resumability | ✅ Test 11 |
| **explicit_feedback migration** | ❌ Not tested |
| **shelf_members migration** | ❌ Not tested |
| **follow_release migration** | ❌ Not tested |
| **release_events migration** | ❌ Not tested |
| **media_arrivals migration** | ❌ Not tested |

The ticket acceptance criteria states: *"Automated tests cover existing-data matching, multi-row merge, Availability preservation, user-state migration, ambiguous match, retry/idempotency and interrupted/failed reconciliation."*

"User-state migration" is explicitly listed. The test suite covers only 2 of 7 user-state tables. `release_events`/`media_arrivals` — the most complex migration path — has zero coverage.

---

### Blocking issues

**1. Missing user-state migration tests** (blocker)

`explicit_feedback`, `shelf_members`, `follow_release`, `release_events`, and `media_arrivals` are all migrated in `_migrateUserState` but none are tested. The ticket acceptance criteria explicitly calls for user-state migration tests. Tests for at least `explicit_feedback` (simple path) and `release_events`/`media_arrivals` (complex FK chain) are required.

**2. `::watchlist_media_type` cast on `media_arrivals`** (blocker if wrong)

Must verify the actual enum type used for `media_arrivals.media_type`. If it's anything other than `watchlist_media_type`, SERIES merges will throw a Postgres type error at runtime with no test catching it.

---

### Non-blocking observations

**3. `dryRun` side effects** — `TitleMatchingService` still writes to DB in dryRun mode. Document this limitation explicitly in the route body schema or JSDoc, or flag it as a known deviation from plan.

**4. TMDB failure detection string sentinel** — Consider exposing a typed `failed: boolean` field on match results rather than `r.notes?.includes('provider error')`.

**5. `media_credits`/`media_videos` duplicates** — Low risk in practice but worth noting. If this ever triggers for an already-enriched canonical, duplicates would require manual cleanup.

**6. Silent endpoint suppression without TMDB_API_KEY** — `POST /admin/reconcile` returns 404 when key is absent. A 503 with a clear message would be more operator-friendly.

---

### Required before approval

1. Add tests for at minimum: `explicit_feedback` migration, and the `release_events` + `media_arrivals` FK chain (simulate a SERIES or MOVIE merge where both old and canonical have release events with conflicting and non-conflicting entries).
2. Verify the `media_arrivals.media_type` enum name against the current schema and correct the cast at line 549 if needed.

IMPLEMENTATION_FIX_REQUIRED