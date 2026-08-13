---

## Test Report — T052

**Result: ✅ PASS** (2 defects found and fixed during testing)

### Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Followed media SOURCE_APPEARED → one arrival item per profile | ✅ PASS |
| Repeated idempotent syncs → no duplicate arrivals | ✅ PASS |
| Reappearance after disappearance → new arrival | ✅ PASS |
| Arrival items identify media + source without duplication | ✅ PASS |
| Read/dismiss persists | ✅ PASS |
| Unread arrivals discoverable in Web UI, linked to detail/play | ✅ PASS |
| Non-followed appearances don't pollute arrivals inbox | ✅ PASS |
| Automated tests cover all scenarios | ✅ PASS |

### Defects Fixed

**D1 — Migration not registered (blocking)**  
`0023_media_arrivals.sql` was hand-written but never added to the Drizzle journal. `drizzle-kit migrate` silently succeeded without creating the table. Fixed by running `drizzle-kit generate --name media_arrivals` to register the entry and create the snapshot. Migration chain validates: 24 snapshots, valid chain.

**D2 — Test assertions assumed single follower**  
Two integration tests expected `toHaveLength(1)` when querying arrivals by `releaseEventId`, but both test profiles were following the movie at that point → 2 arrivals returned. Fixed by adding `eq(mediaArrivals.profileId, profileId)` to scope assertions to a single profile, which is the correct invariant (unique per `profileId + releaseEventId`).

### Final Test Run
```
Test Files  46 passed (46)
      Tests  638 passed (638)
```
No regressions. Frontend structure verified by code inspection (no browser test available).
