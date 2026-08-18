## Objective

Expand IPTVFlix's canonical TMDB-backed catalog beyond titles discovered through Xtream/Plex sources by widening the existing bootstrap/refresh pipeline, adding a catalog-stats diagnostic endpoint, exposing availability-aware recommendation shelf policies, verifying profile state works for unavailable titles, and wiring an idempotent embedding-backfill integration point for when #205 lands.

## Included

### 1. Audit (read-only, informs scope)

- Read `catalog-bootstrap-service.ts` and `env.ts` to confirm current feed list and page-limit defaults.
- Count current canonical rows vs availability rows via a raw DB query; record in plan comments for baseline.

### 2. Bootstrap expansion — `apps/api/src/services/catalog-bootstrap-service.ts` + `apps/api/src/config/env.ts`

Add two missing feed dimensions to `buildSteps()`:
- `now_playing` (movies) via `TmdbClient.fetchMovieFeed('now_playing', page)`.
- `airing_today` (series) via `TmdbClient.fetchSeriesFeed('airing_today', page)`.

Add new env vars in `env.ts`:
- `CATALOG_BOOTSTRAP_MAX_PAGES_NOW_PLAYING` (default: 10).
- `CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT` (default: 50) — applied as a post-filter on TMDB results during genre/discover deep pages to skip noise.
- `CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY` (default: 5.0) — same scope.

Raise default page limits to approach tens-of-thousands target:
- `CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED` default: 20 → **50** (50 × 20 items × 4 movie feeds ≈ 4 k movies from feeds alone).
- `CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE` default: 10 → **20**.

Apply quality floor in `CatalogBootstrapService` only during genre/discover steps (not feed steps, where quality is already implicit). No schema change needed — filter is in-memory before upsert.

Make `DiscoveryCandidatePoolService.MAX_PAGES_PER_FEED` read from a new env var `DISCOVERY_POOL_MAX_PAGES_PER_FEED` (default: 5, was hard-coded 3).

### 3. Catalog-stats diagnostic endpoint — new file `apps/api/src/routes/catalog-stats.ts` + register in `apps/api/src/index.ts`

`GET /admin/catalog-stats` returns JSON:

```ts
{
  movies: {
    total: number;
    withAvailability: number;       // at least one AVAILABLE row
    withoutAvailability: number;
    upcoming: number;               // status IN ('Rumored','Planned','In Production','Post Production')
    enriched: number;               // metadataEnrichedAt IS NOT NULL
    embeddingPending: number;       // always 0 until #205 adds the column
  };
  series: { /* same shape */ };
  episodeCount: number;
  availabilityRows: { movie: number; series: number; episode: number };
  tmdbSyncAge: { oldestMovieSyncedAt: string | null; oldestSeriesSyncedAt: string | null };
}
```

All counts via single Drizzle query per entity type (aggregated, not row-by-row). No new schema column needed for `embeddingPending` — returns 0 as documented stub.

### 4. Recommendation shelf policy filter — `apps/api/src/services/recommendation-ranking-service.ts` + `apps/api/src/routes/recommendations.ts`

Add `availabilityPolicy?: 'ALL' | 'WATCH_NOW' | 'DISCOVERY' | 'UPCOMING'` to `RankRecommendationsOpts`.

- `WATCH_NOW`: require at least one `AVAILABLE` movie/series availability for the household's providers — applies an EXISTS sub-query or post-filter.
- `DISCOVERY`: no availability filter (current default behaviour).
- `UPCOMING`: filter to titles where `status` is in the upcoming set.
- `ALL`: same as `DISCOVERY` (no filter).

Expose `?policy=WATCH_NOW|DISCOVERY|UPCOMING|ALL` query param on `GET /recommendations` route. Default: `ALL` (preserves existing behaviour).

### 5. Profile state for unavailable titles — verify + fix if needed

Read watchlist/rating/history route handlers (`apps/api/src/routes/` — likely `watchlist.ts`, `profile.ts`, or `interactions.ts`).

Confirm that `POST /watchlist` (or equivalent) accepts a `movieId`/`seriesId` that has zero availability rows and does not reject it. If a foreign-key or guard check exists that requires an availability, remove it.

Confirm that `GET /movies/:id` and `GET /series/:id` detail endpoints return the full record when no availability exists — no 404 or redirect. The response should include a `playable: false` field (or equivalent already-present field); do not add a fake play button.

If any of the above is broken, fix the specific guard. No new routes needed.

### 6. Embedding-backfill integration point — new file `apps/api/src/routes/embedding-backfill.ts` + register in `apps/api/src/index.ts`

`POST /admin/embedding-backfill` — returns `501 Not Implemented` with body:

```json
{ "message": "Embedding backfill not yet implemented. Wire #205 EmbeddingService here.", "eligibleMovies": <count>, "eligibleSeries": <count> }
```

`eligibleMovies`/`eligibleSeries` = rows where `metadataEnrichedAt IS NOT NULL` (i.e., already have rich metadata and are ready for embedding when #205 lands). This makes the integration point explicit and actionable.

### 7. Tests — `apps/api/src/` test files (co-locate with services or in `__tests__/`)

- `catalog-bootstrap.test.ts`: assert that a bootstrapped movie with zero availability rows is present in DB after bootstrap; rerun does not duplicate (upsert idempotency).
- `catalog-sync.test.ts`: assert that running source sync for a title already in canonical DB via bootstrap adds an Availability row without changing `movies.id` or `movies.tmdbId`.
- `catalog-stats.test.ts`: `GET /admin/catalog-stats` returns valid shape; `withoutAvailability` > 0 after bootstrap with zero sources.
- `recommendation-ranking.test.ts`: `WATCH_NOW` policy excludes a movie with no availability; `DISCOVERY` includes it.
- `profile-unavailable.test.ts`: watchlist add/read/remove for a movie with zero availability succeeds.
- `embedding-backfill.test.ts`: `POST /admin/embedding-backfill` returns 501 with counts.

## Excluded

- Implementing the #205 embedding/vector system itself — only the integration stub endpoint.
- Notification UX for availability transitions (the `firstSeenAt` column on Availability already captures the data; UI feature is out of scope).
- Bulk image binary download — TMDB image paths only.
- Plex or Xtream provider changes.
- My List / profile UI changes beyond verifying backend routes accept unavailable titles.
- Genre page UI / shelf rendering — only the API policy filter.
- Full rewrite of `RecommendationRankingService` scoring — only the policy pre-filter layer.
- Resetting or migrating the existing DB; all changes are additive (new routes, config defaults, upserts).
- Reconciliation service changes.

## Acceptance criteria

1. `GET /admin/catalog-stats` returns counts; `withoutAvailability > 0` after bootstrap with no IPTV sources configured.
2. `POST /catalog-bootstrap` completes with at least two additional feed types (`now_playing`, `airing_today`) visible in its checkpoint log.
3. Rerunning `POST /catalog-bootstrap` on an already-populated DB produces no new duplicate rows (verified by `total` count not growing beyond TMDB page × items ceiling).
4. A canonical `Movie` with zero availability rows can be added to a profile's watchlist via `POST /watchlist` and retrieved via `GET /watchlist` — no 4xx errors.
5. `GET /movies/:id` for a zero-availability movie returns HTTP 200 with `playable: false` (or equivalent field), not a 404.
6. `GET /recommendations?policy=WATCH_NOW` excludes movies with no AVAILABLE availability; `?policy=DISCOVERY` includes them.
7. A movie first ingested via bootstrap, then matched by a source sync, has exactly one canonical `movies` row and one new `movieAvailabilities` row — verified by comparing `movies.id` before and after sync.
8. `POST /admin/embedding-backfill` returns HTTP 501 with `eligibleMovies` and `eligibleSeries` counts ≥ 0.
9. All six new test suites pass (`pnpm test` or equivalent).
10. Quality floor env vars `CATALOG_BOOTSTRAP_QUALITY_MIN_VOTE_COUNT` and `CATALOG_BOOTSTRAP_QUALITY_MIN_POPULARITY` are documented in `env.ts` with defaults and applied during genre/discover steps only.
