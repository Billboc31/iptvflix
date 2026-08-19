# T115 — Plan: Complete catalog enrichment and make refresh failures resumable/observable

## Objective

Implement a deterministic, resumable `enrich missing` pass over the full catalog that targets all incomplete/unenriched titles independently from the normal refresh cadence; replace aggregate failure counters with per-item failure persistence that captures the real PostgreSQL/driver error cause; normalize known TMDB edge-case values (runtime=0, empty imdbId, empty synopsis) that can violate DB constraints; and extend admin stats to accurately reflect enrichment completeness and embedding readiness.

## Included

### 1. TMDB value normalization — `apps/api/src/providers/metadata/tmdb/client.ts`

- In `mapMovieDetail()`: normalize `runtime === 0` → `null` for `durationMinutes`; normalize empty-string `imdb_id` → `null` for `imdbId`; normalize blank/whitespace `overview` → `null` for `synopsis`
- Apply the same empty-string/zero guards in `mapSeriesDetail()`
- No logic change beyond null-safety; no new fields added

### 2. Per-item failure persistence

**New migration** — create `enrichment_failures` table:

```
id             uuid PK
media_type     text NOT NULL  -- 'MOVIE' | 'SERIES'
media_id       uuid NOT NULL
tmdb_id        integer
title          text
stage          text NOT NULL  -- 'fetch' | 'map' | 'db_update'
error_class    text           -- e.g. 'PostgresError', 'TmdbRateLimitError'
error_code     text           -- e.g. '23505' (pg unique violation)
error_message  text NOT NULL
retry_count    integer NOT NULL DEFAULT 0
occurred_at    timestamp with time zone NOT NULL DEFAULT now()
retryable      boolean NOT NULL DEFAULT false
run_id         uuid           -- FK to catalog_refresh_runs (nullable)
```

Add a unique index on `(media_type, media_id)` so upsert on conflict updates retry_count, occurred_at, error detail (keeping the latest failure per item).

**New Drizzle schema** — `apps/api/src/db/schema/enrichment-failures.ts`

**Update `MetadataEnrichmentService`** — `apps/api/src/services/metadata-enrichment-service.ts`:

- In `enrichMovie()` and `enrichSeries()` catch blocks: extract real error class/code/message from the thrown value before re-throwing or skipping; persist to `enrichment_failures` via a `persistFailure()` helper
- In DB update blocks (drizzle `.update()` / `.insert()`): catch `PostgresError` and expose `.code` and `.message` — not the generated SQL string
- Add `stage` parameter to differentiate `fetch` (TMDB call), `map` (normalization), `db_update` (drizzle write)
- Delete rows from `enrichment_failures` for a given `media_id` on successful enrichment (clean-up on success)

### 3. Enrich-missing service — new file `apps/api/src/services/catalog-enrich-missing-service.ts`

Implements `CatalogEnrichMissingService`:

```typescript
interface EnrichMissingOptions {
  mediaTypes?: ('MOVIE' | 'SERIES')[]  // default both
  batchSize?: number                    // default 50
  concurrency?: number                  // default 3
  throttleMs?: number                   // default 250
  force?: boolean                       // skip recency check, re-enrich fresh rows
  runId?: string                        // resume an existing run
}

interface EnrichMissingStats {
  totalEligible: number
  processed: number
  enriched: number
  skipped: number          // already fresh, only counted when force=false
  failedTerminal: number
  remaining: number
  ratePerMinute: number
  etaSeconds: number | null
}
```

**Eligible row selection**: movies/series where `metadataEnrichedAt IS NULL OR metadataEnrichedAt < (now() - ENRICH_MISSING_STALE_DAYS)` AND `tmdbId IS NOT NULL` AND `matchStatus = 'MATCHED'`

**Cursor pagination** (keyset, not offset): paginate by `id` ascending — `WHERE id > :lastId ORDER BY id LIMIT batchSize`. This avoids offset drift and is fully resumable. Checkpoint stores `{ lastId: string | null, processedCount: number, done: boolean }` per media type.

**Run record**: reuse `catalogRefreshRuns` table with a new `type` column added by migration (`'REFRESH' | 'ENRICH_MISSING'`, default `'REFRESH'`). Store live stats in `checkpoint` JSONB during the run.

**Retry logic**: up to 3 retries with exponential backoff (250ms, 500ms, 1000ms) for transient TMDB/network errors. After 3 failures, persist to `enrichment_failures` as terminal (retryable=false) and continue.

**Idempotency**: skip rows where `metadataEnrichedAt` is fresher than the stale threshold unless `force=true`.

**Series seasons**: reuse existing `enrichSeriesSeasons()` — already called within `enrichSeries()`.

### 4. New API routes — `apps/api/src/routes/catalog-enrich-missing.ts`

- `POST /admin/catalog-enrich-missing` — start a new enrich-missing run; body: `EnrichMissingOptions`; returns `{ runId }` immediately; run is async
- `GET /admin/catalog-enrich-missing/status` — returns latest run stats (`EnrichMissingStats` + `status`, `startedAt`)
- `GET /admin/catalog-enrich-missing/failures` — paginated list of `enrichment_failures` rows; query params: `?page=&limit=&mediaType=&retryable=`
- `POST /admin/catalog-enrich-missing/retry-failures` — re-enrich all rows currently in `enrichment_failures`; body: optional `{ mediaType?, ids? }`; reuses `CatalogEnrichMissingService` with `force=true` over the failure set

Register routes in `apps/api/src/index.ts`.

### 5. Admin catalog-stats extension — `apps/api/src/routes/catalog-stats.ts`

Extend the response for both `movies` and `series` to add:

```typescript
{
  neverEnriched: number           // metadataEnrichedAt IS NULL
  partiallyEnriched: number       // enriched but synopsis IS NULL OR keywords IS NULL
  fullyEnriched: number           // enriched + synopsis + keywords non-null
  stale: number                   // enrichedAt < staleness threshold
  failedLastEnrichment: number    // count in enrichment_failures
  embeddingEligible: number       // passes isEmbeddingEligible()
  embeddingBlocked: number        // enriched but fails isEmbeddingEligible()
  embeddingPending: number        // eligible but no embedding row yet (real query)
}
```

Remove the hardcoded `embeddingPending: 0`.

### 6. Embedding eligibility policy — `apps/api/src/services/embedding-eligibility.ts`

New file exporting:

```typescript
// Required: title must be non-null (always true by DB constraint)
// Preferred: synopsis, at least one genre, originalLanguage
// Optional: keywords, credits, year, voteAverage
function isEmbeddingEligible(media: { title: string; metadataEnrichedAt: Date | null }): boolean
```

Document the policy in JSDoc (one short block). Use this function in:
- `catalog-stats.ts` to compute `embeddingEligible` / `embeddingBlocked`
- `embedding-backfill-service.ts` to filter the candidate set (replace any inline check)

### 7. DB migrations

- `apps/api/migrations/NNNN_enrichment_failures.sql` — create `enrichment_failures` table + unique index
- `apps/api/migrations/NNNN_catalog_refresh_runs_type.sql` — add `type text NOT NULL DEFAULT 'REFRESH'` to `catalog_refresh_runs`

### 8. Tests

- Unit: TMDB normalization — `runtime=0` yields `durationMinutes=null`, `imdb_id=""` yields `imdbId=null`
- Unit: `CatalogEnrichMissingService` cursor pagination — second run with same `lastId` skips already-processed rows
- Unit: `persistFailure()` — PostgresError with code `23505` stored as `error_code='23505'`, `error_class='PostgresError'`
- Integration: run `enrich missing` against test DB subset; verify `enrichment_failures` populated on error; verify stats decrease on success

## Excluded

- Changing the normal periodic refresh cadence, bucket logic, or stale thresholds
- Embedding backfill execution (separate ticket)
- Season/episode enrichment as a separate enrich-missing mode (already covered by existing `enrichSeriesSeasons()` called inside `enrichSeries()`)
- Frontend/UI progress display
- Changing authentication or authorization middleware
- Modifying discovery feed logic

## Acceptance criteria

- `mapMovieDetail()` with `runtime=0` and `imdb_id=""` produces `durationMinutes=null` and `imdbId=null`; no DB constraint violation for the production example title
- Each terminal enrichment failure row in `enrichment_failures` contains the real PostgreSQL error code and message, not a generated SQL string
- `POST /admin/catalog-enrich-missing` starts a run; `GET /admin/catalog-enrich-missing/status` reflects live progress
- Re-running `enrich missing` without `force=true` skips already-fresh rows and advances the cursor past them — it does not repeat the same capped offset
- `GET /admin/catalog-enrich-missing/failures` lists all terminal failures with `stage`, `errorClass`, `errorCode`, `errorMessage`, `retryCount`
- `POST /admin/catalog-enrich-missing/retry-failures` re-attempts terminal failures and updates or removes them on success
- `GET /admin/catalog-stats` returns accurate `neverEnriched`, `failedLastEnrichment`, `embeddingEligible`, and a real (non-zero) `embeddingPending` when the embedding corpus has not been backfilled
- `isEmbeddingEligible()` is the single source of truth used by both stats and backfill; no inline duplicate check
- Run against production catalog: before/after counts published in ticket comment showing reduction of `neverEnriched` and zero remaining terminal failures (or each remaining failure has an observable root cause)
