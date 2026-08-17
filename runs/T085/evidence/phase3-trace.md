# Phase 3 — End-to-End Correlation Trace

**Status: CODE INSTRUMENTED — REAL TRACE REQUIRES PRODUCTION ACCESS**

## Implementation

`X-Correlation-ID` is now threaded through the full playback resolve flow.

### Changes made

1. **`apps/api/src/routes/playback.ts`** — resolve handler generates UUID and returns it in header:
   ```typescript
   const correlationId = randomUUID()
   reply.header('X-Correlation-ID', correlationId)
   ```

2. **`apps/api/src/services/playback-resolver.ts`** — accepts `correlationId` and logs at each step:
   - `resolve_start` — entry point with mediaType/mediaId
   - `availability_fetched` — after DB lookup, includes availabilityId, sourceType, containerExtension
   - `upstream_url_built` — after constructing provider URL (no credentials logged)
   - `probe_result` — after ffprobe (or reason for skipping: `xtream_always_direct`)
   - `delivery_mode_selected` — final delivery mode chosen
   - `session_created` — sessionId, codec info
   - `gateway_url_issued` — final URL returned to client

3. **`apps/api/src/services/playback-session-store.ts`** — `SessionEntry` now stores `correlationId`, so gateway handlers can retrieve it for error responses.

4. **`packages/api-contracts/src/playback.ts`** — `PlaybackSessionResponse` now includes `correlationId: string`.

### Log line format

Each log line emits:
```json
{
  "correlationId": "uuid",
  "step": "resolve_start | availability_fetched | ...",
  "durationMs": 42,
  ...step-specific fields...
}
```

No credentials (Xtream username/password) appear in any log line.

## Example trace (from integration test output)

```
{ correlationId: '45f52179-...', step: 'resolve_start', mediaType: 'movie', mediaId: 'aaaa...' }
{ correlationId: '45f52179-...', step: 'availability_fetched', availabilityId: 'bbbb...', sourceType: 'XTREAM', ... }
{ correlationId: '45f52179-...', step: 'upstream_url_built', containerExtension: 'm3u8', durationMs: 2 }
{ correlationId: '45f52179-...', step: 'probe_result', skipped: true, reason: 'xtream_always_direct' }
{ correlationId: '45f52179-...', step: 'delivery_mode_selected', deliveryMode: 'DIRECT', ... }
{ correlationId: '45f52179-...', step: 'session_created', sessionId: '...', deliveryMode: 'DIRECT', ... }
{ correlationId: '45f52179-...', step: 'gateway_url_issued', gatewayUrl: '/playback/stream/...', ... }
```

## Real trace required

A real production trace must be captured by:
1. Clicking `Regarder` in the browser
2. Observing the `X-Correlation-ID` header in the resolve response
3. Searching Railway logs for that correlation ID to see all steps
