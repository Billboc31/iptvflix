Now I have all the context needed. Here is the plan:

---

## Objective

Introduce a provider-independent `resolveSeriesId()` function in the sync path that reuses an existing canonical `series` row when a reliable external identifier (TMDB ID) matches, mirroring the pattern already used for Movies. Without a confident identifier match, a new canonical row is created as before.

## Included

### `apps/api/src/services/catalog-sync-service.ts`

- **`NormalizedSeriesItem`** (line 50): add `tmdb?: string` field, mirroring `NormalizedMovieItem`.

- **`resolveSeriesId(tx, item)`** (new function, alongside `resolveMovieId`):
  - If `parseTmdbId(item.tmdb)` returns a value:
    1. `SELECT id FROM series WHERE tmdb_id = $1 LIMIT 1` — return immediately if found.
    2. `INSERT INTO series … ON CONFLICT (tmdb_id) DO NOTHING RETURNING id` — return if inserted.
    3. Re-`SELECT` to handle concurrent insert race.
  - If no TMDB ID: `INSERT INTO series …` unconditionally and return the new id (preserves current behaviour for unidentified items).

- **Series sync loop** (lines 356–378): replace the inline `tx.insert(series)` block with a call to `resolveSeriesId(tx, s)`, then upsert `seriesAvailabilities` linked to the resolved id.

- **Xtream normalizer** (lines 596–609, `series:` mapping): add `tmdb: seriesInfoEntry?.info.tmdb_id` for each series, where `seriesInfoEntry` is looked up from `snapshot.seriesInfo` by `s.series_id` (already available; `tmdb_id` must be added to the types — see below). If `seriesInfo` is absent or the entry is missing, the field is `undefined`.

- **Plex normalizer** (lines 625–631, `series:` mapping): add `tmdb: extractPlexTmdbId(s.Guid)`. `extractPlexTmdbId` already exists for movies; Plex shows carry the same `Guid[]` array.

### `apps/api/src/providers/xtream/types.ts`

- **`XtreamSeriesDetail`**: add `tmdb_id?: string`. The Xtream `get_series_info` API returns this field in its `info` block. Adding it to the type allows the Xtream normalizer to pass it through without any logic change elsewhere.

### `apps/api/src/services/__tests__/catalog-sync-service.test.ts`

Four new integration test cases (real DB, existing file conventions):

1. **Cross-provider reuse** — sync an Xtream series with a known TMDB ID, then sync the same TMDB ID via a Plex snapshot; assert exactly one `series` row and two `seriesAvailabilities` rows in the DB.

2. **Plex-only new series** — sync a Plex show with a TMDB ID not present in the DB; assert one new `series` row and one `seriesAvailabilities` row.

3. **Same-title ambiguity without TMDB ID** — sync two series from different providers that share a title but have no TMDB ID; assert two distinct `series` rows are created (no silent merge).

4. **Repeat sync idempotency** — run the same Plex snapshot twice; assert no additional `series` or `seriesAvailabilities` rows after the second run.

## Excluded

- Season and episode availability ingestion (tracked separately).
- Title-based fuzzy matching as a merge signal (existing `TitleMatchingService` pipeline is post-sync enrichment; this ticket does not change when or how it runs).
- Manual metadata correction UI.
- Recommendation logic.
- Any change to `syncPlexCatalog`'s episode handling.
- Fetching or storing additional Plex metadata fields beyond what the existing `PlexShowItem` type already captures.

## Acceptance criteria

- A series known from Xtream (with `tmdb_id` in its `seriesInfo`) can gain a Plex `seriesAvailability` row without creating a second `series` canonical row when both sides share the same TMDB ID.
- A Plex-only show (no prior canonical match) creates exactly one new `series` row and one `seriesAvailabilities` row.
- Two series with the same title but no TMDB ID from two different providers each produce a separate `series` canonical row.
- Re-running the same Plex snapshot produces no additional `series` or `seriesAvailabilities` rows.
- `NormalizedSeriesItem.tmdb` is populated from Plex `Guid[]` and from Xtream `seriesInfo[].info.tmdb_id`; no Plex-specific logic appears inside `resolveSeriesId`.
- All four new test cases pass with `vitest`.
- Movie sync behaviour is unchanged; existing tests remain green.
