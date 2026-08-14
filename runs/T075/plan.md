## Objective

Add `GET /movies/:id/similar` and `GET /series/:id/similar` public API endpoints backed by a new `SimilarTitlesService` that fetches TMDB similar/recommendations, resolves candidates against the local canonical catalog (materializing missing entries safely), and degrades gracefully to a local genre-based fallback on TMDB failure.

## Included

### `apps/api/src/providers/metadata/tmdb/client.ts`

Add four methods to the existing `TmdbClient` class:

- `getMovieSimilar(tmdbId: number, page?: number)` — calls TMDB `GET /movie/{id}/similar`
- `getMovieRecommendations(tmdbId: number, page?: number)` — calls TMDB `GET /movie/{id}/recommendations`
- `getSeriesSimilar(tmdbId: number, page?: number)` — calls TMDB `GET /tv/{id}/similar`
- `getSeriesRecommendations(tmdbId: number, page?: number)` — calls TMDB `GET /tv/{id}/recommendations`

Each returns `{ results: Array<{ id: number, title?: string, name?: string, poster_path: string | null, release_date?: string, first_air_date?: string, vote_average: number }> }`.
Existing rate-limit (429 + Retry-After) and timeout (`TmdbNetworkError`) handling applies automatically.

---

### `apps/api/src/services/similar-titles-service.ts` (new file)

Class `SimilarTitlesService` constructed with `(db, tmdbClient)`.

**In-memory cache:** `Map<string, { data: SimilarTitleCard[]; expiresAt: number }>` keyed by `"movie:{tmdbId}"` or `"series:{tmdbId}"`, TTL 5 minutes (same pattern as `ExternalDiscoveryService`).

**`SimilarTitleCard` type:**
```ts
{ id: string; tmdbId: number; title: string; posterPath: string | null;
  year: number | null; voteAverage: number; isAvailable: boolean }
```

`isAvailable` is `true` when at least one row in `movie_availabilities` / `series_availabilities` with `status = 'AVAILABLE'` exists for that canonical id.

---

**`getSimilarMovies(movieId: string, limit = 20): Promise<SimilarTitleCard[]>`**

1. Load canonical movie by `movieId`; throw `NotFoundError` if absent.
2. Return cache hit if present.
3. Call `getMovieSimilar(tmdbId, 1)` and `getMovieRecommendations(tmdbId, 1)` in parallel.
4. Merge results, deduplicate by TMDB id, exclude the source movie's own tmdbId, cap at 40 candidates.
5. Query local DB: `SELECT id, tmdb_id, ... FROM movies WHERE tmdb_id = ANY(candidateTmdbIds)`.
6. For TMDB ids absent locally: call `materializeMovie(tmdbId)` for at most `MAX_MATERIALIZATIONS = 5` entries; log and skip on error; skip the rest silently.
7. Re-query local DB to include newly materialized rows.
8. Join with `movie_availabilities` to compute `isAvailable`.
9. Order by position in the TMDB candidate list (preserves TMDB ranking).
10. Store in cache; return first `limit` items.
11. **On `TmdbNetworkError` or any TMDB error at step 3:** log a warning; fall back to local genre query — `SELECT movies.* FROM movies JOIN movie_genres mg ON mg.movie_id = movies.id WHERE mg.genre_id = ANY(sourceGenreIds) AND movies.id != sourceId ORDER BY popularity DESC LIMIT limit` — compute `isAvailable` the same way, return result (no throw).

**`getSimilarSeries(seriesId: string, limit = 20): Promise<SimilarTitleCard[]>`**

Mirror of `getSimilarMovies` using series tables, `getSeriesSimilar`, `getSeriesRecommendations`, `materializeSeries`, `series_availabilities`.

---

### `apps/api/src/routes/moviesRoutes.ts`

Add to existing `moviesRoutes` function:

```
GET /:id/similar
```

- Public (no auth hook).
- Query param: `limit` (integer, 1–40, default 20); validate with Fastify JSON schema.
- Calls `similarTitlesService.getSimilarMovies(id, limit)`.
- `NotFoundError` → 404.
- Response: `{ items: SimilarTitleCard[] }`.

`SimilarTitlesService` instance is received as a route option (same DI pattern used by `discoveryRoutes`).

---

### `apps/api/src/routes/seriesRoutes.ts`

Add `GET /:id/similar` with the same structure, delegating to `similarTitlesService.getSimilarSeries`.

---

### `apps/api/src/index.ts`

- Instantiate `SimilarTitlesService(db, tmdbClient)` alongside existing services.
- Pass it to `moviesRoutes` and `seriesRoutes` registrations.

---

### `apps/api/src/services/__tests__/similar-titles-service.test.ts` (new file)

Vitest unit tests with `vi.mock` for `db` and `tmdbClient`:

| Scenario | What is verified |
|---|---|
| Movies — TMDB hit | TMDB similar + recommendations merged; duplicates removed by tmdbId; source movie excluded |
| Series — TMDB hit | Same for series |
| Zero-source titles | Items with no availability row appear with `isAvailable: false` |
| Materialization cap | Only `MAX_MATERIALIZATIONS` calls to `materializeMovie`; excess candidates silently dropped |
| Materialization error | Single `materializeMovie` failure skipped; other candidates still returned |
| TMDB network failure | No throw; fallback returns local genre-based movies |
| Cache hit | Second call with same tmdbId does not invoke TMDB client again |
| `limit` param | Response length ≤ `limit` |

---

### `apps/api/src/routes/__tests__/similar-titles.test.ts` (new file)

Fastify integration tests (same pattern as `watchlist.test.ts`):

- `GET /movies/:id/similar` → 200 with `{ items: [...] }` and correct card fields
- `GET /series/:id/similar` → 200 with correct shape
- Unknown movie id → 404
- Unknown series id → 404
- `limit=5` → at most 5 items returned
- `limit=0` or `limit=99` → validation 400

## Excluded

- Cross-type recommendations (movie → series or vice-versa).
- Profile-personalised ranking of similar results (no taste/feedback weighting applied).
- Additional TMDB signals beyond similar + recommendations (collections, keywords, cast — future ticket).
- Persistent DB caching of similar-title result lists (in-memory only).
- UI rendering of `Titres similaires` shelf (handled by T150).
- Any change to `recommendationRoutes`, `RecommendationRankingService`, or profile-based ranking.
- Backfilling similar-title lists for all existing catalog entries in bulk.

## Acceptance criteria

- `GET /movies/:id/similar` returns HTTP 200 with `{ items: SimilarTitleCard[] }` for any known canonical movie id.
- `GET /series/:id/similar` returns HTTP 200 with `{ items: SimilarTitleCard[] }` for any known canonical series id.
- Every card in `items` contains `id`, `tmdbId`, `title`, `posterPath`, `year`, `voteAverage`, `isAvailable`.
- No duplicate `tmdbId` values appear in a single response.
- Titles with zero availability rows are present in results with `isAvailable: false`.
- A TMDB 5xx or network timeout does not produce an HTTP 500; the endpoint returns a 200 with fallback items.
- A second request for the same title within 5 minutes does not emit TMDB HTTP calls (cache hit verified in tests).
- At most `MAX_MATERIALIZATIONS = 5` new local records are created per request; surplus missing candidates are skipped without error.
- `GET /movies/unknown-uuid/similar` returns HTTP 404.
- `GET /series/unknown-uuid/similar` returns HTTP 404.
- `limit` values outside 1–40 are rejected with HTTP 400.
- All new Vitest tests pass (`pnpm test --filter api`).
