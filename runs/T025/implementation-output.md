Implementation complete. Here's a summary of what was changed:

---

## Changes

**`apps/api/src/providers/xtream/types.ts`**
- Added `tmdb_id?: string` to `XtreamSeriesDetail` — the field the Xtream `get_series_info` API returns in its `info` block.

**`apps/api/src/services/catalog-sync-service.ts`**
- Added `tmdb?: string` to `NormalizedSeriesItem`, mirroring `NormalizedMovieItem`.
- Added `resolveSeriesId(tx, item)` — identical pattern to `resolveMovieId`: if a parsed TMDB ID is present, SELECT first, then INSERT with `ON CONFLICT DO NOTHING`, then re-SELECT for concurrent-insert safety; without a TMDB ID, inserts unconditionally (preserving existing behaviour).
- Replaced the inline `tx.insert(series)` block in the series sync loop with a call to `resolveSeriesId`.
- Xtream normalizer: populates `tmdb` from `snapshot.seriesInfo?.[s.series_id]?.info.tmdb_id`.
- Plex normalizer: populates `tmdb` from `extractPlexTmdbId(s.Guid)` (already existed for movies; Plex shows carry the same `Guid[]` array).

**`apps/api/src/services/__tests__/catalog-sync-service.test.ts`**
- Added 4 new integration test cases under `describe('canonical Series identity resolution')`:
  1. Cross-provider reuse (Xtream + Plex, shared TMDB ID → 1 canonical row, 2 availabilities)
  2. Plex-only new series (no prior match → 1 new row)
  3. Same-title ambiguity without TMDB ID (2 distinct canonical rows, no silent merge)
  4. Repeat sync idempotency (no duplicate rows after second Plex sync)

All 18 tests pass; no new TypeScript errors introduced.
