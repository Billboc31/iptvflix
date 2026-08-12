The pre-existing TypeScript errors are identical before and after the T034 changes — confirmed not a regression. I have everything needed to write the report.

---

## Test Report — T034: Enforce maxVideoQuality as a real playback cap

### Test environment

- Branch: `ticket/T034-enforce-maxvideoquality-as-a-real-playback-cap`
- Test runner: Vitest 2.1.9
- Modified files: `apps/api/src/services/availability-resolver.ts`, `apps/api/src/services/__tests__/availability-resolver.test.ts`

---

### Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | With `maxVideoQuality = 1080p`, a known 4K-only candidate is not selected over an otherwise usable candidate at or below 1080p | **PASS** | "1080p wins over 4K when cap is 1080p; 4K absent from result" + "returns null when only candidate is above cap" |
| 2 | 720p/1080p/4K caps behave consistently | **PASS** | "720p wins over 4K and 1080p when cap is 720p" + "1080p wins over 720p when both at or below cap" |
| 3 | `maxVideoQuality = null` keeps the current no-limit behavior | **PASS** | "4K wins when cap is null (no-limit behavior)" |
| 4 | Unknown quality has documented deterministic fallback behavior | **PASS** | `isAboveCap` always returns `false` for null/unknown quality (passes cap filter); `qualityRank` returns `-1` (lowest priority); covered by "unknown-quality variant wins as fallback when only 4K exceeds cap", "returns false for unknown quality string", "null quality is lowest priority" |
| 5 | Existing language/source priority semantics remain intact | **PASS** | All pre-existing audio, subtitle, source-priority, and tie-break tests continue to pass |
| 6 | Automated tests cover above-cap, below-cap, no-cap, unknown-quality and tie scenarios | **PASS** | 6 `isAboveCap` unit tests + 7 `maxVideoQuality cap` integration tests in the new test suite |

---

### Test run results

```
Test Files  28 passed (28)
     Tests  389 passed (389)
  Duration  1.36s
```

---

### TypeScript check

`tsc --noEmit` reports errors in `vertical-slice.test.ts`, `sources.test.ts`, and `catalog-sync-service.test.ts`. **These are pre-existing**: running the same check on the stashed (pre-T034) state produces an identical error list. No new type errors were introduced by this change.

---

### Regressions

None observed. All 389 tests pass including the full pre-existing suite covering audio language preference, subtitle tiebreaker, source priority, tie-break determinism, and no-availability scenarios.

---

### Validation: PASS

The implementation satisfies all six acceptance criteria. The pre-filter approach in `resolveVariant` (via `isAboveCap`) correctly prevents above-cap variants from ever winning selection, including via ID tie-break, which was the root cause identified in the ticket.
