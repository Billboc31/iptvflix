# T087 — Validate a real Xtream VOD stream and choose the viable playback delivery architecture

## Objective

Run measured end-to-end probes against one real Xtream VOD stream from every network path (residential client, Railway runtime, desktop browser, Android Chrome, iPhone Safari) and produce an Architecture Decision Record that names a single viable production playback delivery architecture, with rejected alternatives documented by evidence.

## Included

### Phase 1 — Golden stream selection script

**File to create**: `scripts/find-golden-stream.ts`

A short Drizzle/psql script that queries the production database:

```sql
SELECT
  m.id AS movie_id, m.title,
  a.id AS availability_id, a.provider_item_id AS xtream_stream_id,
  a.container_extension, a.video_quality, a.audio_language,
  s.id AS source_id, s.name AS source_name, s.base_url
FROM movie_availabilities a
JOIN movies m ON a.movie_id = m.id
JOIN sources s ON a.provider_id = s.id
WHERE a.status = 'AVAILABLE'
  AND s.type = 'XTREAM'
  AND s.enabled = true
  AND a.container_extension IS NOT NULL
ORDER BY a.last_seen_at DESC
LIMIT 5;
```

Select one result with a non-null `container_extension`. Verify `buildXtreamMovieUrl()` in `apps/api/src/providers/xtream/playback.ts:4` produces the correct URL shape:

```
{base_url}/movie/{username}/{password}/{xtream_stream_id}.{container_extension}
```

**Artifact to create**: `runs/T087/golden-stream.md`
- movie ID, title
- availability ID
- source ID
- Xtream stream ID
- `container_extension`
- stored quality/language
- URL shape with username/password replaced by `[REDACTED]`
- confirmation that the URL shape matches the provider API

---

### Phase 2 — Residential/client network probe

From a local (non-datacenter) network, run each of these against the real URL constructed in Phase 1:

1. `curl -v -L --max-time 20 <url>` — capture HTTP status, redirect chain (credentials masked), Content-Type, first bytes
2. `ffprobe -v quiet -print_format json -show_streams -show_format <url>` — capture container, video codec/profile/resolution, audio codec, duration
3. `ffmpeg -i <url> -t 30 -f null -` — verify 30 seconds decode without error
4. VLC open of the URL — verify visible video + audio playback

**Artifact to create**: `runs/T087/probe-residential.md`
Record verbatim (sanitized) outputs for each command. Note: if VLC/ffmpeg fail at this step, stop and mark BLOCKED — provider URL or auth is broken before any browser or Railway testing.

**Provider HLS capability sub-test** (Phase 5 folded here):
- Replace extension with `.m3u8` in the URL and test with curl + ffprobe
- Note: also test `/movie/{user}/{pass}/{id}/index.m3u8` if the above 404s
- Record whether provider returns a valid HLS manifest or 404/403

---

### Phase 3 — Railway-side probe via diagnostic endpoint

The existing `GET /playback/diag/:availabilityId` endpoint (`apps/api/src/routes/playback.ts:382`) already HEAD-tests the upstream and runs ffprobe from Railway. Extend it **minimally** if the current output does not include:

- `upstreamHttpStatus` — already present
- `upstreamContentType` — **add** from HEAD response `content-type` header
- `upstreamIsMediaBody` — **add**: `true` if Content-Type starts with `video/` or `application/octet-stream`, `false` if it is `text/html` or `application/json`
- `upstreamRedirectFinalUrl` — **add**: final URL after redirects, with credentials masked (`[REDACTED]`)
- `detectedVideoCodec`, `detectedAudioCodec`, `detectedContainer` — already present from ffprobe

If these are already present via current code: no change needed. Check `apps/api/src/services/playback-diag.ts:17-32` against this list before writing new code.

Call the endpoint against the Railway deployment:
```
GET https://<railway-api-host>/playback/diag/<availability_id>
Authorization: Bearer <admin token>
```

**Artifact to create**: `runs/T087/probe-railway.md`
Record the full JSON response (no credentials). State whether `upstreamHttpStatus` is 200/206 (provider accessible from Railway) or 403/other (provider blocks Railway).

Explicitly assert: `RAILWAY_PROVIDER_BLOCK_CONFIRMED: true|false`

---

### Phase 4 — Direct browser tests

Test the raw provider URL directly in each browser (no IPTVFlix player involved):

- Desktop Chrome: open URL in address bar, open Network tab, record: HTTP status, CORS error (if any), Content-Type, media error message
- Android Chrome: same, using remote DevTools or manual screenshot
- iPhone Safari: open URL, record error (codec rejection, network error, 403, etc.)

**Artifact to create**: `runs/T087/probe-browsers.md`
For each browser, record each of:
- HTTP status
- CORS (`Access-Control-Allow-Origin` present or blocked)
- Mixed content blocked (HTTP vs HTTPS)
- Container rejection
- Codec rejection
- Redirect handling
- Any anti-hotlink / user-agent rejection

Do NOT collapse to "browser unsupported".

---

### Phase 5 — Architecture Decision Record

**Artifact to create**: `runs/T087/adr.md`

Structure:

```markdown
## Facts

| Probe | Result |
|-------|--------|
| Residential curl HTTP status | ... |
| Residential ffprobe codecs | video=... audio=... container=... |
| Residential ffmpeg 30s | PASS / FAIL |
| Residential VLC | PASS / FAIL |
| Provider-native HLS (.m3u8) | SUPPORTED / NOT SUPPORTED |
| Railway HTTP status | ... |
| Railway ffprobe | PASS / FAIL |
| RAILWAY_PROVIDER_BLOCK_CONFIRMED | yes / no |
| Desktop Chrome direct | PASS / exact error |
| Android Chrome direct | PASS / exact error |
| iPhone Safari direct | PASS / exact error |
| Credential exposure via 302 redirect | confirmed at playback.ts:126 |

## Architecture comparison

### A — Direct client → Xtream
...per measured results...

### B — Client → Railway → Xtream
...per measured results; mark NON-VIABLE if provider block confirmed...

### C — Client → dedicated relay → Xtream
...

### D — Hybrid
...

## Decision

Selected: [A / B / C / D]
Reason: [one paragraph, evidence-anchored]

## Rejected alternatives
...

## Credential strategy
Whether the selected architecture avoids exposing provider username/password in browser location, history, or network tab.

## Follow-up ticket scope
[Exact description of the next implementation work, specific enough that a coder can start without guessing]
```

---

### Credential exposure assessment

Document the existing 302 path in `apps/api/src/routes/playback.ts:126`. For the chosen architecture, explicitly state whether credentials appear in: browser address bar, Network DevTools tab, browser history, Referer header sent to provider.

---

## Excluded

- Any player code changes (HLS.js config, video element attributes, player UI)
- Any frontend changes
- Deploying new relay infrastructure (assessment only, no new Railway services)
- Testing Live TV or series streams
- Codec/container format changes in the playback pipeline
- Fixing playback (this ticket produces evidence and a decision, not a fix)
- Replacing the 302 fallback (that is the follow-up ticket)
- Testing M3U sources

## Acceptance criteria

- `scripts/find-golden-stream.ts` (or equivalent psql command) executes against the production DB and returns at least one AVAILABLE Xtream movie availability with a non-null `container_extension`.
- `runs/T087/golden-stream.md` exists with sanitized stream metadata and the confirmed URL shape (credentials redacted).
- `runs/T087/probe-residential.md` contains verbatim sanitized output from curl, ffprobe, ffmpeg -t 30, and a VLC result — each marked PASS or FAIL with the actual output or error.
- `runs/T087/probe-railway.md` contains the JSON response from `GET /playback/diag/:availabilityId` called against the Railway deployment. `RAILWAY_PROVIDER_BLOCK_CONFIRMED` is stated as `yes` or `no` with the actual HTTP status as evidence.
- `runs/T087/probe-browsers.md` records desktop Chrome, Android Chrome, and iPhone Safari direct-stream results, with each failure mode identified separately (CORS / mixed content / codec / redirect / provider block).
- Provider-native HLS capability is recorded in `probe-residential.md` as SUPPORTED or NOT SUPPORTED with evidence (HTTP status and Content-Type or manifest excerpt).
- `runs/T087/adr.md` exists and contains the facts table, all four architecture comparisons, exactly one selected architecture, rejected alternatives with reasons, a credential exposure assessment, and the follow-up ticket scope.
- No real Xtream username, password, or full stream URL is present in any artifact file.
- If Railway blocks the provider, `adr.md` explicitly marks Architecture B as non-viable for that source.
- The follow-up ticket scope in `adr.md` is specific enough to start implementation without further investigation.
