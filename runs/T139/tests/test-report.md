Report saved. Here is the test report:

---

## Test Report — T139

### Results: 68/68 tests pass across 5 relevant test files

| File | Tests | Status |
|------|-------|--------|
| `nouveautes-service.test.ts` | 15/15 | ✅ |
| `home-pool-service.test.ts` | 14/14 | ✅ |
| `movies-pool-service.test.ts` | 13/13 | ✅ |
| `series-pool-service.test.ts` | 11/11 | ✅ |
| `home-snapshot.test.ts` | 15/15 | ✅ no regression |
| `movies-snapshot-service.test.ts` | 0/9 | ⚠️ pre-existing on `main` |
| `series-page-service.test.ts` | 0/7 | ⚠️ pre-existing on `main` |

### Acceptance criteria: all 13 PASS

All criteria verified — freshness-driven ranking (75% recency / 25% quality), no profile input, Tier 1 vs Tier 2 scoring (imported old titles get 0.5× multiplier + release-year guard), media-type constraints at DB query level, `Map`-based deduplication, no LLM call, proper rail positioning on all three pages.

### One non-blocking bug found (not in production code — test setup only)

`vi.resetAllMocks()` in `beforeEach` of `movies-pool-service.test.ts` and `series-pool-service.test.ts` clears the `buildNouveautesItems.mockResolvedValue([])` without restoring it. Every test that calls `buildMoviesDeclaredRails` / `buildSeriesDeclaredRails` hits a `TypeError: Cannot read properties of undefined (reading 'length')` in the Nouveautés rail instead of the clean "fewer than MIN_ITEMS → suppress" path. The `try/catch` swallows it so tests pass, but the integration path is not correctly exercised.

**Fix**: add `vi.mocked(buildNouveautesItems).mockResolvedValue([])` to `beforeEach` in both files, plus a positive test verifying the shelf appears when ≥5 items are returned.

**Verdict: CONDITIONAL PASS** — production code is correct and all ACs are met. The test setup bug should be fixed before merge.
