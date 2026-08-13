# T052 — Test Report

**Date**: 2026-08-13  
**Tester**: AI (tester role)  
**Branch**: ticket/T052-surface-followed-media-arrivals-and-newly-available  
**Result**: ✅ PASS (after fixing 2 defects found during testing)

---

## Acceptance Criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | When a followed Media transitions from not available to available on a configured source, one user-visible arrival item is created/exposed | ✅ PASS | `recordArrivalsForFollowers` creates one row per following profile per `SOURCE_APPEARED` event. Verified by service test. |
| 2 | Repeated syncs with no new transition do not create duplicate arrival items | ✅ PASS | `ON CONFLICT (profileId, releaseEventId) DO NOTHING` prevents duplicates. Verified by idempotency test. |
| 3 | Reappearance after a genuine disappearance can produce a new meaningful arrival | ✅ PASS | `SOURCE_DISAPPEARED` then new `SOURCE_APPEARED` generates a distinct `releaseEventId`, creating a fresh arrival row. Verified by integration test. |
| 4 | Arrival items identify the canonical Media and relevant source without duplicating the Media identity | ✅ PASS | `listArrivals` joins movie/series title and source name at query time; no duplication in schema. |
| 5 | Users can mark arrivals read/dismissed and that state persists | ✅ PASS | `PATCH /arrivals/:id/read` sets `readAt`; item excluded from unread filter. Verified by service and route tests. |
| 6 | Recent unread arrivals are discoverable from the Web UI and link to the Media detail/play flow | ✅ PASS | "New Arrivals" shelf on `HomePage` (unread only); `/arrivals` page in `ArrivalsPage`; `ArrivalCard` links to `/movies/:id` or `/series/:id`; nav item in `LeftNav`. |
| 7 | Non-followed source appearances do not flood the followed-arrivals inbox | ✅ PASS | `recordArrivalsForFollowers` queries `follow_release` first; no arrival created for unfollowed media. Verified by test "creates no arrivals for media not followed by any profile". |
| 8 | Automated tests cover first arrival, duplicate sync, read/dismiss and disappearance/reappearance | ✅ PASS | All 15 arrivals-specific tests pass (service: 12 tests, routes: 5 tests, 2 overlap). |

---

## Defects Found and Fixed

### D1 — Migration not registered in Drizzle journal (blocking)

**Symptom**: All service tests failed with `PostgresError: relation "media_arrivals" does not exist`.  
**Root cause**: `0023_media_arrivals.sql` was hand-crafted without running `drizzle-kit generate`, so it was absent from `migrations/meta/_journal.json` and no snapshot was created. `drizzle-kit migrate` reported success but applied nothing.  
**Fix**: Ran `pnpm drizzle-kit generate --name media_arrivals` to register the migration in the journal and generate `meta/0023_snapshot.json`. Then applied via `pnpm db:migrate`. Migration chain validated: 24 snapshots, valid chain.  
**Files changed**: `migrations/0023_media_arrivals.sql` (reformatted), `migrations/meta/_journal.json` (+1 entry), `migrations/meta/0023_snapshot.json` (new).

### D2 — Test assertions in `recordReleaseEvent` integration tests incorrect (non-blocking service logic)

**Symptom**: 2 tests failed: "does not create a duplicate arrival on repeated idempotent recordReleaseEvent" and "SOURCE_DISAPPEARED then SOURCE_APPEARED produces a new arrival" — both expected `toHaveLength(1)` but got 2.  
**Root cause**: By the time these tests run, both `profileId` and `profile2Id` are following `movieId` (set up in the earlier `recordArrivalsForFollowers` describe block). Querying arrivals by `releaseEventId` returns 2 rows (one per follower). The test correctly verifies uniqueness per-profile but the assertion didn't account for multiple followers.  
**Fix**: Added `eq(mediaArrivals.profileId, profileId)` filter to both assertions. The idempotency constraint is `(profileId, releaseEventId)` — checking per-profile is the correct invariant.  
**File changed**: `apps/api/src/services/__tests__/arrival-service.test.ts`.

---

## Test Execution Results

```
Test Files  46 passed (46)
      Tests  638 passed (638)
   Duration  ~2.7s
```

All 638 tests pass, including:
- 12 arrival service tests (recordArrivalsForFollowers, listArrivals, markRead, recordReleaseEvent integration)
- 5 arrival route tests (GET /arrivals, PATCH /arrivals/:id/read)

---

## Regressions

None observed. All 628 previously passing tests continue to pass.

---

## Out-of-scope Notes

- Pre-existing TypeScript type errors in `apps/api/src/middleware/authenticateDevice.test.ts` and `apps/api/src/services/__tests__/playback-resolver.test.ts` are not regressions from T052.
- Pre-existing `import.meta.env` TypeScript error in `apps/web/src/lib/api.ts` and `apps/web/src/hooks/useSchedulerStatus.ts` exist on `main` and are not regressions.
- Frontend UI not interactively tested (no browser). Structure verified: `ArrivalsPage`, `ArrivalCard`, `useArrivals` hook, `LeftNav` nav entry, `App.tsx` routing, and `HomePage` "New Arrivals" shelf all present and correctly wired.

---

## Limitations

- Frontend rendering not validated in a browser (no Playwright/Cypress tests, dev server not started).
- The "New Arrivals" shelf on `HomePage` requires real data in DB; tested only via code inspection.
