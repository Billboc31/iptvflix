Done. Here's a summary of what was cleaned up:

**Deleted (T082 new files):**
- 13 backend service/test files (`hls-session-store`, `media-prober`, `playback-compat`, `playback-session-store`, `probe-cache`, scripts, tests)
- `apps/api/nixpacks.toml`
- `e2e/tests/playback.spec.ts`
- `apps/web/src/components/player/PlayerControls.tsx` + compiled artifacts

**Reverted to main (T082 modified files):**
- `apps/api/src/routes/playback.ts` (−256 stream proxy lines)
- `apps/api/src/services/playback-resolver.ts`
- `apps/api/src/index.ts`, `availability-resolver.ts`, `xtream/playback.ts`
- `packages/api-contracts/src/playback.ts` (restores `streamUrl`, removes `gatewayUrl`/`deliveryMode`)
- `apps/web/src/hooks/usePlayback.ts`, `useProgressSync.ts`, `pages/PlayerPage.tsx`
- `e2e/fixtures/xtream-server.ts`

**Untracked:** `node_modules/.vite/vitest/results.json` from both apps; committed `dist/` artifacts.

**Preserved intact:** all 7 T083-approved fixes (PreviewContext guard, ErrorBoundary, App.tsx, ProtectedRoute spinner, AuthContext catch, test setup mock, handlers split).

**Tests:** 480/480 web pass; 5 API failures are pre-existing on `main`.
