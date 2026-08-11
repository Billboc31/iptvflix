All key checks done. Here is the test report.

---

## Test Report — T016: Evolve canonical catalog to support zero/many availabilities

**Test run**: `pnpm test` — 20 files, **195 tests: all pass, 0 failures**

---

### Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A canonical Movie can exist and be returned by the canonical API with zero availabilities | **PASS** | `catalog-constraints.test.ts` — "canonical movie exists and is retrievable with zero availability rows" inserts a movie with no availability rows and asserts it is retrievable. `movies.test.ts` — asserts `availabilityCount: 0` + `availabilityStatus: 'UNAVAILABLE'` on API response. |
| 2 | A canonical Series and its Season/Episode hierarchy can exist with zero availabilities | **PASS** | `catalog-constraints.test.ts` — Series/Season/Episode are inserted in `beforeAll` with no availability rows. `series.test.ts` — asserts `availabilityCount: 0` for a series with no source. `catalog.test.ts` — episode route returns `availabilityCount: 0`. |
| 3 | One canonical Movie/Episode can reference multiple availabilities from different sources | **PASS** | `catalog-constraints.test.ts` — "allows one movie to have availabilities on multiple sources" inserts two `movieAvailabilities` rows for different `providerId` values. `movies.test.ts` / `series.test.ts` — assert `availabilityCount: 2` on list response. |
| 4 | Removing/losing an availability does not delete canonical metadata or user tracking | **PASS** | `vertical-slice.test.ts` — "source disappearance" test: first sync ingests 2 movies; second sync omits stream 5001; canonical movie row survives with `title: 'Integration Movie One'`; watchlist and viewing-progress entries referencing `canonicalMovieId` are intact. |
| 5 | Existing canonical references used by watchlist/history remain valid or migrated deterministically | **PASS** | Same disappearance test explicitly checks `watchlist.mediaId` and `viewingProgress.mediaId` still equal the original canonical ID after source removal. No ID remapping needed — canonical IDs are unchanged. |
| 6 | Provider-specific identifiers remain confined to source/availability mappings | **PASS** | `packages/api-contracts/src/catalog.ts` — no `providerId` / `providerItemId` field in `MovieResponse`, `SeriesResponse`, or `EpisodeResponse`. Grep on the contract file returns no matches. |
| 7 | Database constraints prevent obvious duplicate mappings while permitting legitimate variants | **PASS** | `catalog-constraints.test.ts` — rejects duplicate `(movie_id, provider_id, provider_item_id)` for movies; rejects duplicate `(episode_id, provider_id, provider_item_id)` for episodes; permits the same `providerItemId` across two different `providerId` values (multi-source). |
| 8 | Automated migration/domain/API tests cover zero, one and multiple availability cases plus disappearance | **PASS** | `0007_episode_availability_status.sql` exists (additive migration). Tests in `catalog-constraints`, `movies.test`, `series.test`, `catalog.test`, and `vertical-slice.test` cover zero, one (`availabilityCount: 1`), multiple (`availabilityCount: 2`), and disappearance scenarios. |

---

### Regressions

None detected. All 195 pre-existing tests continue to pass.

---

### Observations (non-blocking, pre-existing)

1. **`catalogRoutes` not mounted in `index.ts`** — The `/series/:id/seasons/:n/episodes` route with `availabilityCount` is tested via `catalog.test.ts` but not reachable in production. This is a pre-existing gap flagged by the reviewer; out of scope for this ticket.
2. **Episode staleness is currently a no-op** — The `catalog-sync-service` marks stale `episode_availabilities` as UNAVAILABLE, but Xtream snapshots do not yet produce episode availability rows. The logic is correct and tested at the unit level; it will activate when episode-level ingestion is added.

---

### Decision

**VALIDATED** — All 8 acceptance criteria pass. No blocking issues found.
