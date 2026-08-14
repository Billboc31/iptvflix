## Objective

Fix Xtream VOD playback URL construction so that Movies and Episodes each use the correct provider path, and the `container_extension` already persisted in the database is consumed instead of silently forcing `.ts`.

## Included

### `apps/api/src/providers/xtream/playback.ts`
- Remove `buildXtreamStreamUrl`.
- Add `buildXtreamMovieUrl(baseUrl, username, password, providerItemId, containerExtension?: string | null): string` → `{base}/{user}/{pass}/{id}.{ext}` (fallback `ts`).
- Add `buildXtreamEpisodeUrl(baseUrl, username, password, providerItemId, containerExtension?: string | null): string` → `{base}/series/{user}/{pass}/{id}.{ext}` (fallback `ts`).
- Both functions strip trailing slash from `baseUrl`.

### `apps/api/src/services/playback-resolver.ts`
- Add `containerExtension: string | null` to the `AvailabilityRow` type.
- Update both branches of `fetchAvailabilities()` to select `containerExtension` from `movieAvailabilities` and `episodeAvailabilities` respectively.
- In the XTREAM URL branch inside `resolvePlayback()`, replace the single `buildXtreamStreamUrl` call with:
  - `mediaType === 'movie'` → `buildXtreamMovieUrl(...)` passing `selected.containerExtension`.
  - `mediaType === 'episode'` → `buildXtreamEpisodeUrl(...)` passing `selected.containerExtension`.
- Add a structured diagnostic `console.error` (no credentials) on the unknown-source-type fallthrough, logging: `mediaType`, `mediaId`, `availabilityId`, `providerId`, `providerItemId`, `containerExtension`.
- Update imports: replace `buildXtreamStreamUrl` with the two new functions.

### `apps/api/src/services/__tests__/playback-resolver.test.ts`
- Add `containerExtension?: string | null` to `makeAvailability` factory; default `null`.
- Replace `describe('buildXtreamStreamUrl', ...)` with:
  - `describe('buildXtreamMovieUrl', ...)`: strips trailing slash, respects `mp4`, respects `mkv`, falls back to `ts` when extension is `null`.
  - `describe('buildXtreamEpisodeUrl', ...)`: emits `/series/` prefix, respects extension, falls back to `ts`.
- Add integration tests in the `resolvePlayback` suite:
  - Movie with `containerExtension: 'mp4'` → URL ends in `.mp4`.
  - Movie with `containerExtension: 'mkv'` → URL ends in `.mkv`.
  - Movie with `containerExtension: null` → URL ends in `.ts` (fallback).
  - Episode → URL path contains `/series/`.
  - Explicit `availabilityId` selection with non-null extension.
- Update existing `makeAvailability` calls to include `containerExtension: null` (preserves existing assertions).

### Credential-safe logging
- Any new `console.error` in `playback-resolver.ts` must log only `mediaType`, `mediaId`, `availabilityId`, `providerId`, `providerItemId`, `containerExtension`, and error category. Never log `username`, `password`, or the constructed `streamUrl`.

## Excluded

- Live TV / IPTV stream URL construction (no live-TV path in the current resolver).
- Changes to `catalog-sync-service.ts`: episode `providerItemId` is already `XtreamEpisode.id` and `containerExtension` is already persisted for both movies and episodes.
- Frontend / player changes.
- Database migrations (no new columns needed; schema already has `container_extension`).
- Provider availability probing at resolve time (no HTTP round-trip to Xtream server).
- Changes to `seriesAvailabilities` (series-level rows are not used in playback resolution).
- M3U playback path changes.

## Acceptance criteria

- `buildXtreamMovieUrl` produces `{base}/{user}/{pass}/{id}.mp4` for `mp4`, `.mkv` for `mkv`, and `.ts` as fallback when extension is `null`.
- `buildXtreamEpisodeUrl` produces `{base}/series/{user}/{pass}/{id}.{ext}`.
- `resolvePlayback('movie', ...)` with `containerExtension: 'mp4'` returns a `streamUrl` ending in `.mp4`.
- `resolvePlayback('episode', ...)` returns a `streamUrl` containing `/series/`.
- `resolvePlayback` with `containerExtension: null` falls back to `.ts` without error.
- Explicit `availabilityId` selection works for both media types with the correct extension.
- Existing tests for disabled source, UNAVAILABLE status, resume position, and M3U pass unchanged.
- No log line in `playback-resolver.ts` or `providers/xtream/playback.ts` emits `username` or `password` values.
- `vitest` passes for `playback-resolver.test.ts` and Xtream playback unit tests.
