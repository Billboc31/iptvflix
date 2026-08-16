# T082 — Cross-platform Playback Failure: Root Cause Diagnosis

## Summary

Cross-platform playback failure (Safari iOS + Android Chrome) is caused by three structural defects in the pre-T082 delivery pipeline, all rooted in the same principle: the backend did not probe actual media before delivering it to the browser, and the compat path was optional/manual rather than the default.

---

## Root Causes

### 1. Extension-based routing without probing (default path)

**Evidence — `apps/api/src/routes/playback.ts` (pre-T082, lines 395–462)**

```
const REMUX_EXTENSIONS = new Set(['ts', 'mkv', 'avi', 'flv', 'wmv'])
const PASSTHROUGH_EXTENSIONS = new Set(['mp4', 'm3u8', 'm3u'])

// ... extension routing:
if (ext === 'm3u8' || ext === 'm3u') → HLS pass-through
if (ext === 'mp4' ...) → pass-through
if (REMUX_EXTENSIONS.has(ext)) → ffmpeg → fragmented MP4
else → mp4 pass-through fallback
```

The stored `containerExtension` comes from the Xtream provider metadata, **not from actual ffprobe output**. A provider can label a stream `.mp4` while it actually contains HEVC video or AC3 audio that browsers cannot decode. Similarly, a `.ts` stream with H.264+AAC remuxed to fMP4 may work on desktop Chrome but stall on Android due to PTS/DTS gaps in the fragmented output.

**Result**: browsers receive arbitrary containers and codec combinations. Safari/iOS and Android Chrome both reject streams the extension-based logic considers compatible.

---

### 2. compat path gated behind `?compat=1` — never triggered automatically for Android Chrome

**Evidence — `apps/api/src/routes/playback.ts` (pre-T082, line 206)**

```typescript
const useCompat = request.query.compat === '1'
```

**Evidence — `apps/web/src/pages/PlayerPage.tsx` (pre-T082, lines 169–180)**

```typescript
if (
  (errorCode === MediaError.MEDIA_ERR_DECODE || errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) &&
  compatUrl &&
  !isUsingCompatRef.current
) {
  // retry with ?compat=1
  video.src = compatUrl
  video.load()
}
```

The compat retry only fires after a decode error has already been surfaced to the user. On Android Chrome, `MEDIA_ERR_DECODE` is often never emitted for codec/container mismatches — the browser either stalls silently or hangs at `networkState: NETWORK_LOADING` without raising an error event. Even on Safari, by the time the error fires, the user has already seen the failure screen.

**Result**: the compat path is effectively unreachable for Android Chrome. Even when it fires on Safari, the double-load creates a visible failure moment.

---

### 3. `classifyDelivery()` had Safari-specific branching — not browser-agnostic

**Evidence — `apps/api/src/services/playback-compat.ts` (pre-T082, lines 13–45)**

```typescript
export function classifyDelivery(mediaInfo: MediaInfo, isSafari: boolean): DeliveryMode {
  // ...
  if (isHEVC) {
    if (isSafari && isAAC && isMp4Container) return 'DIRECT'   // Safari only
    if (isSafari && isAAC) return 'REMUX'                       // Safari only
    // non-Safari → TRANSCODE_VIDEO or TRANSCODE_FULL
  }
}
```

Even when the compat path was reached, HEVC content would be passed through on Safari+AAC+MP4 (where Safari hardware-decodes it) but full-transcoded on Android Chrome. This is correct behaviour in isolation, but the compat path was never reached on Android Chrome (defect #2), making this logic irrelevant for the cross-platform case.

More critically, the non-compat path made no codec decisions at all — every stream went through extension-based routing regardless of actual codecs.

---

## Evidence of Incorrect Media Delivery

Based on code analysis and container/codec combinations typical for Xtream providers:

| Stored extension | Likely actual codec | Pre-T082 delivery | Browser result |
|---|---|---|---|
| `.ts` | H.264 + AC3 | ffmpeg → fMP4 (copy) | AC3 not supported on mobile |
| `.mkv` | HEVC + AAC | ffmpeg → fMP4 (copy) | HEVC decode fails on Android Chrome |
| `.mp4` | HEVC + AAC | pass-through | Fails on Android Chrome |
| `.ts` | H.264 + AAC | ffmpeg → fMP4 (copy) | PTS gap issues may cause stall |

The key finding: **fragmented MP4 output (`frag_keyframe+empty_moov`) was the delivery format for remuxed streams**, but fragmented MP4 has known interoperability issues when served over HTTP without proper Content-Range/byte-serving support, and some Android Chrome versions refuse to start playback if the `moov` atom is not positioned correctly.

---

## Resolution — T082

The T082 implementation eliminates all three defects:

1. **Probe-first at resolve time**: `probeMedia()` is called on the actual provider URL before the session is returned. The actual codec/container determines delivery mode, not the stored extension.

2. **HLS pipeline as the compatibility path**: instead of fragmented MP4 (which requires the browser to buffer before playing), ffmpeg writes HLS segments to disk. HLS is the universal browser-compatible format: Safari uses native HLS, Chromium/Android uses HLS.js.

3. **Browser-agnostic classification**: `classifyDelivery()` no longer reads User-Agent. Delivery mode is determined solely from the actual media probe result:
   - H.264 + AAC + MP4 → `DIRECT` (native browser MP4)
   - H.264 + AAC + other container → `HLS_REMUX` (stream copy, no quality loss)
   - H.264 + non-AAC audio → `HLS_TRANSCODE_AUDIO` (copy video, transcode audio)
   - Anything else (HEVC, VP9, AV1) → `HLS_TRANSCODE_FULL`

4. **No client-side fallback**: `gatewayUrl` is guaranteed to point to a browser-compatible stream. The error-triggered compat retry in `PlayerPage.tsx` is removed.

---

## Manual Validation Required (Blocking for Ticket Closure)

Automated tests verify code correctness but cannot validate actual browser playback on real devices.

Blocking manual validation steps:
1. One real Xtream Movie on iPhone Safari — confirm HLS or DIRECT playback starts
2. One real Xtream Movie on Android Chrome — confirm HLS pipeline delivers correctly
3. One real Xtream Episode on at least one mobile browser
4. One stream known to be H.264+AAC+MP4 — confirm DIRECT pass-through works (no regression)
5. One stream that triggers HLS_REMUX or HLS_TRANSCODE — confirm HLS pipeline delivers segments correctly

Ticket status: **awaiting manual playback validation** after production deployment.
