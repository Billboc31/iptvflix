---

## Test Report — T127: TESTING_PASSED

**34/34 tests pass** (19 `hero-selector.test.ts` + 15 `home-snapshot.test.ts`).

### Acceptance criteria — all 10: PASS

| Criterion | Status | Evidence |
|---|---|---|
| No first-eligible-by-order behavior | PASS | Tests #1, #2: 3rd/7th candidate wins |
| Dedicated versioned/configurable formula | PASS | `HERO_SCORE_WEIGHTS v1` in `env.ts`, env-configurable thresholds |
| Multiple candidates evaluated | PASS | Pool=15, test #2 evaluates 10 candidates |
| Profile relevance primary (0.45 weight) | PASS | Test #7: Parasite wins via profileScore despite low languageAffinity |
| Hero can pick lower-ranked Pour toi item | PASS | Tests #1–3; integration excludes hero from rail |
| Catalog noise less likely | PASS | Test #3: obscure film (low qualityPrior) loses to quality film |
| No candidate → null | PASS | Empty list, gate failures, all-no-backdrop → `null` |
| 24h snapshot stability preserved | PASS | 15 snapshot tests: MISS/HIT/STALE/hero-stability all pass |
| Debug/observability | PASS | `[HERO_RANKING]` log with full ranked array and sub-scores |
| No hardcoding | PASS | No mediaId/country/language constants in code |

### Regressions: none

Pre-existing failures in the full suite (33 tests) are integration tests requiring PostgreSQL at port 5433 — unrelated to this ticket, not introduced by it.

### Non-blocking notes
- `HERO_SCORE_WEIGHTS` are code-level constants (deploy required to change); acceptable for v1.
- No per-candidate rejection reason logged for gate-failed items (disliked/unavailable/no-backdrop not individually named in the null log).
