All changes are clean. Here's a summary of everything implemented:

---

## Summary

### Bloquant 1 — HLS detection fixed
- **`packages/api-contracts/src/playback.ts`** — Added `containerExtension: string` to `PlaybackSessionResponse`
- **`apps/api/src/services/playback-resolver.ts`** — Returns `containerExtension` in the session response (was already a local const, just not included in the return value)
- **`apps/web/src/hooks/usePlayback.ts`** — Exposes `containerExtension` from state
- **`apps/web/src/pages/PlayerPage.tsx`** — HLS detection now uses `containerExtension?.toLowerCase() === 'm3u8'` instead of checking `gatewayUrl.includes('.m3u8')` (which was always false)

### Bloquant 2 — HLS segment URL rewriting
- **`apps/api/src/routes/playback.ts`** — Added `rewriteHlsManifest()` helper that rewrites segment URIs (including `URI="..."` attributes in `#EXT-X-KEY` etc.) to point at a new segment proxy sub-route; added `GET /playback/stream/:sessionId/segment?uri=<base64url>` endpoint that validates the session, decodes the segment URL, and proxies bytes from the provider — keeping credentials server-side

### Mineur — Transfer-Encoding removed
- **`apps/api/src/routes/playback.ts`** — Removed `reply.header('Transfer-Encoding', 'chunked')` from the fmp4 remux path

### Mineur — console.info spy added
- **`apps/api/src/services/__tests__/playback-resolver.test.ts`** — Added `vi.spyOn(console, 'info')` alongside the existing `log`/`error` spies in the secret redaction test

### E2E test created
- **`e2e/fixtures/xtream-server.ts`** — Extended to serve fake stream bytes (200 + content-type) for paths like `/:user/:pass/:id.ext`
- **`e2e/tests/playback.spec.ts`** — API-level smoke test: create source → sync → list movies → resolve playback (asserts `gatewayUrl` pattern + `containerExtension: 'mp4'`) → GET gateway stream (asserts 200 + `video/mp4`) + asserts credentials not in gatewayUrl; plus a 404 test for expired sessions

All 46 T078 unit tests continue to pass. Pre-existing unrelated failures are unchanged.
