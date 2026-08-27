All 28 tests pass (27 original + 1 new). Here's a summary of the changes applied:

---

## Changes delivered

### Fix applied (bloquant)

**`apps/api/src/services/live-search-service.ts`**
- Added `.filter((r) => r.streamUrl !== '')` before `.sort()` in the final `liveNow` construction — channels with no available source are now excluded from `LIVE_NOW` results.

### Recommendations applied

**`apps/api/src/utils/text.ts`** *(new)*
- Extracted shared `normalizeText` utility.

**`apps/api/src/services/epg-service.ts`**
- Removed local `normalizeText`; imports from `../utils/text.js`.

**`apps/api/src/services/live-search-service.ts`**
- Removed local `normalizeText`; imports from `../utils/text.js`.
- Added comment on `deliveryMode: 'DIRECT'` explaining the approximation and directing clients to `/channels/:id/playback/resolve` before playback.

**`apps/api/src/services/__tests__/live-search-service.test.ts`**
- Added test: `'live match with no available source excluded from liveNow'` — covers the fix directly.
