The implementation is complete and fully committed. Here's a summary of what was delivered for T062:

---

## T062 — Implementation Complete

The daemon from coder-attempt-1 fully implemented the plan across two commits (`9222420` + `74a7d4b`). All 74 new tests pass; the 10 pre-existing failures in `media-reconciliation-service.test.ts` are unrelated to this ticket.

### Files modified/created

| File | Change |
|---|---|
| `migrations/0026_episode_availability_container_extension.sql` | New migration — adds `container_extension` column |
| `src/db/schema/availabilities.ts` | `containerExtension` field on `episodeAvailabilities` |
| `src/services/catalog-sync-service.ts` | Variant fields on `NormalizedEpisodeItem`; `resolveEpisodeId` metadata upsert; `skipLifecycle` flag; episode INSERT/UPDATE stores all variant fields |
| `src/providers/metadata/types.ts` | `ExternalSeasonEpisode` interface; optional `getSeasonEpisodes` on `MetadataProvider` |
| `src/providers/metadata/tmdb/types.ts` | `TmdbSeasonEpisode` / `TmdbSeasonResponse` types |
| `src/providers/metadata/tmdb/client.ts` | `getSeasonEpisodes()` via `GET /tv/{id}/season/{n}` |
| `src/services/metadata-enrichment-service.ts` | `enrichSeriesSeasons()` method; called from `enrichSeries()` |
| `src/services/episode-backfill-service.ts` | New `EpisodeBackfillService` with `backfill({ force? })` / `getLatestState()` |
| `src/routes/reconcile.ts` | `POST /admin/episode-backfill` (202 fire-and-forget) + `GET /admin/episode-backfill/latest` |
| `src/index.ts` | Wires `EpisodeBackfillService` into the app |
| `src/services/__tests__/catalog-sync-service.test.ts` | 5 new tests: variant propagation, update on re-sync, multi-variant convergence, idempotency, newly-added episode |
| `src/services/__tests__/metadata-enrichment-service.test.ts` | 4 new tests: TMDB enrichment upserts, no-insert when no Xtream availability, early-exit on no tmdbId |
| `src/services/__tests__/episode-backfill-service.test.ts` | 6 new tests: zero-season pickup, skip when seasons exist, force mode, partial-failure isolation |
