## Objective

Implement a `CatalogSyncService` that persists a `XtreamCatalogSnapshot` into the canonical `movies` and `series` tables, creates and maintains `movieAvailabilities` and `seriesAvailabilities` records tracking `firstSeenAt`/`lastSeenAt`/`AVAILABLE`/`UNAVAILABLE` state across repeated synchronizations, enforces concurrency safety via a `syncRuns` lock table, and exposes a structured result summary to the caller.

## Included

### Schema — `apps/api/src/db/schema/availabilities.ts`

- Define `pgEnum('availability_status', ['AVAILABLE', 'UNAVAILABLE'])`.
- Add `status availability_status NOT NULL DEFAULT 'AVAILABLE'` and `unavailableAt timestamp (nullable, withTimezone)` to `movieAvailabilities`.
- Add a second unique constraint `(providerId, providerItemId)` to `movieAvailabilities` alongside the existing `(movieId, providerId, providerItemId)` constraint. This enables lookup by provider identity alone during sync.
- Add new `seriesAvailabilities` table with the same columns as `movieAvailabilities` (substituting `seriesId uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE`), including both unique constraints.

### Schema — `apps/api/src/db/schema/sync-runs.ts` (new file)

- Define `pgEnum('sync_run_status', ['RUNNING', 'COMPLETED', 'FAILED'])`.
- Define `syncRuns` table: `id uuid PK`, `sourceId uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE`, `status sync_run_status NOT NULL`, `startedAt timestamp NOT NULL DEFAULT now()`, `completedAt timestamp (nullable)`, `moviesCreated integer NOT NULL DEFAULT 0`, `moviesUpdated integer NOT NULL DEFAULT 0`, `seriesCreated integer NOT NULL DEFAULT 0`, `seriesUpdated integer NOT NULL DEFAULT 0`, `unavailableCount integer NOT NULL DEFAULT 0`, `failedCount integer NOT NULL DEFAULT 0`, `errorMessage text (nullable)`.
- Add a unique partial index `(sourceId) WHERE status = 'RUNNING'` on `syncRuns` to prevent concurrent active sync runs for the same source.

### Schema re-export — `apps/api/src/db/schema/index.ts`

- Add `export * from './sync-runs.js'`.

### Migration

- Run `pnpm --filter api db:generate` to produce the SQL migration for all schema additions above.
- Run `pnpm --filter api db:migrate` to apply.

### Service — `apps/api/src/services/catalog-sync-service.ts` (new file)

Export `CatalogSyncService` (class or plain object) with one public method:

```typescript
syncCatalog(sourceId: string, snapshot: XtreamCatalogSnapshot): Promise<CatalogSyncResult>
```

Export the result type:

```typescript
interface CatalogSyncResult {
  runId: string
  status: 'completed' | 'failed'
  counts: {
    moviesCreated: number
    moviesUpdated: number
    seriesCreated: number
    seriesUpdated: number
    unavailableCount: number
    failedCount: number
  }
  error?: string
}
```

Export `SyncAlreadyRunningError extends Error`.

**Lock acquisition (outside the main transaction)**:

1. Check for an existing `RUNNING` `syncRuns` row for `sourceId` that is older than a configurable stale timeout (default 10 minutes). If found, update it to `FAILED` with `errorMessage = 'stale lock cleared'`.
2. Attempt to `INSERT INTO sync_runs (sourceId, status='RUNNING', startedAt=now())`. If this throws a unique constraint violation (PostgreSQL error code `23505` on the partial unique index), throw `SyncAlreadyRunningError`.
3. Store the new `runId` for later update.

**Main sync (single `db.transaction()` block)**:

Within the transaction, execute in order:

a. **Collect prior availability** for this source: `SELECT providerItemId FROM movie_availabilities WHERE provider_id = sourceId AND status = 'AVAILABLE'`. Store the set as `previouslyAvailableMovieIds`. Same for `seriesAvailabilities`.

b. **Sync VOD streams** — for each `XtreamVodStream` in `snapshot.vodStreams`:
   - Look up existing `movieAvailabilities` row by `(providerId=sourceId, providerItemId=stream_id.toString())`.
   - If not found: `INSERT INTO movies (title, posterPath, synopsis, year, tmdbId)` with values mapped from the stream (`tmdb` parsed as integer; use `null` if 0 or not a valid integer). Then `INSERT INTO movie_availabilities (movieId, providerId, providerItemId, firstSeenAt, lastSeenAt, status='AVAILABLE')` with `firstSeenAt = lastSeenAt = snapshot.fetchedAt`. Increment `moviesCreated`.
   - If found: `UPDATE movie_availabilities SET lastSeenAt = snapshot.fetchedAt, status = 'AVAILABLE', unavailableAt = null WHERE (providerId, providerItemId)`. Do **not** touch `firstSeenAt`. Increment `moviesUpdated`.
   - Add `stream_id.toString()` to a set `seenMovieProviderItemIds`.
   - On per-item error: increment `failedCount`, continue (do not abort the full sync).

c. **Sync series** — for each `XtreamSeries` in `snapshot.series`:
   - Same pattern as above against `seriesAvailabilities`, using `series_id.toString()` as `providerItemId`, mapping to `series` table fields (`title`, `posterPath=cover`, `synopsis=plot`, `firstAirYear` parsed from `releaseDate`).
   - Increment `seriesCreated` or `seriesUpdated`. Add `series_id.toString()` to `seenSeriesProviderItemIds`.

d. **Mark missing items**:
   - `UPDATE movie_availabilities SET status = 'UNAVAILABLE', unavailableAt = snapshot.fetchedAt WHERE providerId = sourceId AND status = 'AVAILABLE' AND providerItemId NOT IN (seenMovieProviderItemIds)`. Count rows affected, add to `unavailableCount`.
   - Same for `seriesAvailabilities`.

e. **No per-item transaction nesting** — all operations use the single outer transaction. If a fatal error aborts the transaction, the entire sync (including the lock row) rolls back automatically.

**Lock release (outside the main transaction, always runs)**:

- If the main transaction committed: `UPDATE sync_runs SET status='COMPLETED', completedAt=now(), moviesCreated=…, …`
- If the main transaction threw: `UPDATE sync_runs SET status='FAILED', completedAt=now(), errorMessage=error.message`

Return `CatalogSyncResult` in all cases.

### Tests — `apps/api/src/services/__tests__/catalog-sync-service.test.ts` (new file)

Integration tests (require real database) using Vitest. Test cases:

1. **First sync** — given empty DB: verify `movies` and `movieAvailabilities` rows are created; verify `series` and `seriesAvailabilities` rows are created; verify `firstSeenAt = lastSeenAt = snapshot.fetchedAt`; verify `status = AVAILABLE`; verify `syncRuns` ends as `COMPLETED`.
2. **Repeat sync** — run same snapshot twice: verify no duplicate rows; verify `firstSeenAt` unchanged; verify `lastSeenAt` updated to second snapshot's `fetchedAt`.
3. **Disappearance** — first sync with item A + B, second sync with only item A: verify item B's availability `status = UNAVAILABLE` and `unavailableAt` is set; item A remains `AVAILABLE`.
4. **Reappearance** — item was UNAVAILABLE; new snapshot includes it again: verify `status = AVAILABLE`, `unavailableAt = null`, `lastSeenAt` updated, `firstSeenAt` preserved from original first-seen date.
5. **Retry / idempotency** — simulate a failed sync (force a transaction rollback mid-sync): verify no orphan catalog rows; verify no stale RUNNING lock; verify a subsequent call to `syncCatalog` succeeds cleanly.
6. **Concurrency** — two concurrent `syncCatalog` calls for the same `sourceId`: verify one resolves successfully and the other throws `SyncAlreadyRunningError` (no duplicate catalog mutations).

## Excluded

- Episode-level sync and `episodeAvailabilities`: the `XtreamCatalogSnapshot` boundary does not include episode data; this requires per-series `getSeriesInfo()` calls and is a separate ticket.
- Extending `XtreamCatalogSnapshot` to include episode data.
- Genre mapping during sync (genres table exists but no genre ingestion from Xtream is in scope here).
- Canonical metadata enrichment (TMDB/IMDB API calls, poster downloads, fuzzy title deduplication).
- Scheduled or background synchronization orchestration (cron, queue, daemon).
- Cinema radar alerts and recommendation generation.
- HTTP API route to trigger sync (service is callable but not exposed via Fastify in this ticket).
- UI for sync status beyond what `CatalogSyncResult` provides.

## Acceptance criteria

- `pnpm --filter api db:migrate` applies without error; schema includes `series_availabilities`, `sync_runs`, `availability_status` enum, and new columns on `movie_availabilities`.
- A first `syncCatalog(sourceId, snapshot)` call with N VOD streams and M series produces exactly N `movie_availabilities` rows and M `seriesAvailabilities` rows, with `status = 'AVAILABLE'` and `firstSeenAt = lastSeenAt`.
- A second call with the same snapshot produces zero new rows and leaves `firstSeenAt` unchanged while updating `lastSeenAt`.
- A second call with a reduced snapshot marks the missing items as `status = 'UNAVAILABLE'` and sets `unavailableAt`, without deleting any row.
- A third call restoring a previously-UNAVAILABLE item sets `status = 'AVAILABLE'`, clears `unavailableAt`, updates `lastSeenAt`, and preserves the original `firstSeenAt`.
- A concurrent `syncCatalog` call for the same `sourceId` throws `SyncAlreadyRunningError` without mutating the catalog.
- A sync that fails mid-transaction can be retried immediately without manual DB cleanup.
- `CatalogSyncResult.counts` accurately reflects created, updated, unavailable, and failed item counts for every call.
- All six test scenarios in `catalog-sync-service.test.ts` pass under `pnpm --filter api test`.
