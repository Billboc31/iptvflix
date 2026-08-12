---

**VALIDATION_APPROVED**

All 8 acceptance criteria pass. Here is the summary:

| AC | Status | Key Evidence |
|---|---|---|
| External discovery returns results for titles not in local catalog | ✅ PASS | `search.ts` threshold + integration test (line 549) |
| Opening creates canonical record with zero availabilities | ✅ PASS | `materializeMovie` + integration test (line 600) |
| Upcoming title has a useful detail page | ✅ PASS | `deriveReleaseStatus` + "À venir" badge + web test |
| No duplicates between local and external results | ✅ PASS | TMDB ID exclusion set + integration test (line 569) |
| Provider failure leaves local search usable | ✅ PASS | `try/catch` returning `[]` + integration test TMDB-500 (line 651) |
| UI distinguishes "not available" from "not found" | ✅ PASS | Grey/amber badge variants + `EmptyState` + 2 web tests |
| Provider calls bounded/cached | ✅ PASS | TTL 60s, cap 5, threshold ≤ 5, cache unit test |
| Automated tests cover all scenarios | ✅ PASS | 326 API tests, 61 web tests — all green |

No regressions detected across the full test suites. The 4 pre-documented non-blocking limitations (missing `releaseStatus` on detail page, TOCTOU race, lazy cache eviction, v3 key silent fail) remain acceptable within the ticket scope.

Full report saved to `runs/T019/test-report.md`. State updated to `VALIDATION_APPROVED`.
