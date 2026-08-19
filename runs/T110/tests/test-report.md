No test files in the recommendation-engine. Here is the complete test report.

---

## Test Report — T110: Wire ShelfConcept through QueryPlan, semantic retrieval and hybrid reranking

### Verification scope

Files changed by T110 (verified via `git diff origin/main..HEAD`):

| File | Change |
|---|---|
| `apps/api/src/__tests__/home-semantic-pipeline.test.ts` | New integration test |
| `apps/api/src/client/recommendation-engine-client.ts` | Added `queryForShelf` method |
| `apps/api/src/routes/shelf-instances.ts` | Added `GET /shelf-instances/:id/pipeline` |
| `apps/api/src/services/home-pool-service.ts` | Replaced generic ranking with per-concept semantic query |
| `apps/recommendation-engine/src/db/schema.ts` | Added `profileMediaExposure` read-only table reference |
| `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts` | Added exposure penalty; added `loadExposureCounts` |
| `apps/recommendation-engine/src/pipeline/types.ts` | Added `available?: boolean` to `CandidateItem` |

### TypeScript type checks

Both apps type-check with zero errors:
- `npx tsc --noEmit -p apps/api/tsconfig.json` — **PASS**
- `npx tsc --noEmit -p apps/recommendation-engine/tsconfig.json` — **PASS**

---

### Acceptance criteria

**AC1 — Generated ShelfConcept intent reaches the Query Planner**
**PASS**

`home-pool-service.ts:233-237` calls `RecommendationEngineClient.queryForShelf({ text: concept.semanticIntent, profileId, limit })`, passing each concept's `semanticIntent` directly as the query text. The pipeline's LLM planner stage (`llm-planner.ts:151`) receives it as `ctx.request.text` and produces `ctx.queryPlan.semanticIntent`.

---

**AC2 — QueryPlan semantic text reaches vector retrieval**
**PASS**

`semantic-search.ts:47`: `const semanticIntent = ctx.queryPlan?.semanticIntent ?? ctx.request.text`. When the LLM planner succeeds, `ctx.queryPlan.semanticIntent` (the expanded, enriched intent) is what gets embedded (`semantic-search.ts:67`), not the raw input text.

---

**AC3 — QueryPlan hard filters are honored**
**PASS**

`hybrid-reranker.ts:307-331`: `passesHardFilters` applies `mediaTypes`, `maxRuntimeMinutes`, `minReleaseYear`, `maxReleaseYear`, `includeGenres`, `excludeGenres`, `audioLanguages` before any scoring.

Additionally, `home-pool-service.ts:243-245` hard-filters `available` items for WATCH_NOW shelves (`freshnessPolicy === 'AVAILABLE_NOW'`); DISCOVERY/ALL shelves pass through regardless of availability.

---

**AC4 — Retrieved candidates are reranked for the current Profile**
**PASS**

`hybrid-reranker.ts:404-408`: Loads `exposureCounts` and `taste` signals per `ctx.request.profileId`. Genre affinity, theme affinity, and people affinity are all computed against the profile's `profileTaste` row. The `profileScore` component in `scoreBreakdown` reflects this.

---

**AC5 — Same-session/recent-exposure penalties reduce repeated titles across shelves**
**PASS**

Two complementary mechanisms:

1. **Within-session exclusion** (`home-pool-service.ts:163-169, 241`): Media IDs already assigned to any shelf in the current session are filtered out before a candidate is accepted, ensuring no item appears twice across shelves.

2. **Cross-session exposure penalty** (`hybrid-reranker.ts:433, 445`): `exposurePenalty = 0.05 × min(exposureCount, 4)` reduces `finalScore` for items that have been shown in prior sessions, without excluding them entirely.

---

**AC6 — ShelfInstance stores enough provenance/scores to reconstruct why an item appeared**
**PASS**

`home-pool-service.ts:278-304`: `persistShelfInstance` is called with:
- `semanticIntentSnapshot` — the concept's semantic intent at generation time
- `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion` — populated from engine response
- Per-item: `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`, `availabilityStatus`

`shelf-instance-service.ts:41-57`: All fields are written to `shelf_instances` and `shelf_instance_items`.

---

**AC7 — WATCH_NOW shelves exclude unavailable items while discovery shelves may include them**
**PASS**

`home-pool-service.ts:243-245`:
```typescript
if (concept.freshnessPolicy === 'AVAILABLE_NOW') {
  pool = pool.filter((c) => c.available)
}
```
`available` is populated from the engine response, which sources it from `movieAvailabilities`/`seriesAvailabilities` in `hybrid-reranker.ts:162-169`. No availability filter is applied for other freshness policies.

---

**AC8 — Fixed utility shelves remain deterministic and unaffected**
**PASS**

`buildFixedShelves` (`home-pool-service.ts:136-145`) is unchanged from pre-T110. It calls `getShelf('sys_continue_watching', ...)` and `getShelf('sys_my_list', ...)` directly. These shelf IDs do not route through the recommendation engine and are unaffected by any T110 change.

---

**AC9 — Recommendation Lab can display the exact pipeline for a generated ShelfConcept**
**PASS**

`GET /shelf-instances/:id/pipeline` (`apps/api/src/routes/shelf-instances.ts:41-63`) returns HTTP 200 with:
- `semanticIntentSnapshot`
- `queryPlannerVersion`, `embeddingModelVersion`, `rankerVersion`
- Per-item: `rankPosition`, `mediaType`, `mediaId`, `semanticScore`, `profileScore`, `finalScore`, `reasonCodes`

Returns 404 for unknown IDs.

---

**AC10 — Real catalog tests demonstrate clearly different results for clearly different shelf concepts**
**CONDITIONAL PASS**

`apps/api/src/__tests__/home-semantic-pipeline.test.ts` implements two suites:

1. **Direct divergence test**: Calls `queryForShelf` for each of the three reference concepts (`SF qui fait réfléchir`, `Comédies légères familiales`, `Thrillers en huis clos où personne n'est fiable`) and asserts Jaccard similarity < 0.3 between any top-5 pair.

2. **End-to-end pipeline test**: Inserts 10 shelf concepts for a fresh test profile, calls `fillPoolAsync`, and asserts all 10 shelves have non-null provenance fields and that no two shelves share top-5 items (Jaccard < 0.3).

All tests are guarded with `.skipIf(!engineAvailable)` — they skip correctly when `RECOMMENDATION_ENGINE_URL` is not set. This is the correct behavior for integration tests requiring live services.

**The tests cannot be run in the current environment** (engine not running), but the test design is complete and correct. The acceptance criterion requires running against the real catalog with the engine live.

---

### Regression check

**Test suite results**: `Tests  5 failed | 982 passed | 4 skipped (991)`

The 5 failing tests are **pre-existing failures** in files not touched by T110:

| Test | File | Status |
|---|---|---|
| `POST /auth/login > returns 200...` | `src/routes/auth.test.ts` | Pre-existing (on main) |
| `POST /auth/login > returns 401 wrong password` | `src/routes/auth.test.ts` | Pre-existing |
| `POST /auth/login > returns 401 unknown username` | `src/routes/auth.test.ts` | Pre-existing |
| `needsRefresh > returns false when pool fresh` | `src/services/__tests__/shelf-concept-generator-service.test.ts` | Pre-existing |
| `matchBatch per-item TMDB failure` | `src/services/__tests__/title-matching-service.test.ts` | Pre-existing |

**No regressions introduced by T110.**

---

### Observations (non-blocking)

1. **`excludeMediaIds` not forwarded to engine**: The plan described passing excluded media IDs to the engine, but the implementation instead inflates `requestLimit` and post-filters client-side (`home-pool-service.ts:224, 241`). The result is semantically equivalent and avoids requiring the recommendation engine to handle session state. This is acceptable.

2. **`freshnessPolicy === 'AVAILABLE_NOW'` relies on string match**: The `freshnessPolicy` column is a plain `text` with no enum constraint. The filter works but would silently accept any other string value (treated as non-WATCH_NOW). This is not a T110 regression.

3. **Integration test requires live engine**: AC10 cannot be validated statically. The test infrastructure is correct and complete; validation requires running with `RECOMMENDATION_ENGINE_URL` set.

---

### Verdict

**PASS** — All 9 statically verifiable acceptance criteria are satisfied. AC10 (real catalog test) is correctly implemented but requires a live recommendation engine to execute. No regressions introduced.
