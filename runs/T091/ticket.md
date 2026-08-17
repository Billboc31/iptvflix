# T091 — Optimize VOD streaming to reduce buffering and match native IPTV app performance

**Source**: GitHub Issue #191

## Description

## Context
The same IPTV source plays smoothly in a normal/native IPTV app, but IPTVFlix playback currently lags/buffers more. Since the upstream source can evidently sustain playback, investigate and optimize IPTVFlix-specific transport/player overhead rather than blaming provider bandwidth by default.

## Goal
Make IPTVFlix VOD playback start faster, buffer less and recover better, while preserving the now-working video path and seekability.

## Required measurement first
Use the SAME real movie/source in IPTVFlix and in a known-good IPTV client where possible. Gather comparable evidence:
- startup time to first frame;
- average bitrate;
- rebuffer count/duration;
- download throughput;
- buffer ahead seconds;
- request pattern;
- segment/Range sizes;
- CPU/memory usage;
- delivery mode;
- browser/device/network.

Identify where IPTVFlix loses performance.

## Investigate likely causes
- too-small HLS segment/buffer settings;
- unnecessary remux/transcode when direct/remux is sufficient;
- ffmpeg startup per request/session;
- gateway copying/buffering entire chunks instead of streaming them;
- Node stream backpressure/highWaterMark issues;
- Range requests not forwarded optimally;
- missing keep-alive/connection reuse to provider;
- redirect/proxy overhead;
- HLS manifest/segment latency;
- browser player buffer configuration;
- aggressive cleanup/session expiration;
- frontend source reloads caused by React state rerenders;
- duplicate media requests;
- seeking/progress-save logic causing reloads;
- Railway CPU/memory/network bottlenecks if the playback path traverses Railway;
- provider path differences between IPTVFlix and native client.

## Delivery strategy
Do not transcode by default if codecs are already browser-compatible. Prefer, in order where viable:
1. direct/native provider HLS;
2. direct/proxy byte stream with correct Range support;
3. remux without re-encoding;
4. transcode only when codec compatibility requires it.

If current playback is direct from client to Xtream, optimize player/network behavior without reintroducing a server relay that the provider blocks.

## Buffering UX
- maintain a useful forward buffer;
- do not stall because UI progress/save calls fire;
- show buffering state only when genuinely stalled;
- recover/retry transient segment/network failures gracefully;
- avoid restarting playback from zero after transient errors.

## Acceptance criteria
- [ ] Root cause(s) of excess buffering identified with measurements.
- [ ] Startup time and rebuffer behavior measured before/after.
- [ ] No unnecessary transcoding for already-compatible streams.
- [ ] Network requests are streamed efficiently with proper backpressure/Range semantics where applicable.
- [ ] No duplicate/repeated source reloads during normal playback.
- [ ] Real movie plays materially more smoothly on the same network/device.
- [ ] Seek/pause/resume remain functional.
- [ ] Existing playback transport that currently works is not regressed.
- [ ] Performance findings documented using a real Xtream stream.

## Completion rule
Do not close based on synthetic unit tests. Run a real long movie for enough time to observe buffering and compare before/after under the same connection/device conditions.
