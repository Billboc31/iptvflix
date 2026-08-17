All tasks complete. Here is the implementation summary:

---

## Implementation Summary

**Result: BLOCKED / AWAITING REAL PLAYBACK VALIDATION** — per the ticket's strict completion rule. Code changes are complete and all tests pass; real-device and real-provider validation requires manual execution.

### Files created or modified

**New files:**
- `apps/api/src/providers/xtream/__tests__/xtream-vod-url.test.ts` — 18 tests pinning the exact `/movie/{user}/{pass}/{streamId}.{ext}` URL pattern (Phase 2)
- `apps/api/src/__tests__/playback-integration.test.ts` — 11 integration tests with a local fake Xtream server covering correlation ID, credential safety, HLS manifest rewriting, and typed error categories
- `apps/api/src/services/playback-diag.ts` — new diagnostic service backing `GET /playback/diag/:availabilityId`
- `runs/T085/evidence/` — 6 evidence documents (phases 1, 2, 3, 4, 5, 6, 8, summary)

**Modified files:**
- `packages/api-contracts/src/playback.ts` — added `PlaybackErrorCategory` type (10 categories) and `correlationId` field on `PlaybackSessionResponse`
- `apps/api/src/services/playback-session-store.ts` — added `correlationId` to `SessionEntry`, added `findSessionByAvailabilityId()`
- `apps/api/src/services/ffmpeg-availability.ts` — added `isFfprobeAvailable()`
- `apps/api/src/services/playback-resolver.ts` — added `correlationId` parameter with 7 structured log steps (`resolve_start` → `gateway_url_issued`); correlationId now in session and response
- `apps/api/src/routes/playback.ts` — generates UUID at resolve entry, returns `X-Correlation-ID` header, adds typed `errorCategory` to all error responses, adds `GET /playback/diag/:availabilityId`
- `apps/web/src/lib/player-errors.ts` — maps `PlaybackErrorCategory` to French user messages

**Test results:** 87 playback-related tests pass; 5 pre-existing failures in unrelated files (vertical-slice, scheduler, title-matching) remain unchanged.
