All acceptance criteria are met:

- **555 tests pass**, zero regressions. The 9 suites showing `(0 test)` are pre-existing integration tests that require a live database (`DATABASE_URL` not set) — untouched by our changes.
- **`packages/api-contracts` type-checks cleanly** (zero errors).
- **`apps/api` has two pre-existing TS errors** in `authenticateDevice.test.ts` and `playback-resolver.test.ts` — both files have `git diff HEAD` output of nothing (we never touched them).

Summary of what was implemented across this session:

| File | Change |
|------|--------|
| `apps/api/migrations/0029_tmdb_first_catalog.sql` | New migration: `collections` table + 30+ new columns across movies/series/seasons/episodes/genres |
| `apps/api/migrations/meta/_journal.json` | Added idx:29 entry |
| `apps/api/src/db/schema/collections.ts` | New schema file |
| `apps/api/src/db/schema/{movies,series,seasons,episodes,genres}.ts` | New JSONB-typed columns |
| `apps/api/src/providers/metadata/tmdb/types.ts` | 8 new TMDB interface types + extended movie/series/episode detail types |
| `apps/api/src/providers/metadata/tmdb/client.ts` | `append_to_response=keywords,external_ids` + full field mapping |
| `apps/api/src/providers/metadata/types.ts` | New optional fields on `ExternalMovieMetadata`, `ExternalSeriesMetadata`, `ExternalSeasonEpisode` |
| `apps/api/src/services/metadata-enrichment-service.ts` | Collection upsert, enriched UPDATE sets, season sync, typed `upsertGenres` |
| `packages/api-contracts/src/catalog.ts` | Expanded `MovieResponse`, `SeriesResponse`, `EpisodeResponse` |
| `apps/api/src/routes/catalog.ts` | Full response builders with all new fields + conditional collection query |
| `apps/api/src/services/catalog-service.ts` | All list/detail/search mappers updated |
