---

## Test Report — T033

**All 6 acceptance criteria: PASS. 480/480 tests pass (81 frontend + 399 backend), 0 regressions.**

| Criterion | Status | Evidence |
|---|---|---|
| AC1 — Human-readable source names | **PASS** | `SourcePriorityInput` renders `source.name`; "render source names" test confirms `Xtream HD`/`Plex Home` in DOM |
| AC2 — Reorderable by priority | **PASS** | ▲/▼ buttons with `aria-label`; "moves a source down" test asserts `Plex Home` precedes `Xtream HD` after click |
| AC3 — Ordering persisted in `preferredSourceIds` | **PASS** | `handleSave` passes filtered ordered array to `updateProfilePreferences`; PATCH body captured as `['src-b', 'src-a']` after reorder |
| AC4 — Backend resolver uses ordering without frontend ranking | **PASS** | `availability-resolver.ts:45` reads `prefs.preferredSourceIds.indexOf(variant.providerId)` directly — no re-sorting frontend-side |
| AC5 — Missing/deleted ids handled safely | **PASS** | `displayedIds` filters stale ids at render; `handleSave` filters again before save; "stale id" test confirms `deleted-id` absent from DOM and PATCH body |
| AC6 — Automated tests: load, reorder, save | **PASS** | 4 new tests in `ProfileSettingsPage.test.tsx` cover all three flows |

Two minor non-blocking observations: (1) stale ids are dropped on the first reorder, not only on save — slightly stricter than spec but harmless; (2) the "add via dropdown" flow has no test, which was explicitly excluded from the plan's scope.

Report saved to `runs/T033/test-report.md`.
