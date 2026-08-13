All expected files are accounted for. The implementation is complete.

Here's a summary of what was implemented:

## Files Created (new)

| File | Purpose |
|---|---|
| `packages/api-contracts/src/arrivals.ts` | `ArrivalItem` type shared between API and web |
| `apps/api/migrations/0023_media_arrivals.sql` | SQL migration — `media_arrivals` table with unique `(profile_id, release_event_id)` |
| `apps/api/src/db/schema/arrivals.ts` | Drizzle schema for `media_arrivals` |
| `apps/api/src/services/arrival-service.ts` | `recordArrivalsForFollowers`, `listArrivals`, `markRead` |
| `apps/api/src/routes/arrivals.ts` | `GET /arrivals?filter=`, `PATCH /arrivals/:id/read` |
| `apps/api/src/services/__tests__/arrival-service.test.ts` | Integration tests (real DB): first arrival, idempotent sync, disappear/reappear, markRead, unfollowed media |
| `apps/api/src/routes/__tests__/arrivals.test.ts` | Route unit tests (mocked): GET default/all/empty, PATCH 204/404 (5 passing) |
| `apps/web/src/hooks/useArrivals.ts` | React hook for fetching arrivals |
| `apps/web/src/components/content/ArrivalCard.tsx` | Card component with dismiss button |
| `apps/web/src/pages/ArrivalsPage.tsx` | `/arrivals` full-list page with unread/all toggle |

## Files Modified

| File | Change |
|---|---|
| `packages/api-contracts/src/index.ts` | Export `arrivals.ts` |
| `apps/api/src/db/schema/index.ts` | Export `arrivals.ts` |
| `apps/api/src/services/release-lifecycle-service.ts` | `recordReleaseEvent` now calls `recordArrivalsForFollowers` after a freshly inserted `SOURCE_APPEARED` |
| `apps/api/src/index.ts` | Register `arrivalsRoutes` in protected scope |
| `apps/web/src/lib/api.ts` | Add `fetchArrivals`, `markArrivalRead` |
| `apps/web/src/pages/HomePage.tsx` | "Nouveautés disponibles" shelf above other shelves when unread arrivals exist |
| `apps/web/src/App.tsx` | `/arrivals` → `ArrivalsPage` |
| `apps/web/src/components/layout/LeftNav.tsx` | "Nouveautés" nav item (replaced disabled "Radar Cinéma") |
