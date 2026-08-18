## Objective

Add a provider-agnostic `MediaSegment` model and full ingestion/sync pipeline for episodic segment metadata (intro/recap/outro/credits), initially sourcing IntroDB, so that Web and Android TV clients can consume normalized skip markers for any canonical episode, including anime.

## Included

### 1. Database schema — `mediaSegments` table

- **`apps/api/src/db/schema/media-segments.ts`** — Drizzle table definition:
  - `id` (uuid PK), `episodeId` (FK → `episodes.id`), `type` (pgEnum: RECAP/INTRO/OUTRO/CREDITS/PREVIEW), `startMs` (integer), `endMs` (integer)
  - `sourceProvider` (text), `sourceExternalId` (text, nullable), `confidence` (real, nullable), `submissionCount` (integer, nullable), `status` (text, nullable), `sourceUpdatedAt` (timestamptz, nullable)
  - `createdAt`, `updatedAt` (timestamptz)
  - Unique constraint on `(episodeId, type, sourceProvider)` for idempotent upsert
- **`apps/api/migrations/0036_t096_media_segments.sql`** — generated Drizzle migration
- Export new table from `apps/api/src/db/schema/index.ts`

### 2. IMDb ID resolution for TV Series

- **`apps/api/src/providers/metadata/tmdb/client.ts`** — add `getSeriesExternalIds(tmdbSeriesId: number): Promise<{ imdb_id?: string }>` calling `/tv/{id}/external_ids`
- **`apps/api/src/services/imdb-resolver.ts`** (new) — `resolveAndPersistSeriesImdbId(seriesId: string): Promise<string | null>`:
  - Reads `series.imdbId`; if already populated, returns it
  - Otherwise calls `tmdbClient.getSeriesExternalIds(series.tmdbId)`, persists result to `series.imdbId`, returns it
  - No-op if TMDB API key absent or series has no TMDB ID

### 3. IntroDB provider adapter

New directory **`apps/api/src/providers/segments/introdb/`**:

- **`types.ts`** — raw IntroDB response shape (`IntroDbSegmentResponse`)
- **`errors.ts`** — `IntroDbRateLimitError`, `IntroDbNetworkError`, `IntroDbNoDataError`
- **`client.ts`** — `IntroDbClient`:
  - Constructor: `{ baseUrl?: string; timeoutMs?: number }` (no API key required for read-only)
  - `fetchEpisodeSegments(imdbId: string, season: number, episode: number): Promise<IntroDbSegmentResponse | null>`
  - Uses `GET /segments?imdb_id=...&season=...&episode=...`
  - 404 returns `null` (not an error)
  - 429 throws `IntroDbRateLimitError` with `Retry-After`; caller applies exponential backoff (max 3 retries, caps at 60 s)
  - Non-2xx/non-404 throws `IntroDbNetworkError`
- **`mapper.ts`** — `mapIntroDbResponse(raw, episodeId): RawSegment[]`:
  - Maps `intro` → `INTRO`, `recap` → `RECAP`, `outro` → `OUTRO`
  - Sets `sourceProvider = "introdb"`, `sourceExternalId`, `confidence`, `submissionCount`

### 4. SegmentProvider abstraction

**`apps/api/src/providers/segments/types.ts`** (new):

```ts
interface CanonicalEpisodeRef {
  episodeId: string
  seriesImdbId: string | null
  seasonNumber: number
  episodeNumber: number
}

interface RawSegment {
  type: 'RECAP' | 'INTRO' | 'OUTRO' | 'CREDITS' | 'PREVIEW'
  startMs: number
  endMs: number
  sourceProvider: string
  sourceExternalId?: string
  confidence?: number
  submissionCount?: number
  sourceUpdatedAt?: Date
}

interface SegmentProvider {
  fetchEpisodeSegments(episode: CanonicalEpisodeRef): Promise<RawSegment[]>
}
```

`IntroDbClient` implements `SegmentProvider`. `sourceProvider` stored on every row ensures provenance.

### 5. Segment sync service

**`apps/api/src/services/segment-sync-service.ts`** (new):

- `upsertSegments(episodeId, segments[])` — Drizzle `onConflictDoUpdate` on `(episodeId, type, sourceProvider)`
- `syncEpisode(episodeRef, providers[])`:
  1. Calls `resolveAndPersistSeriesImdbId` to ensure IMDb ID is available
  2. Guards against season 0 / absolute-numbering ambiguity: if `seasonNumber === 0`, logs structured warning `{ level: "warn", event: "segment_numbering_ambiguous", episodeId }` and skips rather than attaching potentially wrong segments
  3. Calls each provider's `fetchEpisodeSegments`; aggregates `RawSegment[]`
  4. Calls `upsertSegments`; returns `{ found, noData, error }` counters
- `syncEpisodeById(episodeId)` — public entry point for on-demand enrichment; fetches episode + series from DB, calls `syncEpisode`
- `backfillCatalog(opts: { concurrency: number; dryRun?: boolean; force?: boolean })`:
  - Pages through all canonical episodes
  - Skips episodes already having IntroDB segments unless `force`
  - Uses `withBoundedConcurrency` from SchedulerService (imported as a utility)
  - Emits progress to stdout: `{ total, processed, found, noData, errors, mismatches }`
  - Non-fatal per-episode errors are caught and counted

### 6. On-demand enrichment hook

- Identify where canonical episodes are created after TMDB sync (episode upsert in catalog-refresh flow)
- After episode is upserted, fire `syncEpisodeById(episodeId)` as a non-blocking `void` background call (no `await`)
- No change to playback latency

### 7. Scheduler integration

- **`apps/api/src/services/scheduler-service.ts`** — add:
  - Config fields: `segmentRefreshEnabled` (default `false` until first backfill), `segmentRefreshCadenceHours` (default `24`), `segmentRefreshRecentDays` (default `30`)
  - New `segmentRefreshTimer` running `runSegmentRefreshTick()` at cadence
  - `runSegmentRefreshTick()` priorities:
    1. Episodes with `airDate` in last `segmentRefreshRecentDays` — refreshed every cycle
    2. Episodes with no segments (status: no-data) — retried every 3 cycles
    3. All other episodes — refreshed every 7 cycles
  - Each priority group uses bounded concurrency (default 3)

### 8. CLI backfill script

**`apps/api/src/scripts/backfill-segments.ts`** (new):

- Entry: `pnpm backfill:segments [--concurrency=5] [--force] [--dry-run]`
- Instantiates `SegmentSyncService` with `IntroDbClient`
- Calls `backfillCatalog(opts)`
- On completion prints summary counters and exits with code 0 (or 1 if error rate > 50 %)
- Add script entry to `apps/api/package.json`

### 9. API endpoint — episode segments

- **`apps/api/src/routes/episodes.ts`** (create if not exists, otherwise extend catalog routes):
  - `GET /episodes/:id/segments` → queries `mediaSegments` by `episodeId`, returns only `type / startMs / endMs` for normal clients
- **`packages/api-contracts/src/segments.ts`** (new) — `EpisodeSegmentsResponse`:
  ```ts
  { episodeId: string; segments: Array<{ type: string; startMs: number; endMs: number }> }
  ```
- Register route in main Fastify app

### 10. Admin/diagnostics endpoints

Extend or add admin routes (pattern matching existing `/scheduler/status`, `/playback/diag`):

- **`GET /admin/segments/coverage`**:
  - Total canonical episodes
  - Episodes with each segment type (intro/recap/outro)
  - Episodes with no segments
  - Episodes with identifier mismatches (logged in DB or counted via error table)
  - Provider breakdown; anime vs. live-action if `originalLanguage`/genre available
- **`GET /admin/segments/episode/:id`**:
  - Full `mediaSegments` rows including `sourceProvider`, `confidence`, `submissionCount`, `sourceUpdatedAt`

### 11. Tests

- **`apps/api/src/providers/segments/introdb/__tests__/client.test.ts`** — MSW fixtures: success response, 404 → null, 429 → retry/backoff, network error
- **`apps/api/src/providers/segments/introdb/__tests__/mapper.test.ts`** — mapping of all three types, missing fields handled gracefully
- **`apps/api/src/services/__tests__/segment-sync-service.test.ts`**:
  - Upsert idempotency (same call twice = same rows)
  - No-data episode: no rows inserted, no error thrown
  - Provider provenance stored on every row
  - `syncEpisode` with season 0: logs warning, inserts no rows
  - Anime episode (fixture): correct mapping of INTRO/RECAP/OUTRO
- **`apps/api/src/routes/__tests__/episodes-segments.test.ts`** — API serialization: correct JSON shape, only public fields exposed
- **`apps/api/src/services/__tests__/imdb-resolver.test.ts`** — cache hit (already populated), TMDB fetch + persist, missing TMDB ID → null

## Excluded

- Web and Android TV player UI (skip buttons, auto-skip, "Passer l'intro" overlay) — follow-up tickets
- Additional segment providers beyond IntroDB (TheIntroDB, SkipMe, fingerprint detection)
- Conflict/merge logic between multiple competing providers — schema is forward-compatible but logic deferred
- Automatic per-release offset correction for different media cuts
- Full authorized bulk IntroDB dump import — document license/terms check result in PR; if a permitted dump exists, import path is follow-up
- Absolute-episode-number auto-correction for anime — mismatch is logged and skipped, not auto-fixed
- Any UI or non-segment changes to the playback resolver

## Acceptance criteria

- `mediaSegments` table present in PostgreSQL after migration; unique constraint on `(episodeId, type, sourceProvider)` verified
- `GET /episodes/:id/segments` returns `{ episodeId, segments: [{ type, startMs, endMs }] }` for a canonical episode that has IntroDB data
- Manual smoke test against IntroDB public API for One Piece **and** Bleach episodes returns valid segment data and persists it correctly
- At least one live-action series episode is also verified end-to-end
- Season 0 / specials episodes produce a structured warning log and zero inserted segments, not a wrong attachment
- `pnpm backfill:segments` runs to completion twice without errors and produces identical row counts (idempotency)
- `segmentRefreshTimer` fires in SchedulerService when `segmentRefreshEnabled = true`; new episodes trigger `syncEpisodeById` non-blockingly
- `GET /admin/segments/coverage` returns accurate totals matching DB counts
- IntroDB 404 does not produce an error-level log entry
- IntroDB 429 triggers retry with backoff; third consecutive 429 propagates an error counted in backfill metrics but does not abort the run
- `withBoundedConcurrency` is respected during backfill (no unbounded fan-out)
- All new Vitest tests pass; no existing tests regressed
