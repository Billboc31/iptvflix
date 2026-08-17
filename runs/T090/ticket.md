# T090 — Fix VOD duration/seek semantics and make resume use true media duration

**Source**: GitHub Issue #190

## Description

## Context
During VOD playback, the displayed total duration is currently wrong: the maximum duration appears to grow progressively as more of the stream loads. This makes the timeline visually misleading and causes resume/progress percentages to be incorrect.

A movie should have a stable real total duration from the beginning (or as soon as metadata is known), independent of how much has buffered/downloaded.

## Goal
Separate these concepts correctly:
- true media duration;
- current playback position;
- buffered ranges;
- seekable ranges;
- downloaded/loaded progress.

The player timeline and resume logic must use TRUE media duration, never buffered-end or loaded bytes as a fake duration.

## Investigation
For a real Xtream movie that reproduces the issue, capture:
- `video.duration`;
- `video.seekable` ranges;
- `video.buffered` ranges;
- stream/container type;
- HLS/native/direct delivery mode;
- server `Content-Length`, `Accept-Ranges`, `Content-Range` behavior where applicable;
- ffprobe-reported duration;
- any EXT-X metadata if HLS is used.

Identify exactly why duration currently increases progressively.

## Backend/media metadata
Where reliable duration is already available from TMDB/provider/ffprobe/database, expose/use it as metadata, but do not blindly trust catalog runtime if it differs materially from the playable asset.

For playable availability, consider storing/probing actual media duration when needed so the UI can initialize correctly.

If MP4 duration is unavailable until tail metadata/moov atom is fetched, investigate Range request behavior or metadata probing rather than using buffered duration.

If HLS is used, compute duration correctly from VOD playlist metadata (`#EXTINF` / ENDLIST) or media duration exposed by the browser/player.

## Timeline
- Timeline max must represent total duration.
- Buffered portion should be rendered as a separate visual layer.
- Played portion should be another layer.
- Seeking should use actual seconds/time ranges.
- If total duration is temporarily unknown, show an explicit indeterminate state rather than a growing fake total.

## Resume/progress
Persist absolute playback seconds plus reliable duration/percentage semantics.

Resume logic must NOT calculate progress from `currentTime / bufferedEnd` or any other loading metric.

Example:
- movie actual duration: 7200s
- user closes at 1800s
- persisted progress = 1800s (~25%), regardless of whether only 2200s had buffered.

When reopening:
- seek to saved absolute position when media is ready/seekable;
- clamp against real duration;
- avoid resume prompt for trivial start/end positions;
- completed status based on real duration/end threshold.

## Acceptance criteria
- [ ] Total movie duration no longer grows with buffering/loading.
- [ ] Player visually distinguishes total, played and buffered progress.
- [ ] Real duration matches the playable asset within reasonable tolerance.
- [ ] Unknown duration has an honest fallback state.
- [ ] Resume stores/restores absolute seconds correctly.
- [ ] Resume percentage uses real total duration.
- [ ] Closing at ~25% reopens at ~25%, not at a position distorted by prior buffer state.
- [ ] Seek bar remains usable after metadata becomes available.
- [ ] Tested with at least one long real Xtream movie and one real episode.

## Completion rule
Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening.
