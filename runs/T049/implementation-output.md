Both fixes are complete. Here's what was done:

---

**Fix #1 — M3U fetch errors now produce FAILED run records**

`apps/api/src/services/sync-runs-service.ts`:
- Added import for `M3UAuthError`, `M3UNetworkError`, `M3UParseError`
- Wrapped `fetchM3USnapshot` in a try/catch inside `triggerSync`; when any M3U-specific error is caught, a FAILED run record is inserted into the database and returned — so the caller always gets a traceable sync run, never an HTTP 500

**Fix #2 — e2e M3U fixture server and tests**

`e2e/fixtures/m3u-server.ts` *(new)*:
- HTTP server with 4 modes: `happy` (valid playlist with 2 movies + 1 episode), `auth-fail` (401), `empty` (#EXTM3U only), `malformed` (HTML response)
- Supports range requests (used by `testConnection`)

`e2e/global-setup.ts`:
- Starts 4 M3U fake servers on ports 9992–9995 alongside the existing Xtream servers

`e2e/fixtures/index.ts`:
- Extended `FakeServers` with `m3uHappy`, `m3uAuthFail`, `m3uEmpty`, `m3uMalformed`

`e2e/tests/m3u-sync.spec.ts` *(new)*:
- 3 API-level tests: happy path (DONE, `moviesAdded > 0`), idempotence (second sync `moviesAdded === 0`), malformed content (FAILED with non-null error)

All 594 unit tests still pass. No TS errors in the changed files.
