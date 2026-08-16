Clean. All four fixes are in place:

| Issue | Fix |
|---|---|
| **[BLOQUANT] Retry HLS sur Chrome** | `PlayerPage.tsx`: destructure `availabilityId`, `onRetry` now calls `switchVariant(availabilityId)` instead of directly setting `video.src` — triggers a full re-resolve with a fresh session |
| **[SIGNIFICATIF] extensionFallbackMode mp4 → DIRECT** | `playback-resolver.ts`: removed `mp4`/`m4v → DIRECT` branch; they now fall through to `HLS_TRANSCODE_FULL` since codecs are unknown without a probe |
| **[MINEUR] deliveryMode absent from E2E test** | `playback-resolver.test.ts`: added `expect(session.deliveryMode).toBe('DIRECT')` to the primary resolve test |
| **[MINEUR] ffmpeg exit not logged** | `hls-session-store.ts`: added `console.error` with `exitCode`, `signal`, and `stderrTail` in the `close` handler |
