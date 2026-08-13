Now I have all I need for the review. The coder's work is in exactly 2 commits (`9222420` + `74a7d4b`); `MediaReconciliationService` and migration `0025` are inherited from T061's branch, not introduced by T062.

---

# Review — T062: Ingest and Reconcile Series → Season → Episode

## Summary

The implementation correctly fills the episode ingestion pipeline gaps described in the plan across 5 well-scoped areas: `container_extension` schema addition, variant metadata propagation through sync, TMDB season/episode enrichment, episode backfill service, and 74 new passing tests. The plan is faithfully executed; no functional regressions are visible.

---

## 1. Correctness vs Ticket

### Schema — `container_extension` ✅

`migrations/0026_episode_availability_container_extension.sql` adds the column as a nullable `text` on `episodeAvailabilities`. The field is required by `buildXtreamStreamUrl()` for correct container resolution; without it playback always defaulted to `.ts`.

### Episode sync — variant metadata propagation ✅

`NormalizedEpisodeItem` gains `rawTitle`, `audioLanguage`, `subtitleLanguage`, `videoQuality`, `containerExtension`. The normalization pipeline in `syncCatalog()` correctly extracts these from `normalizeTitle(ep.title).variantAttributes` while storing the raw title separately. Both INSERT and UPDATE paths in `syncNormalized()` persist all five fields, satisfying the "canonical Episode ≠ provider stream" invariant.

### `resolveEpisodeId()` metadata upsert ✅

When an episode row already exists, the `meta` parameter updates only non-null fields, preserving episode identity (stable `(seasonId, episodeNumber)` key). New episodes are initialized with the provider title/date/duration. TMDB enrichment later overwrites `episodes.title` with the canonical value — the transient dirty-title window is an inherent pipeline artifact, not a bug.

### TMDB `enrichSeriesSeasons()` ✅

Correctly called from within `enrichSeries()` under try/catch (failures logged, not rethrown). Implements the critical invariant: for TMDB episodes without an existing DB row, `skipped++` is incremented and no INSERT is issued — TMDB is enrichment-only, never a source of availability.

### Episode Backfill Service ✅

`EpisodeBackfillService.backfill()`:
- Queries `AVAILABLE` series availabilities for all enabled XTREAM sources, filtered to zero-season series (unless `force: true`)
- Fetches `getSeriesInfo()` under bounded concurrency (`XTREAM_SERIES_CONCURRENCY`, default 5)
- Builds a synthetic `NormalizedSnapshot` with empty `movies`/`series` arrays and `skipLifecycle: true`, feeding it through the existing `syncNormalized()` path
- Failure of one series does not block others; per-series error count is accumulated

The `skipLifecycle` flag correctly prevents backfill from marking unrelated AVAILABLE records UNAVAILABLE — this is the key invariant that protects existing series state.

### Reconciliation endpoints ✅

`POST /admin/episode-backfill` → fire-and-forget with 202 response. `GET /admin/episode-backfill/latest` → in-memory state (acceptable for V1 per plan). Concurrent run protection via `this.running` flag.

---

## 2. Scope Compliance

### Core scope: fully delivered ✅

All 5 plan sections (schema, variant fields, TMDB enrichment, backfill service, tests) are implemented.

### Inherited code from T061 ⚠️ (observation, not blocking)

`MediaReconciliationService`, `reconciliation-runs.ts`, and migration `0025` appear in the diff vs `main` but were NOT introduced in the T062 coder commits — they are T061-inherited infrastructure. The coder did wire `reconcileRoutes` (which uses `MediaReconciliationService`) in `reconcile.ts` and `index.ts`, which was not specified in the T062 plan. This is minor scope drift: exposing pre-existing code, no new abstractions introduced.

**Risk:** The T061-inherited `media-reconciliation-service.test.ts` has 10 pre-existing test failures. These inflate the apparent test-suite failure count and are T061's technical debt, not T062's. They should be tracked in the T061 review.

---

## 3. Code Quality and Safety

**Idempotency:** `onConflictDoNothing()` + UPDATE path for all three tables (seasons, episodes, episodeAvailabilities). Tests explicitly verify zero new rows on re-sync. ✅

**Error isolation:** `withBoundedConcurrency` returns `PromiseSettledResult<T>[]` — per-series failures are captured without aborting the batch. Failed series are recorded in `failedSeriesProviderIds` so their existing AVAILABLE episodes are excluded from UNAVAILABLE marking. ✅

**Data integrity:** `enrichSeriesSeasons()` never inserts an episode without an Xtream availability counterpart. Test explicitly covers this case. ✅

**Security:** No secrets exposed in logs. Xtream credentials read from `source.username/password` (already persisted). TMDB API key guarded by env var presence check. ✅

**Minor observations:**
- `failedSeriesIds.push(parseInt(item.providerItemId, 10))` — if `providerItemId` is non-numeric (shouldn't happen with Xtream), `NaN` enters `failedSeriesIds`. It would produce a no-op DB query rather than an error. Harmless in practice.
- `enrichSeriesSeasons` returns `{ result: 'no-tmdb-id' }` even when the reason is "provider doesn't implement `getSeasonEpisodes`" (line 216-218). Semantic inaccuracy, functionally correct.
- Backfill does not trigger TMDB enrichment for newly created episodes. Series enriched before backfill deployment will have raw provider titles on episode rows until the next enrichment cycle runs. This is correct pipeline behavior per the plan ("TMDB enrichment called from `enrichSeries()`") but creates a gap for already-enriched series. Future operators should know to re-trigger enrichment after a backfill.

---

## 4. Test Coverage

74 new tests cover:
- Variant field propagation through INSERT and UPDATE paths
- Multi-source convergence (one episode, two availability rows)
- Full idempotency (zero new rows on re-sync)
- Newly-added episode detection after subsequent sync
- Zero-season series backfill pickup
- `force: true` mode processing already-seasoned series
- Per-series failure isolation (Series A succeeds despite Series B failure)
- TMDB enrichment updates existing rows, does not create TMDB-only rows
- Early return on missing `tmdbId`

Missing from tests (acceptable given plan scope):
- Backfill of a source with no XTREAM candidates (trivially covered by the empty-candidates early-return path)
- TMDB `getSeasonEpisodes()` throttle behavior in integration context

---

## 5. Acceptance Criteria Checklist

| AC | Status | Evidence |
|---|---|---|
| Matched series with provider episodes produces Season/Episode entities | ✅ | Backfill + sync path; tested |
| Existing series backfilled without deleting source | ✅ | `skipLifecycle: true`; backfill service preserves `seriesAvailabilities` |
| Structured Xtream series/episode data used over title parsing | ✅ | `ep.episode_num`, `seasonNumber` from API; title parsing only for variant attributes |
| Canonical Episode identity from series + season/episode coords | ✅ | `resolveEpisodeId(seriesId, seasonNumber, episodeNumber)` |
| TMDB enriches Season/Episode metadata | ✅ | `enrichSeriesSeasons()` tested |
| Multiple provider streams converge on one Episode | ✅ | Multi-variant test: 1 episode row, 2 availability rows |
| Language/quality/rawTitle remain Availability concerns | ✅ | Fields on `episodeAvailabilities`, not `episodes` |
| Series detail API returns seasons/episodes | ✅ (pre-existing) | Plan confirms routes already support data shape |
| Idempotency | ✅ | Tested explicitly |
| Newly-added episodes appear after sync | ✅ | Tested |
| Playback progress preserved (episode identity stable) | ✅ | Identity based on coords, not provider ID |
| Failures don't corrupt catalogue or abort backfill | ✅ | `failedSeriesIds` protection; per-series try/catch |
| TMDB-only episodes not falsely marked playable | ✅ | `enrichSeriesSeasons` skips rows without Availability |

---

## 6. Blocking Issues

None.

---

## 7. Observations to Address Post-Merge

1. T061 test failures in `media-reconciliation-service.test.ts` (10 tests) should be resolved in T061's remediation track.
2. Consider triggering `enrichSeriesSeasons()` directly from the backfill completion path for series whose TMDB ID is already known, to avoid the dirty-title window.
3. `backfillService.getLatestState()` is in-memory. For operational visibility after server restart, a DB-persisted `backfill_runs` row (similar to `sync_runs`) would be appropriate in a follow-up.

---

IMPLEMENTATION_APPROVED
