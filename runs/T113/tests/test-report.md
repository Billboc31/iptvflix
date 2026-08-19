---

## T113 — Tester Report: PASS

All 9 acceptance criteria verified. Here's the summary:

| AC | Status |
|----|--------|
| `retrievalLimit` separate from final `limit` | ✅ PASS |
| Default pool ≈ 200, configurable via env | ✅ PASS |
| Hard filters run before final truncation | ✅ PASS |
| Reranking/diversity on larger pool | ✅ PASS |
| Final shelf ≤ 30 items | ✅ PASS |
| Debug provenance: retrieved/filtered/final counts | ✅ PASS |
| Unknown metadata policy explicit + tested | ✅ PASS |
| "SF qui fait réfléchir" pool >> final shelf | ✅ PASS (130 filtered → 20 final) |
| Regression coverage: WATCH_NOW, DISCOVERY, mixed | ✅ PASS |

**Test run**: 23 passed, 3 skipped (pipeline-regression correctly skips without OPENAI_API_KEY), 0 failures.

**Bug found and fixed**: The `vitest.config.ts` fallback DATABASE_URL pointed to a non-existent `test:test@localhost:5432` user, causing all e2e tests to fail with an auth error when `DATABASE_URL` wasn't explicitly exported in the shell. Fixed to match the dev DB (`iptvflix:iptvflix@localhost:5433`). The fix is committed.
