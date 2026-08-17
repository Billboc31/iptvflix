# T087 — Architecture Decision Record: Playback Delivery

**Status: DECIDED — 2026-08-17 (evidence-backed)**

---

## Facts table

| Probe | Result |
|-------|--------|
| Residential curl HTTP status | **206** on `.mkv`/`.mp4`; **551** on `.m3u8`/`.ts` |
| Residential ffprobe — video codec | Default: **hevc**; EN alt: **h264** |
| Residential ffprobe — audio codec | **aac** |
| Residential ffprobe — container | Default: **matroska**; EN: **mp4** |
| Residential ffprobe — resolution | Default: **3840×1608**; EN: **1920×800** |
| Residential ffprobe — duration | ~8889 s |
| Residential ffmpeg 15s decode | **PASS** |
| Residential VLC | Not run (ffmpeg PASS) |
| Provider-native HLS (.m3u8) | **NOT SUPPORTED** (551) |
| Railway HTTP status | **403** |
| Railway Content-Type | `text/plain` (not media) |
| Railway `upstreamIsMediaBody` | **false** |
| Railway ffprobe available | **true** (unused) |
| RAILWAY_PROVIDER_BLOCK_CONFIRMED | **yes** |
| Desktop Chrome direct | **FAIL** (HTTP CDN mixed content) |
| Android Chrome direct | **FAIL** (same) |
| iPhone Safari direct | **FAIL** (same) |
| Credential exposure via 302 | **CONFIRMED** |

---

## Architecture comparison

### A — Direct client → Xtream

| Dimension | Assessment |
|-----------|------------|
| Reachability from browser network | **Yes** (residential OK) |
| Browser codec/container | Only some variants (h264+aac+**mp4**); default is HEVC+MKV |
| CORS | `*` on panel/CDN — OK for XHR if needed |
| Mixed content | **Fatal for HTTPS web** — CDN is **HTTP-only** (`185.245.1.217`) |
| Credential exposure | **HIGH** via 302 Location |
| Verdict | **NOT VIABLE for HTTPS web app**. Viable for native players / VLC. |

### B — Client → Railway API → Xtream

| Dimension | Assessment |
|-----------|------------|
| Provider datacenter blocking | **Yes — 403 Cloudflare** |
| ffmpeg on Railway | Present but useless without upstream bytes |
| Verdict | **NON-VIABLE** for this source without IP allowlisting / non-CF path |

### C — Dedicated media relay (outside Railway)

```
Browser (HTTPS)
   ↓
Media relay (HTTPS, non-datacenter or allowlisted IP)
   ↓
Xtream / CDN (HTTP OK server-side)
```

| Dimension | Assessment |
|-----------|------------|
| Bypass CF block | **Required** — host must not look like blocked datacenter, or use allowlisted egress |
| Terminate HTTPS | **Required** — remux/proxy so browser never hits HTTP CDN |
| Remux | Remux MKV→fMP4/HLS; transcode HEVC when needed |
| Credentials | Stay on relay; never in browser |
| Verdict | **VIABLE — chosen production direction** |

### D — Hybrid (interim)

| Path | Strategy |
|------|----------|
| Web HTTPS | Relay (C) only |
| Native / TV | May use direct provider URLs with correct extension |
| Variant pick | Prefer **mp4 + non-4K** when choosing default availability |

---

## Decision

**Choose C (dedicated HTTPS media relay) as the production architecture for web playback**, with hybrid D as interim:

1. **Stop pretending Railway can proxy this Xtream panel** (403 confirmed).
2. **Stop forcing `.m3u8`** — use catalog `container_extension`; prefer **mp4** variants in selection.
3. **Keep browser 302 redirect only as a degraded/native path**, not as the web solution (mixed content + credential leak).
4. **Next ticket**: provision a small media relay (VPS / Fly.io / non-Railway) that:
   - fetches Xtream with residential-like egress;
   - serves HLS or progressive MP4 over HTTPS to IPTVFlix;
   - optionally remuxes with ffmpeg.

## Immediate code follow-ups (this change set)

- Restore real container extension in resolve (no forced m3u8).
- Prefer `mp4` containers in `resolveVariant` scoring.

## Follow-up ticket scope

> T088 — Deploy HTTPS media relay for Xtream VOD (bypass Cloudflare datacenter block + terminate TLS for HTTP CDN)
