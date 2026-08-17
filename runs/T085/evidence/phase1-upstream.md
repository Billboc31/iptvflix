# Phase 1 — Upstream Stream Validation

**Status: BLOCKED / AWAITING REAL PLAYBACK VALIDATION**

This phase requires direct access to the production/prod-like database and the Railway API environment to:
1. Query a real `movieAvailability` row with `source.type = 'XTREAM'`
2. Construct and test the upstream Xtream URL from the Railway environment

## What was done

- Audited `buildXtreamMovieUrl()` in `apps/api/src/providers/xtream/playback.ts`
- Confirmed URL pattern: `/movie/{username}/{password}/{streamId}.{ext}`
- Confirmed `containerExtension` is taken verbatim from the availability row (no hard-coding)
- Confirmed the resolver forces `m3u8` for Xtream sources at resolve time (provider-native HLS + redirect strategy)

## What requires manual validation

The following commands must be run from the Railway API environment (or equivalent network access):

```bash
# 1. Find a real movie availability
# Query your database:
# SELECT ma.id, ma.provider_item_id, ma.container_extension, s.base_url, s.username
# FROM movie_availabilities ma JOIN sources s ON s.id = ma.provider_id
# WHERE s.type = 'XTREAM' AND ma.status = 'AVAILABLE' LIMIT 1;

# 2. Construct the upstream URL:
# http://{base_url}/movie/{username}/{password}/{provider_item_id}.{container_extension}

# 3. Test reachability from Railway:
# curl -I "http://{base_url}/movie/{user}/{pass}/{stream_id}.{ext}"
# curl -r 0-1023 "http://..."
# ffprobe -v quiet -print_format json -show_streams -show_format "http://..."
# ffmpeg -t 30 -i "http://..." -f null -
```

## Required evidence (not yet collected)
- HTTP status and Content-Type from upstream
- ffprobe stream summary (codecs, resolution, duration)
- ffmpeg 30-second decode result
