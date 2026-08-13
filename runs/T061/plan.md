## Objective

Run a safe, resumable one-time backfill that reprocesses existing Movie and Series records that lack a usable TMDB identity — reusing T060's `TitleMatchingService` — merges duplicate rows that resolve to the same canonical artwork, migrates every user-state reference to the canonical ID, and leaves ambiguous or unmatched records intact and playable.

## Included

### 1. New DB table: `reconciliation_runs` + migration

New Drizzle schema file: `apps/api/src/db/schema/reconciliation-runs.ts`

Fields:
- `id` UUID PK
- `status` enum `RECONCILIATION_STATUS` (`RUNNING` | `COMPLETED` | `FAILED`)
- `mediaType` text (`MOVIE` | `SERIES` | `BOTH`)
- `cursorMovieId` UUID nullable — last fully processed movie `id` (pagination cursor)
- `cursorSeriesId` UUID nullable — last fully processed series `id`
- `processedCount`, `matchedCount`, `mergedCount`, `ambiguousCount`, `unmatchedCount`, `skippedCount`, `failedCount` integer defaults 0
- `startedAt` timestamp, `completedAt` timestamp nullable, `errorMessage` text nullable
- Partial unique index: only one row with `status = 'RUNNING'` allowed

New SQL migration: `apps/api/migrations/0025_reconciliation_runs.sql`
Update barrel export: `apps/api/src/db/schema/index.ts`

---

### 2. New service: `MediaReconciliationService`

File: `apps/api/src/services/media-reconciliation-service.ts`

**Constructor** `(db, titleMatchingService: TitleMatchingService)`

**Public method `reconcile(opts?)`**
`opts`: `{ batchSize?: number, concurrency?: number, mediaType?: 'MOVIE' | 'SERIES' | 'BOTH', dryRun?: boolean }`

Defaults: `batchSize=50`, `concurrency=MATCH_CONCURRENCY env (default 5)`, `mediaType='BOTH'`.

Execution flow:
1. Reject with 409 if a `RUNNING` row already exists in `reconciliation_runs`.
2. Insert `RUNNING` row, capture `runId`.
3. For each applicable type (MOVIE, SERIES), run a cursor loop:
   - Query: `WHERE matchStatus IN ('PENDING', 'UNMATCHED') AND id > cursorId ORDER BY id LIMIT batchSize`
   - Bulk-fetch all `movie_availabilities` / `series_availabilities` for the current page (one query for the batch, not N+1).
   - For each media record:
     - If no availabilities: increment `skippedCount`, advance cursor.
     - Otherwise, for each availability call `titleMatchingService.matchItem({ providerId, providerItemId, rawTitle, mediaType, providerYear })`. The service reads from `title_match_results` cache first; only calls TMDB if the entry is missing or not MATCHED.
     - Collect canonical IDs from all MATCHED results for this media record.
     - If all MATCHED results agree on the same canonical ID → call `_reconcileMedia(oldId, canonicalId, type)`.
     - If any result is AMBIGUOUS or results disagree on canonical ID → leave record unchanged, increment `ambiguousCount`.
     - If all results are UNMATCHED → set `matchStatus = 'UNMATCHED'` on the media row, increment `unmatchedCount`.
   - After each batch commits successfully: `UPDATE reconciliation_runs SET cursorMovieId/cursorSeriesId = :lastId, processedCount += n, ... WHERE id = :runId`.
4. Mark `status = 'COMPLETED'` on success; `status = 'FAILED'` + `errorMessage` on uncaught error.
5. In `dryRun` mode: run all queries but wrap everything in a transaction that is rolled back; return counts without DB mutation.

**Private method `_reconcileMedia(oldMediaId, canonicalId, type, db)` — transactional**

If `oldMediaId === canonicalId`: `UPDATE movies/series SET match_status = 'MATCHED' WHERE id = :id`; return (no merge needed).

Otherwise, wrap everything in `db.transaction()`:

*Availability migration:*
- `UPDATE movie_availabilities SET movie_id = :canonicalId WHERE movie_id = :oldId AND NOT EXISTS (SELECT 1 FROM movie_availabilities WHERE provider_id = excluded.provider_id AND provider_item_id = excluded.provider_item_id AND movie_id = :canonicalId)`
- `DELETE FROM movie_availabilities WHERE movie_id = :oldId` (removes any leftovers that conflicted on the global `(providerId, providerItemId)` unique)
- Same for `series_availabilities`.

*Genre migration:*
- `INSERT INTO movie_genres (movie_id, genre_id) SELECT :canonicalId, genre_id FROM movie_genres WHERE movie_id = :oldId ON CONFLICT DO NOTHING`
- `DELETE FROM movie_genres WHERE movie_id = :oldId`

*Discovery candidates:*
- `UPDATE discovery_candidates SET canonical_movie_id = :canonicalId WHERE canonical_movie_id = :oldId`

*User-state tables (use `mediaType` + `mediaId` columns; all are FK-less on movies/series so no cascade risk):*

For each of `watchlist`, `explicit_feedback`, `shelf_members`, `follow_release`:
- `INSERT INTO <table> (..., media_id) SELECT ..., :canonicalId FROM <table> WHERE media_id = :oldId ON CONFLICT DO NOTHING`
- `DELETE FROM <table> WHERE media_id = :oldId`

For `viewing_progress` (conflict: keep canonical row if exists, else keep migrated):
- Same INSERT ON CONFLICT DO NOTHING + DELETE pattern (canonical's progress is preserved on conflict).

For `media_credits`, `media_videos` (no unique constraint per media):
- `UPDATE media_credits SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = :type`
- `UPDATE media_videos SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = :type`

For `release_events` (complex partial unique indexes):
- `INSERT INTO release_events (..., media_id) SELECT ..., :canonicalId FROM release_events WHERE media_id = :oldId ON CONFLICT DO NOTHING`
- `DELETE FROM release_events WHERE media_id = :oldId`

For `media_arrivals`:
- `UPDATE media_arrivals SET media_id = :canonicalId WHERE media_id = :oldId AND media_type = :type`

For `profile_taste` (text arrays):
- `UPDATE profile_taste SET positive_media_ids = array_replace(positive_media_ids, :oldId::text, :canonicalId::text), negative_media_ids = array_replace(negative_media_ids, :oldId::text, :canonicalId::text) WHERE :oldId::text = ANY(positive_media_ids) OR :oldId::text = ANY(negative_media_ids)`

For `title_match_results`:
- `UPDATE title_match_results SET movie_id = :canonicalId WHERE movie_id = :oldId` (or `series_id`)

*Delete old media row* (cascade deletes its now-empty `movie_availabilities`, `movie_genres` rows):
- `DELETE FROM movies WHERE id = :oldId`

*Mark canonical MATCHED:*
- `UPDATE movies SET match_status = 'MATCHED' WHERE id = :canonicalId`

Increment `matchedCount` (if `oldId === canonicalId`) or `mergedCount` (if different) after commit.

---

### 3. HTTP endpoints

File: add to `apps/api/src/index.ts` (or `apps/api/src/routes/admin.ts` if that module exists).

- `POST /admin/reconcile` — protected by existing auth middleware
  - Body (optional): `{ dryRun?: boolean, batchSize?: number, concurrency?: number, mediaType?: 'MOVIE' | 'SERIES' | 'BOTH' }`
  - Returns 409 if RUNNING run exists.
  - Fires `void reconciliationService.reconcile(opts)` in background (fire-and-forget, same pattern as enrichment trigger).
  - Returns 202 `{ runId, status: 'RUNNING' }`.

- `GET /admin/reconcile/:runId` — protected
  - Returns the full `reconciliation_runs` row for diagnostics.

Register `MediaReconciliationService` in `apps/api/src/index.ts` alongside existing service instantiations.

---

### 4. Tests

File: `apps/api/src/__tests__/media-reconciliation-service.test.ts`

Scenarios:
1. **Single movie match** — PENDING movie, one availability, confident TMDB hit → `matchStatus = 'MATCHED'`, canonical `tmdbId` set.
2. **Series type isolation** — PENDING series matched → `seriesId` resolved; no movies touched.
3. **Multi-row merge** — two PENDING movies both resolve to same canonical tmdbId → one remaining card; both original availabilities on canonical; `mergedCount = 1` (one old row removed).
4. **Watchlist migration** — watchlist entry on old media ID → points to canonical after merge.
5. **Viewing progress conflict** — user has progress on both old and canonical → canonical's row survives; no duplicate.
6. **Ambiguous match** — two TMDB candidates with scores too close → record unchanged, `ambiguousCount` incremented.
7. **No availabilities** — media with no availability rows → skipped, `skippedCount` incremented, no error.
8. **Already MATCHED** — media with `matchStatus = 'MATCHED'` → not queried, no TMDB call.
9. **Idempotency** — re-run on fully reconciled catalog → all increment counters zero, no duplicate rows.
10. **TMDB failure mid-batch** — one `matchItem` call throws → that record's reconciliation fails, `failedCount` incremented, rest of batch continues.
11. **Cursor resumability** — simulate interruption after first batch commits; re-run → cursor starts after last committed ID; already-processed records not re-processed.

---

### 5. Type definitions (co-located in service file)

`ReconcileOptions`, `ReconcileResult`, `ReconciliationRun` interfaces in `apps/api/src/services/media-reconciliation-service.ts`.

## Excluded

- Changing `TitleMatchingService`, `candidateScorer`, or `titleNormalizer` internals — T060 algorithm is reused as-is.
- Bulk-importing TMDB's full catalog.
- Episode-level reconciliation (`episodeAvailabilities`).
- Recommendation and shelf generation logic.
- Browser playback compatibility.
- Source delete/recreate flow.
- Any frontend or UI changes.
- Any change to the live sync pipeline behavior introduced by T060.

## Acceptance criteria

1. `POST /admin/reconcile` returns HTTP 202; `GET /admin/reconcile/:runId` returns a row with distinct counts for `matched`, `merged`, `ambiguous`, `unmatched`, `skipped`, `failed`.
2. A Movie with `matchStatus = 'PENDING'`, no `tmdbId`, and a confident TMDB title match has `matchStatus = 'MATCHED'` and a non-null canonical `tmdbId` after the backfill.
3. Series reconciliation is independent: a Series match sets `seriesId`, never `movieId`; no Movie rows are mutated during Series processing.
4. Two PENDING Movie rows resolving to the same TMDB ID collapse to one card: the canonical row holds all original availability rows; `movies` contains no second row for that artwork after the run.
5. `rawTitle` values in `movie_availabilities` / `series_availabilities` are preserved after merge (the field is on the availability row, not the media row).
6. `watchlist`, `viewing_progress`, `explicit_feedback`, `shelf_members`, `follow_release`, `media_arrivals`, `profile_taste` entries referencing deleted old Media IDs reference the canonical ID after the backfill; no user-state row is silently dropped.
7. Re-running the backfill on a fully reconciled catalog produces `matched = 0`, `merged = 0`, `ambiguous = 0`, no errors, and no duplicate `movies`, `movie_availabilities`, or user-state rows.
8. Interrupting the backfill and restarting resumes from the last committed cursor position; records from committed batches are not re-processed.
9. All TMDB search calls during the backfill go through `TitleMatchingService.matchItem()` and respect `MATCH_CONCURRENCY` and `MATCH_THROTTLE_MS` bounds.
10. Media with ambiguous or failed match results retain their original `matchStatus` and remain present in catalog API responses; they are not deleted or hidden.
11. All 11 test scenarios pass without manual database cleanup between idempotency/resumability runs.
