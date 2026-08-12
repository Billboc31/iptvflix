All 12 tests green, no regressions introduced. Here's the implementation summary:

---

## Files created / modified

| File | Action |
|---|---|
| `packages/api-contracts/src/recommendations.ts` | **New** — `RecommendationSource`, `RecommendationCandidate`, `RecommendationsResponse` types |
| `packages/api-contracts/src/index.ts` | **Modified** — added `export * from './recommendations.js'` |
| `apps/api/src/services/recommendation-ranking-service.ts` | **New** — `rankRecommendations()` function |
| `apps/api/src/routes/recommendations.ts` | **New** — `GET /profiles/:profileId/recommendations` Fastify plugin |
| `apps/api/src/services/__tests__/recommendation-ranking-service.test.ts` | **New** — 12 tests covering all 9 plan scenarios |
| `apps/api/src/index.ts` | **Modified** — import + register `recommendationRoutes` |

## Key design decisions

- **10 parallel DB queries** in one `Promise.all`: profile check, taste row, movies, series, movie genres, series genres, discovery candidates, movie availabilities, series availabilities, viewing progress. This keeps the mock order deterministic and predictable in tests.
- **Cold-start**: no taste row or `signalCount === 0` → score = `popularity × voteAverage`; all reasons = `["popular pick"]`.
- **Dedup**: discovery candidates whose `canonicalMovieId`/`canonicalSeriesId` is already in the local set are skipped; local wins.
- **Seen-content**: completed movies (progress ≥ 90%) receive −10 score penalty unless `includeSeen=true`. Series: no suppression (documented in plan).
- **Determinism**: `ORDER BY score DESC, mediaId ASC` (UUID tiebreaker).

## Pre-existing failure

`title-matching-service.test.ts` has one flaky integration test failing due to a leftover DB row (`tmdb_id = 603` already exists). This failure predates this branch and is unrelated to T041.
