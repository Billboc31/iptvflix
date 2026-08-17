# T087 — Browser / client playback probe

**Status: COMPLETE (inferred + network facts) — 2026-08-17**

No physical phone lab in this run; conclusions from codecs + HTTPS/mixed-content rules.

## Paths tested

### A — Direct `<video src>` / hls.js to provider URL (after IPTVFlix 302)

Provider front door: `https://cf.tviso.tech/movie/.../{id}.{ext}`  
Then **302 → `http://185.245.1.217/...`** (HTTP only; HTTPS on CDN **connection refused**).

| Client | Expected result |
|--------|-----------------|
| Desktop Chrome (HTTPS app) | **FAIL — mixed content**: HTTPS page cannot follow media to HTTP CDN |
| Android Chrome (HTTPS app) | **FAIL — same mixed content** |
| iPhone Safari (HTTPS app) | **FAIL — same mixed content** |
| Native app / VLC with URL | **PASS** if extension/codecs OK (no mixed-content policy) |

### B — Codec/container matrix (residential-proven)

| Variant | Ext | Video | Audio | Native HTML5 |
|---------|-----|-------|-------|--------------|
| Default 344921 | mkv | hevc 4K | aac 6ch | **No** (HEVC+MKV) |
| FR 1087985 | mkv | h264 1080p-ish | aac 6ch | **No** (MKV) |
| EN 336591 | **mp4** | **h264** | **aac** | **Yes if URL stayed HTTPS** |

### C — IPTVFlix forcing `.m3u8` (prod before fix)

Redirect Location ends in `.m3u8` → provider **551** → player error. **Not viable.**

## Credential exposure

**CONFIRMED** — `playback.ts` issues **302** with username/password in `Location`. Acceptable only as interim; must not remain the long-term web design.

## Summary

| Probe | Result |
|-------|--------|
| Desktop Chrome direct | FAIL — mixed content HTTP CDN (+ wrong ext / HEVC for default) |
| Android Chrome direct | FAIL — same |
| iPhone Safari direct | FAIL — same |
| EN h264/mp4 techniquement | Media OK; still blocked in HTTPS web by HTTP CDN hop |
