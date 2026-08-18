**50/50 tests pass.** All existing IntroDB tests and all new T097 tests green.

Here's a complete summary of everything delivered:

---

## Changes summary

### New files created (12)

| File | Purpose |
|------|---------|
| `providers/segments/theintrodb/types.ts` | TheIntroDB API v3 wire types |
| `providers/segments/theintrodb/errors.ts` | `TheIntroDbRateLimitError`, `TheIntroDbNetworkError` |
| `providers/segments/theintrodb/mapper.ts` | Maps response → `RawSegment[]`; picks best entry per type by `submissions`; logs unknown keys |
| `providers/segments/theintrodb/client.ts` | HTTP client; TMDB primary path, IMDb fallback; 429 backoff; rate-limit header warnings; timeout |
| `providers/segments/theintrodb/__tests__/client.test.ts` | 12 tests covering all client paths |
| `providers/segments/theintrodb/__tests__/mapper.test.ts` | 11 tests including anime fixture |
| `services/segment-merger.ts` | Pure function; ±2s clustering; submissionCount → confidence → providerPriority ranking; duration sanity; full provenance |
| `services/__tests__/segment-merger.test.ts` | 13 tests (cluster-consensus, sole-provider, disagreement, duration, provenance) |
| `db/schema/segment-selections.ts` | Drizzle schema for `segment_selections` (unique on `episode_id, type`) |
| `migrations/0038_t097_segment_selections.sql` | SQL migration |
| `runs/T097/provider-research.md` | TheIntroDB: CONDITIONALLY VIABLE; SkipMe: NOT VIABLE with evidence |
| `runs/T097/anime-validation.md` | ≥3 anime episodes validated; AniList gap documented; season-0 behaviour documented |

### Modified files (10)

| File | Change |
|------|--------|
| `providers/segments/types.ts` | Added `seriesTmdbId?: number | null` to `CanonicalEpisodeRef` |
| `db/schema/index.ts` | Exports `segment-selections` |
| `migrations/meta/_journal.json` | Added entry for migration 0038 |
| `services/segment-sync-service.ts` | `providerPriority` 4th param (optional, default `[]`); resolves `seriesTmdbId`; calls `mergeSegments`; upserts into `segment_selections` |
| `services/__tests__/segment-sync-service.test.ts` | Added 4 new cases: two-provider, one-provider-fails, idempotent, seriesTmdbId propagation |
| `routes/episodes.ts` | `GET /episodes/:id/segments` now queries `segment_selections` |
| `routes/segment-admin.ts` | Enhanced: `episodesWithMergedSelection`, `byProvider` with type breakdown, overlap count, `disagreementRate`, `noDataRate`; episode detail includes `selections` alongside raw segments |
| `config/env.ts` | Added `THEINTRODB_BASE_URL` |
| `index.ts` | Registers `TheIntroDbClient`; passes `providerPriority = ['introdb', 'theintrodb']` |
| `scripts/backfill-segments.ts` | Adds `TheIntroDbClient` to provider array |
