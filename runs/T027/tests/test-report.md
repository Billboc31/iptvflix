All 370 tests pass. Here is the test report.

---

## T027 — Tester Report

### Test execution

**Commands run:** `npm --prefix apps/api test -- --reporter=verbose`  
**Result:** 370/370 tests passed (28 test files)

---

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC-1 | First transition from no availability → AVAILABLE records exactly one `SOURCE_APPEARED` event | **PASS** | `if (!existing)` branch inserts event + `onConflictDoNothing`; test `records exactly one SOURCE_APPEARED event per movie and series on first sync` ✓ |
| AC-2 | Re-running unchanged sync does not create duplicate events | **PASS** | `else` branch only emits when `wasUnavailable === true`; test `does not create additional events when re-syncing with an identical snapshot` ✓ |
| AC-3 | AVAILABLE → UNAVAILABLE records exactly one `SOURCE_DISAPPEARED` | **PASS** | Bulk update with `.returning({ movieId })` + per-row insert; test `records SOURCE_DISAPPEARED when a previously AVAILABLE item is absent from the snapshot` ✓ |
| AC-4 | Reappearance after disappearance records a new `SOURCE_APPEARED` | **PASS** | `wasUnavailable` check in `else` branch with new `occurredAt` bypasses unique constraint; test `records a new SOURCE_APPEARED when an item reappears after disappearing` verifies 2× `SOURCE_APPEARED` + 1× `SOURCE_DISAPPEARED` ✓ |
| AC-5 | Metadata refresh without state change produces zero events | **PASS** | `wasUnavailable` is false for AVAILABLE items so no event emitted; test `does not create events for metadata-only updates on an already AVAILABLE item` ✓ |
| AC-6 | Source identity preserved; no credentials in lifecycle data | **PASS** | `sourceId` stores the provider UUID (`sources.id`), not credentials or stream URLs ✓ |
| AC-7 | Follow Release timeline API exposes these events | **PASS** | `GET /release-lifecycle/:mediaType/:mediaId` implemented and registered; delegates to `getTimeline()`; `release-lifecycle-service.test.ts` covers `SOURCE_APPEARED` in timeline ✓ |
| AC-8 | Automated tests cover first appearance, unchanged resync, disappearance, reappearance | **PASS** | All five scenarios tested in `describe('source lifecycle events')` block ✓ |

### Regressions observed

None. All 365 pre-existing tests continue to pass alongside the 5 new lifecycle tests.

### Non-blocking findings

1. **Unique constraint excludes `sourceId`** (`release-lifecycle.ts:25`): the constraint is on `(mediaType, mediaId, eventType, occurredAt)`. If two sources provide the same canonical media item with the exact same `occurredAt` timestamp, the second `SOURCE_APPEARED` is silently dropped by `onConflictDoNothing()`, losing that source's identity. Practically unlikely since sync jobs run independently with different `fetchedAt` timestamps, but worth noting for future multi-source scenarios.

2. **No HTTP-level route test** for `GET /release-lifecycle/:mediaType/:mediaId`: the route is exercised only through the service layer in `release-lifecycle-service.test.ts`. The 400 validation path (invalid `mediaType`) is untested at the HTTP level. Low risk given the simplicity of the route.

### Verdict

**VALIDATED.** All acceptance criteria are met. The two findings above are improvements, not blockers.
