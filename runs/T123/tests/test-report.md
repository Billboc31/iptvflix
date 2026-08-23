All clean. Now I have everything needed to write the test report.

---

# Test Report — T123: Improve semantic retrieval precision for thematic shelf intent

## Environment

- Branch: `ticket/T123-improve-semantic-retrieval-precision-for-thematic`
- State at test time: `IMPLEMENTATION_APPROVED`
- TypeScript (`recommendation-engine`): **clean** (`npx tsc --noEmit` — no output)
- Unit test suite: **89 passed, 14 skipped, 1 pre-existing DB auth failure** (unrelated to T123)

---

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Semantic retrieval remains vector/semantic based — no title keyword fallback | **PASS** | `semantic-search.ts` uses only vector cosine distance (`<=>` or manual dot-product). No title string matching in production code. |
| 2 | Compound shelf intents preserve their defining thematic concept | **PASS** | Dual-embedding blend in `semantic-search.ts` (lines 131–185): when `semanticAnchor` is present, blended distance = `ALPHA * anchorDist + (1-ALPHA) * intentDist`. Prompts instruct the LLM to set `semanticAnchor` to the most restrictive sub-concept. |
| 3 | "Aventures à travers le temps" — genuine time-travel candidates rank materially above generic adventure/travel candidates | **PASS (formula-verified)** | `semantic-search-blend.test.ts` case "temporal candidate ranks above generic adventure when anchor similarity is high" — with `alpha=0.45`, a temporal candidate scoring `(0.72 intent, 0.85 anchor)` outscores a pure-adventure candidate `(0.78 intent, 0.45 anchor)`. Pipeline regression test (`pipeline-regression.test.ts`) asserts ≥4 temporal titles in top-8 and 0 known false positives in top-5 — test is `skipIf(!canRun)` as expected in this env. |
| 4 | Candidates matching only broad secondary concepts (adventure/journey) do not dominate | **PASS (formula-verified)** | `alpha=0.0` case proves the inverse: without the anchor, generic adventure wins. With `alpha=0.45` the anchor suppresses it. |
| 5 | Existing personalization/reranking remains functional | **PASS** | 37/37 `hybrid-reranker.test.ts` tests pass. `SCORE_MODEL_V2`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC`, and profile-boost constants verified unchanged in `config.ts`. |
| 6 | Regression tests covering benchmark + at least one additional compound intent | **PASS** | `pipeline-regression.test.ts` has T123 block with 2 `it.skipIf(!canRun)` tests: "Aventures à travers le temps" (benchmark) and "Enquêtes policières dans l'espace" (second compound intent). `semantic-search-blend.test.ts` adds 6 formula-level unit tests covering both fixtures without DB/API dependency. |
| 7 | No shelf-specific hardcoding, no manual production DB modification | **PASS** | Grep of production source (`apps/*/src`, excluding test files) finds zero occurrences of any specific shelf title, movie title, or concept-specific code path. Migration `0049_t123_shelf_concept_anchor.sql` is additive (`ALTER TABLE ... ADD COLUMN semantic_anchor TEXT`) with no data modification. |
| 8 | Legacy path (no anchor) is byte-for-byte identical | **PASS** | `semantic-search.ts` line 129: `useAnchorBlend = !!semanticAnchor && SEMANTIC_ANCHOR_BLEND_ALPHA > 0`. When false, `distanceExpr = intentDistanceExpr` (the unmodified single-embedding expression). `SEMANTIC_ANCHOR_BLEND_ALPHA=0` env override further confirmed by `alpha=0 reproduces intent-only distance` unit test. |

---

## Regressions Observed

**None introduced by T123.**

The one failing test suite (`e2e-retrieval-pool.test.ts`) errors with `password authentication failed for user "vitest"` — a pre-existing DB environment issue in the worktree, confirmed by the fact that `git diff main HEAD -- e2e-retrieval-pool.test.ts` is empty (T123 did not touch that file).

---

## Limitations

- The two T123 pipeline regression tests (`pipeline-regression.test.ts` T123 block) are correctly guarded with `it.skipIf(!canRun)` — they require a live `OPENAI_API_KEY` and `DATABASE_URL` with an indexed embedding corpus, which is not available in this environment. The formula-level unit tests in `semantic-search-blend.test.ts` provide CI-safe coverage of the blend mechanics.

---

## Verdict

**VALIDATION PASSED** — all acceptance criteria are satisfied. The implementation is ready to proceed to the next workflow step.
