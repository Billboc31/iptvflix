# Phase 2 — Xtream VOD URL Semantics

**Status: COMPLETE**

## Findings

`buildXtreamMovieUrl()` in `apps/api/src/providers/xtream/playback.ts` produces:

```
{baseUrl}/movie/{username}/{password}/{streamId}.{containerExtension}
```

- Pattern matches the Xtream Codes VOD standard: `/movie/{user}/{pass}/{streamId}.{ext}`
- `containerExtension` is embedded verbatim from the `movieAvailabilities.container_extension` DB column
- No live-TV URL shape (`/live/`) is used for VOD movies
- Episodes use `/series/{user}/{pass}/{streamId}.{ext}` (separate function, separate prefix)

## URL shape in the resolver

The playback resolver (`apps/api/src/services/playback-resolver.ts`) overrides the extension to `m3u8` for all Xtream sources at resolve time:

```typescript
const playbackExt = 'm3u8'
providerStreamUrl = buildXtreamMovieUrl(source.baseUrl, ..., playbackExt)
providerStreamUrl = browserSafeXtreamUrl(providerStreamUrl)  // upgrades to HTTPS
```

**Rationale:** Redirecting the browser directly to the provider's HLS URL avoids proxying through Railway (which Cloudflare blocks with 403 for datacenter IPs). The browser fetches HLS directly from the Xtream panel.

**Implication for playback:** The browser must be able to reach the Xtream panel's HTTPS endpoint directly. If the provider's HLS endpoint is behind Cloudflare and blocks datacenter IPs, playback works because it's the browser (residential/mobile IP) that makes the final request.

## Tests added

File: `apps/api/src/providers/xtream/__tests__/xtream-vod-url.test.ts`

- 18 tests covering:
  - `/movie/` prefix for movies, `/series/` for episodes
  - `containerExtension` verbatim embedding (mkv, mp4, ts, m3u8)
  - Fallback to `.ts` when extension is null/omitted
  - Trailing slash stripping from baseUrl
  - Port preservation
  - Strict separation: movie URL ≠ episode URL

All 18 tests pass.
