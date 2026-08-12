Now I have all the context needed. Here's the implementation plan:

---

## Objective

Replace the unbounded `Promise.all` over `getSeriesInfo()` calls with a concurrency-bounded, failure-tolerant strategy so that large Xtream catalogs sync safely and partial provider failures do not cause false episode disappearances.

## Included

### `apps/api/src/providers/xtream/types.ts`
- Add `failedSeriesIds?: number[]` to `XtreamCatalogSnapshot` — series IDs for which `getSeriesInfo()` failed during the snapshot fetch.

### `apps/api/src/services/sync-runs-service.ts`
- Add a local `withBoundedConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]>` helper (~15 lines, no new dependency) that runs at most `limit` tasks concurrently and returns settled results.
- Replace the unbounded `Promise.all` (lines 54–60) with `withBoundedConcurrency` (default limit: `parseInt(process.env.XTREAM_SERIES_CONCURRENCY ?? '5', 10)`).
- Use `PromiseSettledResult` to classify each outcome:
  - `fulfilled` → add to `seriesInfo`
  - `rejected` → push `s.series_id` into `failedSeriesIds`, log a `console.warn` with the error
- Return snapshot with both `seriesInfo` (successful entries only) and `failedSeriesIds`.

### `apps/api/src/services/catalog-sync-service.ts`

**`NormalizedSnapshot` interface** (line 75): add `failedSeriesProviderIds?: string[]`.

**`syncCatalog`** (line 638): map `snapshot.failedSeriesIds?.map(String)` onto `normalizedSnapshot.failedSeriesProviderIds`. Increment `counts.failedCount` by the count of failed series-info calls (so it reflects series fetch failures in addition to any existing uses).

**`syncNormalized` episode disappearance block** (lines 589–604): before computing `missingEpisodeIds`, protect episodes from failed series — if `snapshot.failedSeriesProviderIds` is non-empty, execute a 3-table join query:
```
episodeAvailabilities (providerId = sourceId, status = AVAILABLE)
  → episodes (episodeId = episodes.id)
  → seriesAvailabilities (episodes.seriesId = seriesAvailabilities.seriesId
                          AND seriesAvailabilities.providerId = sourceId
                          AND seriesAvailabilities.providerItemId IN failedSeriesProviderIds)
```
Collect the resulting `providerItemId`s into `protectedEpisodeIds: Set<string>`. Exclude them from `missingEpisodeIds`:
```typescript
const missingEpisodeIds = [...previouslyAvailableEpisodeIds].filter(
  (id) => !seenEpisodeProviderItemIds.has(id) && !protectedEpisodeIds.has(id),
)
```

### `packages/api-contracts/src/sync.ts`
- Add `seriesInfoFailed?: number` to `SyncRunResponse` for caller diagnostics.

### `apps/api/src/services/sync-runs-service.ts` — `toResponse`
- Add `seriesInfoFailed: row.failedCount` to the response mapping (line 18–31).

### Tests — `apps/api/src/services/__tests__/catalog-sync-service.test.ts`
Three new test cases (can be in a new `describe` block "partial episode-fetch safety"):

1. **Bounded concurrency**: mock `getSeriesInfo` with a counter tracking simultaneous in-flight calls; verify the peak never exceeds the configured limit across N > limit series.

2. **One failing series does not disappear other series' episodes**: set up a prior sync with episodes for series A and B; on the next snapshot, series B's `getSeriesInfo` fails; assert series A's episodes go through normal lifecycle (updated `lastSeenAt`) and series B's episodes remain `AVAILABLE` (not marked `UNAVAILABLE`).

3. **Failed series reflected in `failedCount`**: assert `result.counts.failedCount` equals the number of series whose `getSeriesInfo` call was rejected.

## Excluded

- Retry logic for failed `getSeriesInfo()` calls (the ticket asks for deterministic resync, not automatic retry within a run).
- Concurrency bounding for VOD stream or Plex snapshot fetches.
- Any changes to the Xtream client (`XtreamCodesClient`) timeout or error classification.
- DB schema changes — `failed_count` column already exists on `sync_runs`.
- Any UI or web-frontend changes.
- Plex sync path.

## Acceptance criteria

- `getSeriesInfo()` is never called with more than `XTREAM_SERIES_CONCURRENCY` (default 5) concurrent in-flight requests during a single snapshot fetch.
- A snapshot fetch where one series-info call rejects does not throw; the fetch completes and returns a valid `XtreamCatalogSnapshot` with that series absent from `seriesInfo` and its ID in `failedSeriesIds`.
- After a partial snapshot (some series-info calls failed), previously-available episodes whose series had a failed fetch remain `AVAILABLE` in the DB — not marked `UNAVAILABLE`.
- `CatalogSyncResult.counts.failedCount` equals the number of rejected series-info calls.
- `SyncRunResponse.seriesInfoFailed` reflects that count for API consumers.
- All three new test cases pass; existing catalog-sync test suite passes without modification.
