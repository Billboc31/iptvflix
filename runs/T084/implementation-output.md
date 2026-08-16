Implementation complete. Here's the summary:

---

**T084 committed** (`29df29e`) — 493 files changed.

**What was done:**
- Purged 465 generated `.js`/`.d.ts`/`dist/` files committed by T083 (root cause of blank UI regression)
- Restored full T082 HLS/DIRECT playback pipeline: `hls-session-store`, `media-prober`, `playback-compat`, `playback-session-store`, `probe-cache`, `playback.ts` gateway (5 endpoints), `playback-resolver.ts`
- Restored T082 API contracts (`gatewayUrl`/`deliveryMode` instead of `streamUrl`)
- Restored T082 frontend: `usePlayback.ts`, `PlayerPage.tsx`, `PlayerControls.tsx`, `useFeaturedMedia.ts`
- Split xtream provider into `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl`
- Added ffmpeg/ffprobe startup checks + `apps/api/nixpacks.toml`
- Restored 7 test files; all pass (486 web + 837 API tests green)
- T083 resilience additions (ErrorBoundary, ProtectedRoute spinner, PreviewContext matchMedia guard, AuthContext boot-flow) preserved intact

**BLOCKING: awaiting manual smoke test** — login flow + authenticated home UI rendering + playback cannot be automated. Requires a human to verify against a live environment before this branch is merged.
