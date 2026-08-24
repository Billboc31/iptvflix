# Test Report — T128: Build personalized Movies page with exploitation and discovery shelves

## Validation summary

VALIDATION_PASSED — with one bug fixed during testing (see bug section).

---

## Acceptance criteria

### AC1: Movies page is primarily composed of personalized movie-only horizontal shelves

**PASS**

`buildMoviesDeclaredRails` produces 6 shelves per declared batch (Pour toi, Nouveautés pour toi, 2×thematic PERSONALIZED, 1×EXPLORATION, 1×thematic PERSONALIZED). Frontend `MoviesPage.tsx` renders only `ShelfRow` components with no static genre-filter UI.

---

### AC2: Both shelf themes and shelf contents are personalized

**PASS**

Themes come from `shelf_concepts` filtered by profile via `selectThematicMovieConcept` / `selectExplorationMovieConcept`. Shelf contents are ranked by the recommendation engine against the profile. Unit tests verified that the engine is called with the correct `profileId` for every rail.

---

### AC3: Multiple exploitation themes are dynamically selected and are meaningfully distinct

**PASS**

`buildMoviesDeclaredRails` picks themes from `shelf_concepts` using `usedConceptIds` to prevent concept reuse. Unit test "does not produce two shelves with the same title in a single batch" passes. Unit test "uses separate concept IDs for each thematic slot" passes.

---

### AC4: At least one controlled exploration/serendipity shelf exists

**PASS**

Rail 5 is always an EXPLORATION/DISCOVERY concept, enforced by `selectExplorationMovieConcept`. Unit test "includes at least one EXPLORATION concept in the declared thematic batch" passes.

---

### AC5: Exploration is not pure randomness

**PASS**

`selectExplorationMovieConcept` queries concepts with `generationType IN ('EXPLORATION', 'DISCOVERY')` and requires non-zero semantic scores. Unit test "exploration shelf items have non-zero semantic scores" verifies that items with zero semantic scores from pure random fallback are not accepted.

---

### AC6: Product behavior targets approximately 75% exploitation / 25% exploration

**PASS**

`MOVIES_EXPLORATION_RATIO` defaults to 0.25. `fillMoviesPoolAsync` maintains the ratio across pool slots. Unit test verifies `0.20 <= explorationCount / total <= 0.30` across a generated pool.

---

### AC7: No series leak into movie shelves

**PASS**

Double filter:
1. DB-level: `desiredMediaTypes @> '["MOVIE"]'::jsonb` on concept selection
2. Runtime: `.filter((c) => c.mediaType === 'MOVIE')` on engine candidates

Unit test "filters out SERIES items even if engine returns mixed results" passes: engine returning mixed MOVIE+SERIES results → only MOVIE items reach the shelf.

---

### AC8: Cross-shelf duplicate titles and near-duplicate themes are materially reduced

**PASS**

`excludedMediaIds` set is accumulated across all rails in a session batch. Unit test "a mediaId appearing in rail 1 does not appear in later rails" and "no mediaId appears in more than one shelf" both pass.

Theme diversity: concept IDs are tracked in `usedConceptIds`; same concept cannot appear twice.

---

### AC9: Themes/results remain stable across ordinary refreshes and do not trigger repeated LLM generation within the freshness window

**PASS**

`movies-snapshot-service` implements HIT/STALE/MISS logic:
- HIT: valid snapshot served directly; `buildMoviesDeclaredRails` not called; recommendation engine not invoked
- STALE: old snapshot served immediately; background async regeneration
- MISS: expensive generation runs once; snapshot persisted

Unit tests verify:
- "does NOT call `buildMoviesDeclaredRails` when snapshot valid" — PASS
- "snapshot reused across multiple calls / no expensive generation on repeated HIT" — PASS
- Stale path: "triggers async regeneration", "triggers pool fill" — PASS

---

### AC10: Existing Home and recommendation diagnostic tooling do not regress

**PASS**

Regression test suites run without modification:
- `home-pool-service.test.ts`: 23 passed
- `home-service.test.ts`: 19 passed
- `home-snapshot.test.ts`: 8 passed
- `series-page-service.test.ts`: 5 passed
- `hero-selector.test.ts`: 15 passed

---

### AC11: Automated tests for all required behaviors

**PASS**

`movies-pool-service.test.ts`: 13 tests — movie-only constraint, exploitation/exploration ratio, theme diversity, cross-shelf deduplication, empty concept, error isolation, exploration non-random requirement, pool fill ratio.

`movies-snapshot-service.test.ts`: 21 tests — MISS/HIT/STALE paths, TTL boundary conditions, repeated HIT, empty/error fallback, pure function TTL logic.

All 34 movies-specific tests PASS.

---

## Bug found and fixed during testing

### `series-pool-service.test.ts` — arrow function constructor mock in `beforeEach`

**Classification**: Bug in test file (new file added by T128).

**Root cause**: `beforeEach` called `ShelfInstanceService.mockImplementation(() => ({...}))` and `ShelfFatigueService.mockImplementation(() => ({...}))` with arrow functions. After `vi.resetAllMocks()` clears the factory-level implementations, the `beforeEach` re-applied arrow function implementations. JavaScript cannot use arrow functions as constructors (`new arrowFn()` throws `TypeError`). The service calls `new ShelfInstanceService(db)`, so all 11 series tests failed.

**Fix applied**: Changed both `beforeEach` mock re-applications to use `function () { return {...} }` to match the movies test pattern (which already used the correct form).

```diff
- ;(ShelfInstanceService as any).mockImplementation(() => ({ persistShelfInstance: mockPersistShelfInstance }))
- ;(ShelfFatigueService as any).mockImplementation(() => ({ getFatigueStates: mockGetFatigueStates }))
+ ;(ShelfInstanceService as any).mockImplementation(function () { return { persistShelfInstance: mockPersistShelfInstance } })
+ ;(ShelfFatigueService as any).mockImplementation(function () { return { getFatigueStates: mockGetFatigueStates } })
```

**After fix**: 11/11 series tests pass.

---

## Regressions observed

None. All pre-existing mock-based test suites that were runnable without a live database continue to pass.

Integration tests requiring a real DB (`drizzle-orm` / `dotenv` dependencies) cannot run in this worktree environment (pnpm virtual store not fully installed). This is an environment limitation pre-existing to T128, not a regression.

---

## Blocking issues

None after the bug fix above.

---

## Test execution summary

| Suite | Tests | Status |
|---|---|---|
| `movies-pool-service.test.ts` | 13 | PASS |
| `movies-snapshot-service.test.ts` | 21 | PASS |
| `series-pool-service.test.ts` | 11 | PASS (after fix) |
| `home-pool-service.test.ts` | 23 | PASS |
| `home-service.test.ts` | 19 | PASS |
| `home-snapshot.test.ts` | 8 | PASS |
| `series-page-service.test.ts` | 5 | PASS |
| `hero-selector.test.ts` | 15 | PASS |
| **Total** | **115** | **115 PASS** |

---

## Limitations of validation

- No live database: integration tests requiring postgres/drizzle were not run. These are pre-existing environment constraints, not T128 issues.
- No browser UI validation: the `MoviesPage.tsx` was reviewed structurally (no genre-filter UI, uses `ShelfRow`, intersection observer infinite scroll, per-shelf error boundaries) but could not be visually tested.
- `MOVIES_SNAPSHOT_TTL_HOURS` / stale-while-revalidate behavior was verified by unit test only, not by observing live cache expiry.
