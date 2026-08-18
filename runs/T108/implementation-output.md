All TypeScript errors are pre-existing in unrelated files (`authenticateDevice.test.ts`, `playback-session-store.test.ts`, `playback-resolver.ts`). My change introduced no new type errors.

The fix is done. Here's what changed in `apps/api/src/providers/metadata/tmdb/client.ts`:

**`fetchMovieFeed`** (lines 465–497):
- Added explicit `throw` at entry if `feed === 'airing_today'`
- Removed the `airing_today: '/tv/airing_today'` entry from the paths map
- Changed type to `Partial<Record<DiscoveryFeed, string>>` with a post-lookup null-guard
- Updated the `fetchWithRetry` call to use the local `path` variable

**`fetchSeriesFeed`** (lines 499–531):
- Added explicit `throw` at entry if `feed === 'now_playing'`
- Removed the `now_playing: '/movie/now_playing'` entry from the paths map
- Same `Partial<Record>` + null-guard pattern

The two cross-mapped entries were the root cause: if `DiscoveryCandidatePoolService.refreshPool` was called with `['airing_today']` × `['MOVIE', 'SERIES']`, the MOVIE branch would silently hit `/tv/airing_today` and insert series data with `mediaType: 'MOVIE'`. Now both functions fail fast with a descriptive error instead.
