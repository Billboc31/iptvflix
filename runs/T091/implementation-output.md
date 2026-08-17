All changes are in place. Here's a summary:

---

## Implementation complete — T091

### Files modified

| File | Change |
|---|---|
| `apps/web/src/pages/PlayerPage.tsx` | Phase 1: `maxBufferLength` 30→60, add `maxMaxBufferLength: 180`, `lowLatencyMode: false`, `progressive: true` |
| `apps/api/src/providers/xtream/playback.ts` | Phase 2: `-analyzeduration` and `-probesize` 5 000 000→500 000 (faster ffmpeg startup) |
| `apps/api/src/routes/playback.ts` | Phase 3: `highWaterMark: 256 * 1024` on direct stream pipe; Phase 3: segment proxy uses `SEGMENT_TIMEOUT_MS=15 000` with one retry on timeout or 5xx; Phase 5: playlist `Cache-Control: max-age=4, public` |
| `apps/api/src/services/playback-session-store.ts` | Phase 4: TTL 2 h → 4 h |
| `apps/api/src/services/hls-session-store.ts` | Phase 4: TTL 2 h → 3 h, `MAX_SEGMENTS` 500 → 1 500 |
| `apps/api/src/services/__tests__/playback-session-store.test.ts` | Updated TTL expectation 2 h → 4 h |
| `apps/api/src/services/__tests__/hls-session-store.test.ts` | Updated segment count ceiling 501 → 1501 |
| `runs/T091/measurements.md` | Created before/after measurement template |

### Phase 6 — no change needed
The `useEffect` in `PlayerPage.tsx` already has correct deps `[gatewayUrl, deliveryMode, containerExtension]`. `useProgressSync` only returns `flushProgress` and does not mutate any state that would change those deps — no duplicate source reloads.

### Test result
5 pre-existing failures unchanged (vertical-slice integration, title-matching, playback-resolver). The 2 failures introduced by TTL/segment-limit changes are fixed. `848/853` tests pass.
