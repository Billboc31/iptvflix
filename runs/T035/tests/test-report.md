All 396 tests across 28 files pass with no regressions. Here is the test report.

---

## Test Report — T035: Extend source availability lifecycle to episode transitions

**Result: PASS**

### Acceptance Criteria

| # | Criterion | Status | Coverage |
|---|-----------|--------|----------|
| 1 | First authoritative episode availability records exactly one source-appearance event | **PASS** | `records exactly one SOURCE_APPEARED event per episode on first episode sync` (line 1036); Plex: line 1183 |
| 2 | Unchanged re-sync does not duplicate the event | **PASS** | `does not create additional episode events when re-syncing with an identical episode snapshot` (line 1065); Plex idempotency: line 1226 |
| 3 | Removal records exactly one source-disappearance event | **PASS** | `records SOURCE_DISAPPEARED when an episode is absent from an authoritative snapshot` (line 1086); Plex: line 1246 |
| 4 | Reappearance records a new appearance transition | **PASS** | `records a new SOURCE_APPEARED when an episode reappears after disappearing` (line 1117) — expects 2 `SOURCE_APPEARED` + 1 `SOURCE_DISAPPEARED` |
| 5 | Events preserve the originating source | **PASS** | `episode events carry the correct sourceId` (line 1143); sourceId verified in every lifecycle test |
| 6 | Lifecycle API/domain types represent Episodes explicitly and safely | **PASS** | `releaseEventMediaTypeEnum` adds `'EPISODE'` variant in `release-lifecycle.ts:7`; route guard and service accept it; migration `0015_episode_release_events.sql` alters the column; `release-lifecycle-service.test.ts` covers `recordReleaseEvent` and `getTimeline` for EPISODE |
| 7 | Automated tests cover Xtream and Plex episode transitions where practical | **PASS** | 5 Xtream tests (lines 1036–1159) + 2 Plex tests (lines 1183–1298) in `catalog-sync-service.test.ts` |

### Regression check

Full suite: **396 tests, 28 files — all passed.** The two `stderr` lines are expected warn-level log output from the intentional conflict-detection test, not failures.

### Notes

- Idempotency is implemented via partitioned unique indexes (source vs. non-source events), consistent with the #61 coordination requirement.
- Metadata-only re-syncs (unchanged episode lists) produce no false lifecycle events — verified by criterion 2.
- The `EPISODE` type is explicitly excluded from release-date fields in `getTimeline`, keeping the response shape safe.
