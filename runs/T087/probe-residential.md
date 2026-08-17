# T087 — Residential / client-network probe

**Status: COMPLETE — 2026-08-17 (Mac, network MRS / residential-like)**

Golden: Spider-Man: No Way Home / stream `344921` (and EN alt `336591`).

## curl (Range)

| URL shape | HTTP | Content-Type | Notes |
|-----------|------|--------------|-------|
| `.../344921.m3u8` | **551** | — | Not usable |
| `.../344921.ts` | **551** | — | Not usable |
| `.../344921.mkv` | **206** | `video/x-matroska` | Works; 302 → `http://185.245.1.217/live/play/[TOKEN]/344921` |
| `.../336591.mp4` (EN) | **206** | `video/mp4` | Works; same CDN hop |

`Access-Control-Allow-Origin: *` present on panel/CDN responses.

## ffprobe (344921.mkv)

| Field | Value |
|-------|-------|
| Container | matroska,webm |
| Video | **hevc** Main 10, 3840×1608 |
| Audio | **aac** LC, 6 ch, 48 kHz |
| Duration | 8889.985 s (~2h28) |
| Size / bitrate | ~7.4 GB / ~6.7 Mbps |

## ffmpeg 15s decode (344921.mkv)

**PASS** — exit 0, ~718 frames decoded, speed ~8×.

## VLC

Not installed in the probe environment. ffmpeg decode success is treated as media-valid.

## Decision gate A

**PASS** — original upstream media is valid and playable with ffmpeg from a non-Railway IP when the **correct extension** (`.mkv` / `.mp4`) is used.
