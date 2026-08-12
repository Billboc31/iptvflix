---

## Test Report — T026

**Command:** `pnpm --filter api test`
**Result:** 361 tests passed (28 files), 0 failures, 0 regressions.

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| AC1 | `availableToMe=true` → only AVAILABLE media | **PASS** |
| AC2 | `availableToMe=false` → only non-AVAILABLE media, including zero-availability rows | **PASS** |
| AC3 | `availableToMe` omitted → no availability filter | **PASS** |
| AC4 | Consistent semantics for Movies and Series | **PASS** |
| AC5 | `watchState` on Series rejected with HTTP 400 and clear message | **PASS** |
| AC6 | Results refresh when availability changes (computed at query time, no cache) | **PASS** |
| AC7 | Automated tests cover all three states × both media types + `watchState` | **PASS** |

**No regressions. No blocking issues.**

**Decision: TESTS_PASSED**
