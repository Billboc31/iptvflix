I have everything I need to produce the report. Let me write it up.

---

## Test Report — T042: Generate Personalized Shelves from Seed Media

**Date:** 2026-08-12  
**Branch:** `ticket/T042-generate-personalized-shelves-from-seed-media-and`  
**Tester:** Claude (Tester role)

---

### Test Execution Results

```
Shelf generation service:  17/17 passed   ✓
Shelves route integration: 44/44 passed   ✓
All API tests:            486/487 passed  (1 pre-existing failure unrelated to T042)
```

**Pre-existing failure (unrelated to T042):**  
`title-matching-service.test.ts > UNMATCHED row is upgraded to MATCHED on retry with a clear winner` — fails due to a `movies_tmdb_id_unique` duplicate key violation from shared test state. This test was failing before T042 work began and is not caused by any T042 change.

---

### Acceptance Criteria

**AC1 — A user can select at least 3 canonical Movies/Series and create a generated Shelf.**  
**PASS**

- `generateShelfFromSeeds` validates `3 ≤ seedMediaIds.length ≤ 10` with a `ValidationError` otherwise (`shelf-generation-service.ts:174`).
- `GenerateShelfDialog.tsx:179` disables the Generate button until `seeds.length >= 3`.
- Covered by: service "seed count validation" (4 tests), route "creates a GENERATED shelf and returns 201".

---

**AC2 — The Shelf contains ranked recommendations derived from the seeds and current recommendation engine.**  
**PASS**

- `resolveGeneratedMembers` calls `rankRecommendations` with `preferGenreIds` inferred from seed genres, plus any user-supplied constraints (`shelf-generation-service.ts:138–144`).
- Candidates are ranked and inserted in score order (position index preserved).
- Covered by: service "deterministic generation" and "preferGenreIds derived from seeds" tests.

---

**AC3 — Seed titles themselves are not duplicated as recommendations unless explicitly allowed by a documented rule.**  
**PASS**

- After ranking, a `seedIdSet` filters out any candidate whose `mediaId` matches a seed before member selection (`shelf-generation-service.ts:147–148`).
- Covered by: service "seed exclusion" test — verifies a seed ID returned by the ranker is absent from the final member list.

---

**AC4 — Shelf members are canonical Media, never provider item IDs or raw external candidates.**  
**PASS**

- Discovery candidates are always routed through `materializeDiscoveryCandidate`, which returns a canonical `movies.id` / `series.id` before building the member list (`shelf-generation-service.ts:151–159`).
- No raw `discoveryCandidate.id` ever reaches `shelfMembers`.
- Covered by: service "deduplication" and "materialization" tests.

---

**AC5 — External candidates are safely deduplicated/materialized when durable membership requires it.**  
**PASS**

- `materializeDiscoveryCandidate` short-circuits when `canonicalMovieId` / `canonicalSeriesId` is already set, reusing the existing canonical ID without creating a duplicate record (`shelf-generation-service.ts:30, 50`).
- Only when no canonical link exists does it insert a new `movies` / `series` row (zero-Availability) and update the discovery candidate FK.
- Covered by: deduplication test (2 inserts total — shelf + members, no extra movie insert) and materialization test (3 inserts — canonical movie + shelf + members, plus 1 update to link FK).

---

**AC6 — The generated Shelf stores enough intent/provenance to be refreshed later.**  
**PASS**

- `rules` JSONB stores `seedMediaIds`, `mediaType`, `availableToMe`, `limit`, `inferredGenreIds`, `generatedAt` (`GeneratedShelfRules` type in `packages/api-contracts/src/shelves.ts:64`).
- `refreshGeneratedShelf` fully reconstructs from stored rules without any external lookup (`shelf-generation-service.ts:240–285`).
- `generatedAt` is updated on each refresh.
- Covered by: service "persistence" test (verifies `type`, `seedMediaIds`, `inferredGenreIds`, `generatedAt` in DB insert) and all 4 "refresh" tests.

---

**AC7 — Optional constraints are validated server-side and reuse existing availability semantics.**  
**PASS**

- `availableToMe` and `mediaType` are passed through to `rankRecommendations`, which enforces existing availability semantics (not re-implemented in the generation service).
- Route layer validates `seedMediaIds[*].mediaType` and the top-level `mediaType` enum before the service is called.
- Covered by: service "availableToMe constraint" test, route tests "returns 400 for invalid seed mediaType" and "returns 400 for invalid top-level mediaType".

---

**AC8 — Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence.**  
**PASS** (with a minor note)

| Required coverage | How covered | Status |
|---|---|---|
| Seed validation | 4 unit tests (< 3, = 1, > 10 seeds; unknown seed) | ✓ |
| Deterministic generation | 1 unit test (same seeds → same member order) | ✓ |
| Deduplication | 1 unit test (existing canonical link reused) | ✓ |
| Unavailable candidates | Covered within deduplication and materialization tests (candidate with `available: false`, `source: 'DISCOVERY'`) | ✓ implicit |
| Persistence | 1 unit test (verifies GENERATED type, rules JSONB content) | ✓ |

**Minor note:** "Unavailable candidates" is not a standalone named test suite — it is covered implicitly inside the deduplication and materialization scenarios. The behavior is tested but the intent is not labelled for future readers.

---

### Additional Observations (non-blocking)

**Duplicate seed IDs not covered by a dedicated test.** The service correctly rejects duplicate `mediaId` values within `seedMediaIds` (`shelf-generation-service.ts:178–181`), but no unit or route test exercises this path. The logic is simple and unlikely to regress, but a test case would make AC8 complete on this edge.

**`refreshGeneratedShelf` ForbiddenError not tested.** The service throws `ForbiddenError` when `shelf.profileId !== profileId` (`shelf-generation-service.ts:246`), but no test exercises this path for the refresh endpoint. This is low risk given multi-profile is not yet an active feature.

---

### Verdict

**PASS — implementation satisfies all acceptance criteria.**

All 8 acceptance criteria are met. Tests are comprehensive at both unit (17) and integration (44) levels. The two minor gaps (no dedicated duplicate-seed test, implicit rather than explicit unavailable-candidate coverage) are not blocking.
