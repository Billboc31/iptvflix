All 20 existing tests still pass (11 + 9). Both fixes are done.

**Summary of changes:**

**Fix 1** — `apps/api/src/services/series-page-service.ts`:
- Added `and` to the drizzle-orm import (line 1)
- Changed the trailer query WHERE clause from `.where(eq(mediaVideos.mediaType, 'series'))` to `.where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))` (line 238) — bounds the query to only the series IDs already in the batch, preventing a full table scan

**Fix 2** — `apps/api/src/services/__tests__/series-page-service.test.ts` (new file, 11 tests):
- MISS path: verifies `buildSeriesDeclaredRails` is called and snapshot is saved
- HIT path: verifies `buildSeriesDeclaredRails` is NOT called and snapshot is NOT overwritten
- STALE path: verifies immediate response + async regeneration triggered
- INVALIDATED path: verifies an explicitly invalidated snapshot is treated as MISS
- **Snapshot reuse**: the key acceptance-criteria test — two calls within TTL return the same `sessionId` with `buildSeriesDeclaredRails` called 0 times (verified by mock call count)
