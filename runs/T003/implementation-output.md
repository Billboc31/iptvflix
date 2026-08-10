Implementation complete. Here's a summary:

## T003 — Implementation Done

**Files created:**

| File | Purpose |
|---|---|
| `schema/genres.ts` | `genres` table |
| `schema/movies.ts` | `movies` + `movie_genres` junction |
| `schema/series.ts` | `series` + `series_genres` junction |
| `schema/seasons.ts` | `seasons` with UNIQUE `(series_id, season_number)` |
| `schema/episodes.ts` | `episodes` with denormalized `series_id`, UNIQUE `(season_id, episode_number)` |
| `schema/availabilities.ts` | `movie_availabilities` + `episode_availabilities` with `first_seen_at`/`last_seen_at` and UNIQUE `(item_id, provider_id, provider_item_id)` |
| `migrations/0001_sweet_stingray.sql` | Generated migration — 9 new tables |
| `db/__tests__/catalog-constraints.test.ts` | 6 integration tests |

**Files modified:**

- `schema/index.ts` — added re-exports for all 6 new modules

**Results:** 9/9 tests pass (`pnpm --filter api test`). Migration applied cleanly. State advanced to `IMPLEMENTATION_REVIEW_NEEDED`.
