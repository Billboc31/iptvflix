31/31 pass. Implementation complete.

---

## Summary

**Files modified:**

### `apps/api/src/providers/xtream/playback.ts`
- Removed `buildXtreamStreamUrl`
- Added `buildXtreamMovieUrl` → `{base}/{user}/{pass}/{id}.{ext}` (fallback `ts`)
- Added `buildXtreamEpisodeUrl` → `{base}/series/{user}/{pass}/{id}.{ext}` (fallback `ts`)
- Both strip trailing slash from `baseUrl`

### `apps/api/src/services/playback-resolver.ts`
- Added `containerExtension: string | null` to `AvailabilityRow` type
- Both `fetchAvailabilities` branches now select `containerExtension` from their respective tables
- Replaced single `buildXtreamStreamUrl` call with media-type-aware dispatch: movie → `buildXtreamMovieUrl`, episode → `buildXtreamEpisodeUrl`, both passing `selected.containerExtension`
- Added credential-safe `console.error` on the unknown source-type fallthrough
- Updated import

### `apps/api/src/services/__tests__/playback-resolver.test.ts`
- Replaced `buildXtreamStreamUrl` unit tests with `buildXtreamMovieUrl` (7 tests) and `buildXtreamEpisodeUrl` (5 tests)
- Added `containerExtension` to `makeAvailability` factory (default `null`)
- Added `autoplayPreviews: false` to `EMPTY_PREFS` (fixes pre-existing TS gap)
- Added integration tests: movie with `mp4`/`mkv`/`null` extension, episode with `/series/` path, explicit availability with extension
