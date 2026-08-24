---

## Test Report — T128

**Result: VALIDATION_PASSED** (with one bug fixed)

### Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| AC1 | Movies page composed of personalized movie-only shelves | **PASS** |
| AC2 | Shelf themes and contents are personalized | **PASS** |
| AC3 | Multiple exploitation themes, dynamically selected and distinct | **PASS** |
| AC4 | At least one exploration/serendipity shelf | **PASS** |
| AC5 | Exploration not pure randomness (non-zero semantic scores required) | **PASS** |
| AC6 | ~75% exploitation / 25% exploration product policy | **PASS** |
| AC7 | No series leak into movie shelves | **PASS** |
| AC8 | Cross-shelf deduplication materially reduces duplicates | **PASS** |
| AC9 | Stable across refreshes; no repeated LLM generation within TTL | **PASS** |
| AC10 | Home and diagnostics tooling do not regress | **PASS** |
| AC11 | Automated tests for all required behaviors | **PASS** |

### Bug fixed

**`series-pool-service.test.ts` — arrow function constructor mocks in `beforeEach`** (lines 155–156): After `vi.resetAllMocks()`, the `beforeEach` re-applied `ShelfInstanceService` and `ShelfFatigueService` mocks using arrow functions (`() => ({...})`), which cannot be used as constructors. Fixed to `function () { return {...} }`, matching the movies test pattern. All 11 series tests now pass.

### Test execution

**115 tests across 8 suites — all pass.** No regressions in Home, series page, or hero selector tests. The full report is at `runs/T128/tests/tester-report.md`.
