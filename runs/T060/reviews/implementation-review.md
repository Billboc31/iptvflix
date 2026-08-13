I now have a complete picture of the implementation. Let me write the structured review.

---

## PR Review — T060: Resolve missing TMDB IDs during source sync and build canonical media identity

### Summary

The implementation covers the full canonical-resolution flow end-to-end: schema with `matchStatus`, `TitleMatchingService` skeleton creation, a bounded-concurrency pre-pass in `CatalogSyncService`, idempotent convergence of multiple provider variants onto one canonical Media, resilient TMDB-failure handling, and instrumented sync-run counters. All 15 acceptance criteria from the ticket are addressed.

---

### 1. Schema & Migration

**`movies.ts` / `series.ts`** — `matchStatusEnum('PENDING','MATCHED','UNMATCHED')`, column default `'PENDING'`, shared cross-schema import. ✓

**Migration `0024_fuzzy_starbolt.sql`** — adds enum + columns + backfills existing rows with `UPDATE SET match_status = 'MATCHED' WHERE tmdb_id IS NOT NULL`. ✓

**`sync_runs`** — `title_matched_count` / `title_unmatched_count` added and persisted via `persistSyncRunProgress`. ✓

---

### 2. `TitleMatchingService`

**`resolveMovieId` / `resolveSeriesId`** — correctly insert canonical skeleton on TMDB miss (`onConflictDoNothing` + re-query guards concurrent inserts). `matchStatus = 'MATCHED'` ensures enrichment job picks up the skeleton. ✓

**`matchBatch` bounded concurrency** — sliding-window worker pool, per-item try/catch produces synthetic `UNMATCHED` result on TMDB failure without aborting the batch. Default `concurrency=1` preserves test isolation. ✓

**Guard (Step 1 of `matchItem`)** — confirmed: an already-MATCHED row returns the cached result without a TMDB call. Upgrade-only upsert (`WHERE ne(matchState, 'MATCHED')`) prevents MATCHED→UNMATCHED regression. ✓

---

### 3. `CatalogSyncService` — Pre-pass and main loop

**Pre-pass filter** (`!movieAvByProviderItemId.has(m.providerItemId) && !parseTmdbId(m.tmdb)`) correctly scopes to new items without a TMDB ID. ✓

**Guard against re-matching** — existing MATCHED rows from `titleMatchResults` are pre-loaded and excluded from the batch. ✓

**Resilience** — `.catch()` on `runTitleMatchPrePass` returns an empty map; affected items fall through to inline UNMATCHED creation. Sync never aborts for TMDB issues. ✓

**Convergence** — multiple provider items resolving to the same canonical ID in the prePassMap all attach their `Availability` to the same canonical `Movie`/`Series` row. ✓

**Idempotency** — on re-sync, items with existing availability rows are routed to the update path and never enter the pre-pass. No duplicate Media or Availability rows. ✓

**Backward compatibility** — `matchingService` is optional; absent callers (Plex, M3U, Xtream without matching) use the inline UNMATCHED path unchanged. ✓

---

### 4. Observations (non-blocking)

#### O1 — Dead code: `resolveMovieId` / `resolveSeriesId` `tmdbId == null` branch in catalog-sync-service.ts

`resolveMovieId` is only called at line 606 when `tmdbId != null`. The `tmdbId == null` branch (lines 233–244) and its counterpart in `resolveSeriesId` (lines 303–309) are unreachable — inline UNMATCHED creation was moved to the main chunk loop. The dead code is harmless but adds noise and a subtle false impression that the function handles both paths.

**Suggestion:** Remove the `tmdbId == null` branch from both helper functions or add an `unreachable` guard comment. Not blocking.

#### O2 — Input deduplication not implemented (only output deduplication)

The plan states:
> 4. Deduplicate inputs by (normalizedTitle, extractedYear) — within a single sync run, two provider items normalizing to the same title+year share the first item's match result.

The `dedupeMap` is built _after_ `matchBatch` returns, so two items with the same normalized title+year both submit separate TMDB search calls. The result is post-hoc deduplicated: if item[0] MATCHed, item[1] with the same key inherits its canonical ID. Correct but potentially wasteful on large catalogs (e.g., 50 "Dune" variants would each make a TMDB search call instead of one).

The AC "bounded strategy for TMDB calls" is satisfied by the concurrency/throttle mechanism. Input-level deduplication is a further optimization stated in the plan but not in the acceptance criteria.

**Suggestion:** Before building `inputs`, collapse `pendingItems` to a `Map<dedupeKey, pendingItem>` → extract the canonical item per key → run `matchBatch` on those only → fan the result back to all items with the same key. Not blocking.

#### O3 — UNMATCHED skeletons use raw provider title, not normalizedTitle

The plan says:
> When `tmdbId == null`, `title = item.title` (already the normalizedTitle from snapshot normalization)

But the Xtream mapping sets `item.title = s.name` (raw title). Inline UNMATCHED skeletons (lines 617, 729) therefore store the dirty provider title (e.g., `"4K-FR - Dune (2021)"`) as `movies.title`. The normalized title exists in `titleMatchResults.normalizedTitle` but not in `movies.title`.

This does not violate any acceptance criterion directly — the canonical title AC applies only "once a canonical/enriched identity exists," and UNMATCHED items have no canonical identity. But it deviates from the plan and means UNMATCHED items display with dirty titles in the UI until retry.

**Suggestion:** Use `normalizeTitle(item.rawTitle ?? item.title).normalizedTitle` for UNMATCHED skeleton title. Not blocking.

#### O4 — UNMATCHED inline skeletons have no `titleMatchResults` diagnostic row

When the pre-pass for a given item throws (caught by `.catch()`), the item gets no `titleMatchResults` row. There is no diagnostic trail to understand why it went UNMATCHED (network error vs. no candidate). Retry info that should be available for future reconciliation is absent for these items.

**Suggestion:** Persist a synthetic UNMATCHED `titleMatchResults` row in the inline catch path (matching what `matchBatch`'s error handler does when called directly). Not blocking.

---

### 5. Test coverage assessment

| Required scenario | Location | Status |
|---|---|---|
| Direct ID path regression | `catalog-sync-service.test.ts` | ✓ |
| Successful title match, canonical attached | pre-pass tests line 1397 | ✓ |
| Ambiguous → no false merge | pre-pass tests line 1490 | ✓ |
| Zero candidates → UNMATCHED playable | pre-pass tests line 1535 | ✓ |
| TMDB failure during pre-pass | pre-pass tests line 1567 | ✓ |
| Multi-variant convergence | pre-pass tests line 1442 | ✓ |
| Idempotency with matching service | pre-pass tests line 1604 | ✓ |
| matchStatus MATCHED vs UNMATCHED | pre-pass tests line 1640 | ✓ |
| Series title matching | pre-pass tests line 1674 | ✓ |
| Backward compat (no matching service) | pre-pass tests line 1712 | ✓ |
| Year discrimination | `title-matching-service.test.ts` line 414 | ✓ (unit) |
| Movie-vs-Series type safety | `title-matching-service.test.ts` line 197 | ✓ (unit) |
| Guard: no re-TMDB-call for MATCHED | `title-matching-service.test.ts` line 367 | ✓ |
| `matchBatch` bounded concurrency | `title-matching-service.test.ts` line 342 | ✓ |
| Per-item batch failure resilience | `title-matching-service.test.ts` line 389 | ✓ |
| `resolveMovieId`/`resolveSeriesId` create skeletons | `title-matching-service.test.ts` line 297/318 | ✓ |

Test coverage is strong. Year discrimination and Movie/Series type safety are appropriately unit-tested at the service level rather than duplicated in integration tests.

---

### 6. Security / Safety

- No secrets logged. Notes field explicitly stores only normalized title, year info, confidence scores, and `state:` tag.
- `parseTmdbId` rejects values outside PostgreSQL `int4` range, preventing DB overflow.
- `onConflictDoNothing` + re-query pattern used throughout for concurrent-insert safety.
- Lock mechanism prevents concurrent syncs of the same source.

---

### Decision

The implementation correctly fulfills all acceptance criteria. The three observations above (dead code, input deduplication, UNMATCHED title) are plan deviations or quality improvements but none block correctness or violate a ticket AC. All tests pass.

IMPLEMENTATION_APPROVED
