## Objective

Connect the existing `TitleMatchingService` and TMDB title-search capabilities into the Xtream synchronization pipeline so that provider items without a usable TMDB ID are resolved against the canonical `Movie`/`Series` identity via confident title matching, preserving the `Media = what it is / Availability = where to watch it` invariant.

## Included

### 1. Schema — `matchStatus` column on movies and series

**`apps/api/src/db/schema/movies.ts`:**
- Add `pgEnum('match_status', ['PENDING', 'MATCHED', 'UNMATCHED'])`.
- Add `matchStatus` column: NOT NULL, default `'PENDING'`.

**`apps/api/src/db/schema/series.ts`:** same addition.

**New Drizzle migration:**
- `ALTER TABLE movies ADD COLUMN match_status match_status NOT NULL DEFAULT 'PENDING'`
- `UPDATE movies SET match_status = 'MATCHED' WHERE tmdb_id IS NOT NULL`
- Same for `series`.

This column enables efficient retry queries (`WHERE match_status = 'UNMATCHED'`) and exposes explicit enrichment state without joining `title_match_results`.

---

### 2. `TitleMatchingService` — fix `resolveMovieId` / `resolveSeriesId` to upsert on miss

**`apps/api/src/services/title-matching-service.ts`** — functions `resolveMovieId` and `resolveSeriesId` (lines 56–88):

Current behaviour: when the movie/series is not found by TMDB ID, return `null`, which downgrades `matchState` from `MATCHED` to `AMBIGUOUS`.

New behaviour: when not found by TMDB ID, **insert a canonical skeleton** and return its id:

```typescript
// title = candidate.title (TMDB canonical), year = candidate.year, tmdbId = int(candidate.externalId)
// matchStatus = 'MATCHED'
// onConflictDoNothing({ target: movies.tmdbId }) + re-query for concurrent-insert safety
```

- `resolveSeriesId`: same pattern, using `series` table.
- Hard constraint: a `MetadataCandidate` of type `MOVIE` may only resolve to the `movies` table, and `SERIES` only to `series`. The existing `mediaType` guard in `scoreCandidates` (candidate-scorer.ts) already excludes cross-type candidates before this point; no additional guard needed here.

---

### 3. `TitleMatchingService.matchBatch` — bounded concurrency and throttle

**`apps/api/src/services/title-matching-service.ts`** — `matchBatch` method (line 219+):

Add optional parameter: `opts?: { concurrency?: number; throttleMs?: number }`.

Implementation: sliding-window concurrency (default: 5 parallel TMDB search calls) with `throttleMs` (default: 250 ms) between individual calls. Existing callers pass no opts; sequential default behaviour is preserved for test isolation.

---

### 4. `CatalogSyncService` — title-matching pre-pass for items without TMDB ID

**`apps/api/src/services/catalog-sync-service.ts`:**

#### a) Pre-pass step (inserted before the main chunk loop in `syncCatalog`)

1. Partition movie items into `withTmdb` and `withoutTmdb` based on `parseTmdbId(item.tmdb)`.
2. Batch-query `titleMatchResults` for all `withoutTmdb` items by `(sourceId, providerItemId)` to find previously MATCHED items (guard: skip re-matching for these).
3. For the remaining unmatched candidates, build `MatchItemInput[]` with `rawTitle = item.rawTitle`, `mediaType = 'MOVIE'`, `providerYear` extracted from the normalized result.
4. Deduplicate inputs by `(normalizedTitle, extractedYear)` — within a single sync run, two provider items normalizing to the same title+year share the first item's match result.
5. Call `matchingService.matchBatch(deduplicatedInputs, { concurrency: MATCH_CONCURRENCY, throttleMs: MATCH_THROTTLE_MS })`. Both constants are read from `process.env` with defaults (5 and 250).
6. Build in-memory result map: `providerItemId → movieId | null` (MATCHED → resolved movieId, UNMATCHED/AMBIGUOUS → null).
7. Wrap each `matchItem` call in a try/catch: on TMDB network/rate error, mark the item UNMATCHED in the map (local skeleton), increment a `failedMatchCount`; do not abort the full sync.
8. Repeat identical pre-pass for series items.

#### b) Update `resolveMovieId()` local function (lines 175–236)

Accept the pre-pass result map as an additional parameter.

When `tmdbId == null`:
- Lookup `providerItemId` in map.
- If non-null movieId found → return it (multiple provider variants converge on one canonical movie).
- If null → insert local skeleton: `title = item.title` (already the normalizedTitle from snapshot normalization), `tmdbId = null`, `matchStatus = 'UNMATCHED'`.

When `tmdbId != null` (existing path): set `matchStatus = 'MATCHED'` on the inserted/found row.

#### c) Update `resolveSeriesId()` local function (lines 238+)

Same changes, operating on the `series` table and the series pre-pass map.

#### d) Idempotency of pre-pass

- The MATCHED guard in `TitleMatchingService.matchItem()` (step 1 of the method) exits immediately for already-MATCHED items, making no TMDB call and performing no DB write.
- The `onConflictDoNothing` + re-query pattern in `resolveMovieId`/`resolveSeriesId` (step 2 above) prevents duplicate canonical records on concurrent syncs.
- The `(movieId, providerId, providerItemId)` unique constraint on `movie_availabilities` prevents duplicate availability rows on repeated sync of unchanged data.

---

### 5. Canonical title ownership — no route changes needed

- `movies.title` is set to the TMDB canonical value by `MetadataEnrichmentService.enrichMovie()` which runs as a background job. Items created via the title-match path have `tmdbId` set, so `enrichPending()` picks them up on its next run.
- `movieAvailabilities.rawTitle` already stores the original dirty provider string (e.g., `"4K-FR - Dune (2021)"`). No change needed.
- Language, quality, and subtitle fields already live on Availability rows. No canonical Media contamination.
- UNMATCHED items: `movies.title = normalizedTitle` (e.g., `"dune"`). Acceptable transitional state — the item is visible and playable; full enrichment awaits a future successful match.

---

### 6. Tests

**`apps/api/src/services/title-matching-service.test.ts`** (extend or create):

- `resolveMovieId` creates a canonical skeleton when TMDB ID not found in DB.
- `resolveSeriesId` creates a canonical skeleton when TMDB ID not found in DB.
- `matchItem` returns MATCHED for a single high-confidence candidate (≥ 0.85).
- `matchItem` returns AMBIGUOUS when two candidates score within AMBIGUITY_GAP (< 0.15).
- `matchItem` returns UNMATCHED when no candidate exceeds CANDIDATE_THRESHOLD (0.50).
- Year discrimination: identical normalized title but year delta > 1 → does not produce MATCHED.
- Type safety: a MOVIE candidate is never used to resolve a series record.
- Guard: re-calling `matchItem` for an already-MATCHED providerItemId returns cached result without a new TMDB API call.
- `matchBatch` concurrency: mock verifies TMDB search is called with bounded concurrency (≤ N parallel) and not burst for the full input list.

**`apps/api/src/services/catalog-sync-service.test.ts`** (extend or create):

- Provider item with valid TMDB ID resolves via direct-ID path (regression test).
- Provider item without TMDB ID, confident match: one `movies` row with TMDB ID created; availability attached as variant.
- Multiple provider items confidently matching the same TMDB ID converge on one `movies` row with multiple `movie_availabilities` rows.
- Provider item without TMDB ID, ambiguous/low-confidence result: local UNMATCHED `movies` row created; no false merge with an existing canonical record.
- Provider item without TMDB ID, zero TMDB candidates: UNMATCHED local movie created, availability linked and playable.
- Different provider items with similar normalized titles but year delta > 1: not merged into one movie.
- Movie provider item does not converge with a series record (type separation).
- Re-sync with identical data: no duplicate `movies`, `series`, or `*_availabilities` rows created (idempotency).
- TMDB failure during pre-pass: affected items stored as UNMATCHED local movies; sync completes; no content lost.
- After sync and enrichment, `movies.title` reflects TMDB canonical title; `movie_availabilities.rawTitle` retains dirty provider string; language/quality remain on Availability.

---

### 7. Sync run instrumentation (lightweight)

**`apps/api/src/db/schema/sync-runs.ts`** and **`apps/api/src/services/catalog-sync-service.ts`:**

Add two integer counters to the `sync_runs` table and `CatalogSyncResult`:
- `titleMatchedCount` — items resolved to a canonical identity via title matching.
- `titleUnmatchedCount` — items left as UNMATCHED local Media after the pre-pass.

These counters make the matching rate inspectable from the sync-run API response.

## Excluded

- Manual administrator rematch/reconciliation UI.
- A background worker that merges pre-existing duplicate `Movie` records created before this ticket.
- Bulk TMDB catalogue import.
- Browser playback and codec compatibility.
- Recommendation engine and automatic shelves.
- Replacing TMDB as the metadata provider.
- Series episode-level title matching (episodes resolve through their parent series identity).
- Changes to the `enrichPending()` background scheduling mechanism (enrichment remains a separate job; this ticket only ensures title-matched items have a `tmdbId` so the existing job picks them up).

## Acceptance criteria

- An Xtream movie with a valid provider TMDB ID continues to resolve via the existing direct-ID path with no regression.
- An Xtream movie without a TMDB ID is normalized and evaluated by `TitleMatchingService.matchItem()` during normal synchronization before its availability is attached.
- An Xtream series without a TMDB ID uses the same canonical-resolution path while remaining type-safe from movies.
- A confident title match (confidence ≥ 0.85, gap ≥ 0.15) creates or reuses the canonical `movies`/`series` row keyed on the discovered TMDB ID, and attaches the provider stream as a `movie_availabilities`/`series_availabilities` row of that canonical record.
- Multiple provider entries confidently resolving to the same TMDB artwork converge on one `movies`/`series` row with multiple availability rows.
- AMBIGUOUS or low-confidence results do not cause automatic merges; provider items are stored as local UNMATCHED Media.
- UNMATCHED items have `matchStatus = 'UNMATCHED'`, remain visible and playable when their source availability is valid, and retain `normalizedTitle`, `extractedYear`, and `rawTitle` in `title_match_results` for future retry.
- After a confident title match and subsequent TMDB enrichment run, `movies.title` reflects the TMDB canonical title (e.g., `"Dune"`), not the dirty provider string (e.g., `"4K-FR - Dune (2021)"`).
- `movie_availabilities.rawTitle` preserves the original dirty provider string; `audioLanguage`, `subtitleLanguage`, and `videoQuality` remain on the Availability row.
- Re-running sync with unchanged provider data produces zero new `movies`, `series`, or `*_availabilities` rows (idempotency).
- The title-matching pre-pass uses bounded concurrency (≤ 5 parallel TMDB calls, configurable) and throttles between calls; TMDB is never burst with the full unresolved catalogue at once.
- A temporary TMDB failure during the pre-pass leaves affected items as UNMATCHED local Media with their availability; the sync completes and no provider content is lost.
- All test cases listed in the Tests section above pass.
