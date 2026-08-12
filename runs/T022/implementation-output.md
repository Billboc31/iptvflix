All three fixes are done and all 343 tests pass.

**Changes made:**

1. **`apps/api/src/routes/catalog.ts`** — Removed the redundant `epRawVariantMap`. The loop now only builds `epVariantMap`, and `resolveVariant()` receives `epVariantMap.get(e.id) ?? []` directly. ~12 lines removed.

2. **`apps/web/src/pages/SeriesDetailPage.tsx`** — Replaced the hardcoded `DEFAULT_PROFILE_ID` constant with a `profileId` state initialized to `undefined`. A `useEffect` fetches `getProfile()` at mount and stores the real profile ID; on failure it stays `undefined` (watchState silently null, not an error).

3. **`apps/api/src/routes/catalog.test.ts`** — Added the non-blocking test: `profileId=not-a-uuid` → 400.
