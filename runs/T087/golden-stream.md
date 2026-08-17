# T087 — Golden Stream Selection

**Status: FILLED — residential + Railway probes completed 2026-08-17**

## Selected golden stream (primary)

| Field | Value |
|-------|-------|
| Movie title | Spider-Man: No Way Home |
| Movie ID | `6a0c1ad8-69e8-4675-85d0-12a3c2fdff38` |
| Availability ID | `0dd848ec-310a-45d4-b29c-07105de5c9f2` |
| Source ID | `bfd910e1-7a35-4e2b-96b8-0f3366576f56` |
| Source name | strong8k |
| Xtream stream ID | `344921` |
| Catalog container_extension | often `ts` (catalog) |
| **Working extension (residential)** | **`mkv`** |
| Video quality | 4K (3840×1608) |
| Audio language | (default selection) |

## Browser-friendly alternate (same movie)

| Field | Value |
|-------|-------|
| Raw title | EN - Spider-Man: No Way Home (2021) |
| Availability ID | `2cc6942d-e6d4-48e1-9071-ccc65e88efed` |
| Xtream stream ID | `336591` |
| Working extension | **`mp4`** |
| Codecs | **h264** 1920×800 + **aac** 6ch |
| Duration | ~8889 s |

## URL shape (credentials redacted)

```
https://cf.tviso.tech/movie/[REDACTED]/[REDACTED]/{streamId}.{ext}
```

Verified against live panel:
- Pattern `/movie/{user}/{pass}/{id}.{ext}` is correct.
- `.m3u8` and `.ts` → **HTTP 551** from residential.
- `.mkv` / `.mp4` → **HTTP 206** with real media (after 302 to origin CDN).

## URL construction verification

`buildXtreamMovieUrl()` matches the live panel. Forcing `.m3u8` in resolve (previous hotfix) was **wrong for this provider**.
