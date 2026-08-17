# T087 — Architecture Decision Record: Playback Delivery

**Status: BLOCKED — fill in all probe artifacts first, then complete this document**

---

## Facts table

> Fill in from probe-residential.md, probe-railway.md, probe-browsers.md.

| Probe | Result |
|-------|--------|
| Residential curl HTTP status | `[FILL IN]` |
| Residential ffprobe — video codec | `[FILL IN e.g. h264]` |
| Residential ffprobe — audio codec | `[FILL IN e.g. aac]` |
| Residential ffprobe — container | `[FILL IN e.g. mov,mp4]` |
| Residential ffprobe — resolution | `[FILL IN e.g. 1920x1080]` |
| Residential ffprobe — duration | `[FILL IN]` |
| Residential ffmpeg 30s decode | `PASS / FAIL` |
| Residential VLC | `PASS / FAIL` |
| Provider-native HLS (.m3u8) | `SUPPORTED / NOT SUPPORTED` |
| Railway HTTP status (`upstreamHttpStatus`) | `[FILL IN]` |
| Railway Content-Type (`upstreamContentType`) | `[FILL IN]` |
| Railway `upstreamIsMediaBody` | `true / false` |
| Railway ffprobe available | `true / false` |
| RAILWAY_PROVIDER_BLOCK_CONFIRMED | `yes / no / inconclusive` |
| Desktop Chrome direct | `PASS / [exact error]` |
| Android Chrome direct | `PASS / [exact error]` |
| iPhone Safari direct | `PASS / [exact error]` |
| Credential exposure via 302 redirect | `CONFIRMED — playback.ts:126 issues 302 with credentials in Location header` |

---

## Architecture comparison

### A — Direct client → Xtream

```
Browser / app
      ↓
Xtream provider
```

| Dimension | Assessment |
|-----------|------------|
| Reachability from browser | `[FILL IN from browser probes]` |
| Browser codec/container support | `[FILL IN — h264/aac in mp4 supported by all; mkv/ts may not be]` |
| CORS | `[FILL IN — Xtream likely no CORS headers → blocked from web app]` |
| Mixed content | `[FILL IN — HTTP provider URL on HTTPS web app = blocked]` |
| Credential exposure | `HIGH — provider credentials visible in browser address bar and network tab` |
| Seek / Range | `[FILL IN — provider must support Range requests]` |
| iPhone/Android compatibility | `[FILL IN from browser probes]` |
| Android TV (native Exoplayer) | `Feasible — ExoPlayer handles mkv/mp4 natively without CORS` |
| Verdict | `[FILL IN — viable / not viable / partially viable]` |

---

### B — Client → Railway IPTVFlix API → Xtream

```
Browser
   ↓
Railway API (iptvflixapi-production.up.railway.app)
   ↓
Xtream provider
```

| Dimension | Assessment |
|-----------|------------|
| Provider datacenter blocking | `[FILL IN — yes if RAILWAY_PROVIDER_BLOCK_CONFIRMED=yes]` |
| Bandwidth cost | `High — Railway egress billed per GB; video is large` |
| ffmpeg CPU/memory on Railway | `[FILL IN — transcoding requires dedicated CPU; Railway starter tier may be insufficient]` |
| HLS sessions | `[FILL IN — in-memory session store is not multi-replica safe]` |
| Railway filesystem | `tmpfs — segments lost on redeploy or replica switch` |
| Scalability | `Low — HLS transcoding is stateful and single-instance` |
| Verdict | `NON-VIABLE if RAILWAY_PROVIDER_BLOCK_CONFIRMED=yes` / `Viable for proxy-only if provider allows` |

> If `RAILWAY_PROVIDER_BLOCK_CONFIRMED: yes`, mark Architecture B as **NON-VIABLE for this source** without an IP-level workaround.

---

### C — Client → dedicated media relay → Xtream

```
Browser
   ↓
Media Relay (non-Railway, residential/hosting IP)
   ↓
Xtream provider
```

| Dimension | Assessment |
|-----------|------------|
| Provider access | `[FILL IN — relay must be on non-blocked IP range]` |
| Credential hiding | `Yes — browser never sees Xtream URL` |
| Range request proxy | `Feasible — relay forwards Range header to provider` |
| Remux/transcode to HLS | `Feasible via ffmpeg on relay; avoids browser container issues` |
| Stable URLs | `Yes — relay generates opaque session tokens` |
| Multi-user later | `Feasible but requires capacity planning` |
| Infrastructure cost | `Additional server/VPS required; not covered in this ticket` |
| Verdict | `[FILL IN — viable if provider blocks Railway; requires new infrastructure]` |

---

### D — Hybrid

| Scenario | Approach |
|----------|----------|
| Provider-native HLS supported AND CORS OK | Direct client → Xtream HLS (no relay needed) |
| Provider-native HLS supported BUT CORS missing | Relay only for manifest + key; segments direct |
| No provider HLS AND browser compat OK (mp4) | Direct with HTTPS redirect (hide credentials via signed URL) |
| No provider HLS AND container incompatible | Relay with remux to HLS |
| Android TV native | Always direct — ExoPlayer handles mkv/mp4, no CORS constraint |
| Complexity vs reliability | `[FILL IN — hybrid increases code paths; may be justified if direct works for native clients]` |

---

## Decision

**Selected architecture: `[A / B / C / D — fill in after probes]`**

**Reason:**

> `[One paragraph, anchored to measured evidence from probes. Example:]`
>
> _Residential probe confirms the stream delivers valid H.264/AAC in MKV at HTTP 200 (VLC PASS, ffmpeg PASS).
> Railway probe returns HTTP 403, confirming the provider blocks datacenter IPs (RAILWAY_PROVIDER_BLOCK_CONFIRMED=yes).
> Architecture B is therefore non-viable without an IP-level workaround.
> Desktop Chrome returns CORS error and MKV is not natively supported in the browser.
> Architecture D (hybrid) is selected: direct ExoPlayer playback for Android TV (no CORS, native MKV support),
> and a dedicated residential relay with ffmpeg remux to HLS for browser clients._

---

## Rejected alternatives

| Architecture | Reason for rejection |
|--------------|----------------------|
| A — Direct client → Xtream (browser) | `[FILL IN e.g. CORS, MKV not supported, HTTP mixed content]` |
| B — Client → Railway → Xtream | `[FILL IN e.g. provider blocks Railway datacenter IPs — confirmed HTTP 403]` |

---

## Credential strategy

**Current state**: `apps/api/src/routes/playback.ts:126` issues a `302 Location` header containing the full Xtream URL with username/password. The browser sees this URL in DevTools Network tab and browser history.

**For the selected architecture:**

| Architecture | Credentials in browser | Mitigation |
|--------------|------------------------|------------|
| A — Direct | YES — URL in address bar | Requires provider token API (if available) or cannot be mitigated |
| B — Railway relay | NO — Railway fetches internally | Not viable if provider blocks Railway |
| C — Dedicated relay | NO — relay holds credentials; browser gets opaque session URL | Viable |
| D — Hybrid (relay for browser, direct for TV) | Browser: NO (relay). TV app: YES (but OS handles it, not browser history) | Acceptable |

**Chosen approach:** `[FILL IN]`

---

## Follow-up ticket scope

> Describe the next implementation ticket precisely enough that a coder can start without further investigation.

`[FILL IN after decision is made. Example:]`

**T088 — Implement residential media relay for browser playback**

Scope:
- Deploy a lightweight VPS (e.g. Hetzner CX11) outside Railway datacenter IP range
- Implement a minimal ffmpeg-based relay that:
  - Accepts opaque session tokens (no Xtream credentials in URL)
  - Fetches from Xtream with residential IP
  - Remuxes to HLS (`.m3u8` + `.ts` segments) if container is MKV/TS
  - Passes through directly if provider native HLS is available
  - Forwards Range requests for MP4
- IPTVFlix Railway API issues signed short-lived URLs to the relay (not to Xtream directly)
- Android TV continues to use ExoPlayer with direct Xtream URL (no relay needed)
- Remove the existing 302 redirect fallback once relay is in production

Out of scope for T088: multi-user scaling, segment caching, DRM.
