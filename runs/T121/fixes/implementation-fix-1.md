# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T121/reviews/implementation-review.md
- generated at: 2026-08-23T13:20:40Z

---

I now have everything I need. Let me write the structured review.

---

## Review — T121: Preserve semantic intent during SCORE_MODEL_V2 personalized reranking

### Summary

The implementation introduces a three-tier semantic protection model (`strict`/`moderate`/`none`), a `'thematic'` weight blend, configurable floors via env vars, enriched score breakdown, and intent-aware reason codes. The approach is architecturally sound and correctly scoped. Two issues require a fix before approval.

---

### 1. Correctness against ticket requirements

#### Formal acceptance criteria

| AC | Status | Notes |
|----|--------|-------|
| Formula/pondération V2 auditée et documentée | ✅ | Embedded in constants and `'thematic'` blend definition. Explicit audit doc excluded by plan. |
| Protection sémantique explicite pour shelves thématiques | ✅ | Floor + weight boost via `semanticProtection` on plan |
| Mécanisme configurable/versionné | ✅ | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC` in `config.ts` |
| `semanticSimilarity` et sa contribution visibles | ✅ | `semantic` + `semanticContribution` in `ScoreBreakdown` |
| Reasons expliquent intention + profil | ✅ | Intent-aware `buildReasons` with `semanticIntent` from plan |
| Candidat faible ne peut être sauvé par genre/langue/ère | ✅ | Floor excludes before scoring; math proof in unit test |
| `Aventures à travers le temps` dominée par contenus temporels | ✅ | Regression test updated, `semanticProtection: 'moderate'`, 2 semantic assertions |
| `SF qui fait réfléchir` et `film qui retourne le cerveau` fidèles à l'intention | ✅ | New regression tests added |
| Usages discovery/profil-only restent libres | ✅ | `'none'` → `'exploit'` blend, no floor; pre-existing paths unchanged |
| Pas de retour au ranking vector-only | ✅ | Personalization remains active at all protection levels |

#### Section 4 requirement — score breakdown per signal

The ticket requires exposing "au minimum":
```
semanticSimilarity, semanticContribution,
profileGenreContribution, profileThemeContribution, peopleContribution,
languageContribution, eraContribution, otherPositiveContributions,
penalties, finalScore
```

Current state:
- `semantic`, `semanticContribution` ✅ (new)
- `profileContribution` (aggregate only) — individual per-signal contributions **not added**
- `genreAffinity`, `themeAffinity`, `languageAffinity`, etc. expose raw signals but not weighted contributions
- `penalties` ✅ (all individual penalty fields already existed)
- `final` (= finalScore) ✅

**Gap:** The Lab cannot compute `profileGenreContribution = genreAffinity × wGenre` without knowing which weight blend was used (`exploit` vs `thematic`), and the blend used is not surfaced in the breakdown. The raw affinities alone are insufficient for the Lab transparency goal in section 4.

#### Metrics / évaluation section

The ticket asks for:
- Avg `semanticSimilarity` top-5/10/20 before vs after rerank
- Count candidates below floor in final
- Rank correlation vectoriel vs final
- Signal when reranker promotes a far-back candidate despite weak semantic score

None of these are implemented. The plan explicitly excluded UI changes, but these are API/data-layer metrics, not UI. This section is not addressed. Flagged as deferred, not blocking.

---

### 2. Scope compliance

No drift detected. Changes confined to: API contracts, config, shelf-concept mapper, routes, hybrid-reranker, and tests. Free-text query path and semantic retrieval stage are untouched. LLM planner prompt is out of scope as documented in the plan.

---

### 3. Code quality

**Positive:**

- Floor applied before scoring, not as a penalty — semantically clean, no edge cases where profile partially rescues a below-floor candidate.
- `profileContribution` formula correctly isolates profile signals: `weighted − semanticContribution − fresh×wFreshness − prior×wPrior − avail×wAvailability`. Correct.
- `resolveSemanticProtection` in `shelf-concept-mapper.ts` is clean, exhaustive, and safe-defaults to `'moderate'` for unknown generation types.
- `getBlendedWeights` exported for testability — good.
- Config constants well-commented and env-overridable without magic numbers in scoring code.

**Weight sum observation:**

SCORE_MODEL_V2 sums to **1.10** (not 1.00 as stated in the plan). The `'thematic'` blend sums to **1.08**. Neither equals 1.0. The plan's acceptance criterion "weights sum to the same total as V2 baseline (≤ 1.0)" is doubly incorrect: V2 itself is not ≤ 1.0, and the two sums differ by 0.02. Functionally, this is not a bug since scoring is not normalized, but the plan criterion is wrong and should be struck or corrected.

**Intent truncation:**

```typescript
semanticIntent.trim().split(/\s+/).slice(0, 3).join(' ')
```

For `'Aventures à travers le temps'` (5 words), reason will read: `"strong semantic match to Aventures à travers"`. This truncates the intent and can be misleading. Minor UX issue for the Lab; not blocking.

---

### 4. Tests — BLOCKING ISSUE

#### Unit tests (hybrid-reranker.test.ts)

The "semantic floor protection" tests verify **constant values, not filter behavior**:

```typescript
// These are mathematical assertions on numbers, not tests of filter logic
expect(0.20 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(0.27 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(SEMANTIC_FLOOR_MODERATE >= SEMANTIC_FLOOR_MODERATE).toBe(true)
expect(0.35 >= SEMANTIC_FLOOR_MODERATE).toBe(true)
```

None of these tests call any filtering function. They would pass even if the floor filter was completely removed from `runHybridReranker`. The plan explicitly required:

> "a candidate with `similarity = 0.20` is excluded before scoring regardless of genre/language affinity"

That property is not tested. The "profile cannot override semantic" test is better — it computes hypothetical scores and proves the math — but it still doesn't call `runHybridReranker` or the filter lambda.

The actual filter is:
```typescript
const eligible = enriched.filter(
  (c) => passesHardFilters(c, plan) && (semanticFloor === 0 || (c.similarity ?? 0) >= semanticFloor),
)
```

There is no test that verifies:
1. `plan.semanticProtection = 'moderate'` causes `semanticFloor = SEMANTIC_FLOOR_MODERATE`
2. The filter excludes candidates with `similarity < semanticFloor`

**Required fix:** Add at minimum one test that verifies the filter wiring. Options:
- Extract the floor-filter predicate to a named/exported function and unit-test it with controlled inputs, OR
- Test `runHybridReranker` with a mocked DB, injecting candidates with known `similarity` values and asserting exclusion

#### Regression tests (pipeline-regression.test.ts)

These are acceptable — they're correctly skipped when `OPENAI_API_KEY` is absent, consistent with the existing pattern, and assertions are meaningful (floor check on top-5, semantic dominance check on top-10). The "film qui retourne le cerveau" spread assertion (`maxSemantic - minSemantic < 0.25`) is pragmatic.

---

### 5. Blocking issues

**BLOCKER 1 — Unit tests verify constants, not filter behavior**

The floor protection tests do not test that `runHybridReranker` (or the filter predicate) actually excludes candidates below the floor. A test that removes the floor filter from the code would still pass all current unit tests. The plan required behavioral verification of exclusion.

**BLOCKER 2 — Individual profile signal contributions absent from ScoreBreakdown**

Section 4 of the ticket requires per-signal weighted contributions (`profileGenreContribution`, `languageContribution`, etc.) "au minimum". Only aggregate `profileContribution` is added. Since the blend weights (`wGenre`, `wLanguage`, etc.) vary between `'exploit'` and `'thematic'` and are not exposed in the breakdown, the Lab cannot derive per-signal contributions from the raw affinity values alone. The Lab transparency goal of section 4 is only partially met.

---

### 6. Minor observations (non-blocking)

- Plan criterion "weights sum to V2 baseline (≤ 1.0)" is incorrect: V2 = 1.10, thematic = 1.08. Not a functional issue but the plan text is wrong.
- Intent truncated to 3 words in reason strings — may misrepresent longer intents.
- Metrics/évaluation section (avg semanticSimilarity before/after, rank correlation) not addressed — defer to a follow-up ticket.
- Completion Rule requires Lab validation on real concepts showing `bon Raw Vector → reranking → final fidèle à l'intention` with score breakdown. Implementation provides the data; human Lab validation remains required before closing.

---

IMPLEMENTATION_FIX_REQUIRED
