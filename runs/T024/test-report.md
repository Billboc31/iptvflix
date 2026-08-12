# Test Report — T024: Fix episode availability lifecycle and provider episode synchronization

## Commands executed

```
cd apps/api && npm test
```

## Results

```
Test Files  28 passed (28)
     Tests  349 passed (349)
  Duration  ~1.3s
```

No failures, no skipped tests.

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| AC1 | Snapshot without episode inventory does not mark existing episode availabilities UNAVAILABLE | **PASS** | Guard `if (snapshot.episodes !== undefined)` at `catalog-sync-service.ts:439`. When `seriesInfo` is absent from the Xtream snapshot, `normalizedEpisodes` evaluates to `undefined` (lines 560–577) and the entire episode lifecycle block is skipped. Test: *"does not touch episode availabilities when snapshot has no episode data"* (`catalog-sync-service.test.ts:416`). |
| AC2 | Authoritative episode snapshot marks observed episodes AVAILABLE and absent episodes UNAVAILABLE | **PASS** | Lines 439–525 implement full lifecycle: seen episodes → `AVAILABLE`; unseen episodes (from `previouslyAvailableEpisodeIds`) → `UNAVAILABLE` with `unavailableAt = snapshot.fetchedAt`. Test: *"marks a disappeared episode UNAVAILABLE when absent from an authoritative snapshot"* (`test.ts:502`). |
| AC3 | Repeated sync preserves `firstSeenAt`, updates `lastSeenAt`, no duplicates | **PASS** | Lines 474–506: existing row → UPDATE `lastSeenAt` only, INSERT only when row is absent. Test: *"preserves firstSeenAt and updates lastSeenAt on repeated episode syncs"* (`test.ts:483`). |
| AC4 | Disappeared episode can become available again without losing history | **PASS** | UPDATE path (lines 495–506) sets `status: 'AVAILABLE', unavailableAt: null`; `firstSeenAt` is not touched. Test: *"restores a reappeared episode to AVAILABLE with original firstSeenAt and cleared unavailableAt"* (`test.ts:543`). |
| AC5 | Xtream episode data mapped to canonical Series → Season → Episode hierarchy | **PASS** | `fetchXtreamSnapshot` (`sync-runs-service.ts:54–60`) calls `getSeriesInfo` for every series. `syncCatalog` maps `seriesInfo` entries to `NormalizedEpisodeItem[]` (`catalog-sync-service.ts:559–577`). `resolveEpisodeId` (lines 168–224) creates/reuses `seasons` and `episodes` rows race-safely via `onConflictDoNothing`. |
| AC6 | Plex episode data mapped through common ingestion boundary | **PASS** | `fetchPlexSnapshot` (`sync-runs-service.ts:87–89`) calls `fetchEpisodes(s.key)` for each show section. `syncPlexCatalog` maps `snapshot.episodes` to `NormalizedEpisodeItem[]` and passes it to `syncNormalized` (`catalog-sync-service.ts:614–643`). `PlexEpisodeItem` interface and `mapEpisodeMetadataItem` helper encapsulate Plex-specific fields (`plex/client.ts:137–148`). |
| AC7 | Automated tests cover: no-episode snapshot, complete snapshot, disappearance, reappearance, multi-source | **PASS** | 6 tests in `describe('episode availability lifecycle')` (`test.ts:415–635`): no-episode snapshot, first sync (timestamps + providerItemIds), idempotency, disappearance, reappearance, multi-source shared canonical episode. All pass. |

---

## Regressions observed

None. All 343 pre-existing tests continue to pass alongside the 6 new episode tests.

---

## Blocking issues

None.

---

## Non-blocking observations

1. **Episode metadata not persisted** — `title`, `synopsis`, `durationMinutes`, `airDate` are carried in `NormalizedEpisodeItem` but not written to the `episodes` table. Acceptable for a ticket scoped to lifecycle correctness.
2. **`Promise.all` unbounded on Xtream `getSeriesInfo`** — all series fetched in parallel with no concurrency limit. Acknowledged risk on large catalogs; explicitly excluded from this ticket's scope.
3. **`seriesProviderItemId` string/number key alignment** — Xtream `seriesInfo` keys are numeric (`Record<number, XtreamSeriesInfo>`), but `Object.entries` coerces them to strings. The series side maps `s.series_id.toString()` as `providerItemId`, so the cross-reference is consistent. No bug.

---

## Verdict

**APPROVED** — all 7 acceptance criteria pass, no regressions, no blocking issues.

TESTING_APPROVED
