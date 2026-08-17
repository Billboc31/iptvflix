All implementation complete. Here is the summary:

---

## Implementation summary — T087

**Status: BLOCKED — requires manual execution of the probes**

### Files created

| File | Purpose |
|------|---------|
| `apps/api/scripts/find-golden-stream.ts` | NEW — queries production DB for the golden Xtream availability (sanitized output, no credentials committed) |
| `runs/T087/golden-stream.md` | Artifact template — fill in after running the script against Railway DATABASE_URL |
| `runs/T087/probe-residential.md` | Artifact template — fill in with curl/ffprobe/ffmpeg/VLC results from a residential network |
| `runs/T087/probe-railway.md` | Artifact template — fill in after calling the Railway diag endpoint |
| `runs/T087/probe-browsers.md` | Artifact template — fill in with Desktop Chrome / Android Chrome / iPhone Safari results |
| `runs/T087/adr.md` | ADR template — fill in after all probes, then make the architecture decision |

### Files modified

| File | Change |
|------|--------|
| `apps/api/src/services/playback-diag.ts` | Added `upstreamContentType`, `upstreamIsMediaBody`, `upstreamRedirectFinalUrl` to `PlaybackDiagResult` type and extraction logic. Credentials are masked from `upstreamRedirectFinalUrl` before the value is returned. |

### Pre-existing typecheck errors

Two test files (`authenticateDevice.test.ts`, `playback-session-store.test.ts`) have pre-existing TS errors unrelated to this ticket. My changes introduce no new errors.

---

### Manual steps required (in order)

1. **Phase 1** — Run the script against the Railway production DB:
   ```bash
   cd apps/api
   DATABASE_URL="<railway-pg-url>" npx tsx scripts/find-golden-stream.ts
   ```
   Fill in `runs/T087/golden-stream.md`.

2. **Phase 2** — From a residential network, run `curl`, `ffprobe`, `ffmpeg -t 30`, and VLC against the real URL. Fill in `runs/T087/probe-residential.md`. If VLC/ffmpeg fail → STOP, fix provider URL first.

3. **Phase 3** — Deploy this branch to Railway, then call:
   ```bash
   curl -H "Authorization: Bearer <token>" https://iptvflixapi-production.up.railway.app/playback/diag/<availability_id> | jq .
   ```
   Fill in `runs/T087/probe-railway.md`. The response now includes `upstreamContentType`, `upstreamIsMediaBody`, and `upstreamRedirectFinalUrl`. State `RAILWAY_PROVIDER_BLOCK_CONFIRMED: yes/no` from the actual HTTP status.

4. **Phase 4** — Test the raw provider URL in Desktop Chrome, Android Chrome, iPhone Safari. Fill in `runs/T087/probe-browsers.md` with each failure mode separately (not collapsed into "unsupported").

5. **Phase 8** — Fill in `runs/T087/adr.md` with the facts table and select exactly one architecture. The follow-up ticket scope section must be specific enough for a coder to start without further investigation.
