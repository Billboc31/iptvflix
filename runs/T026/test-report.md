# Test Report — T026: Fix dynamic Shelf availability filtering and unsupported rule semantics

## Command executed

```
pnpm --filter api test
```

## Result

```
Test Files  28 passed (28)
     Tests  361 passed (361)
  Duration  1.33s
```

No failures. No regressions.

---

## Acceptance criteria

### AC1 — `availableToMe=true` returns only Media with at least one current AVAILABLE availability

**PASS**

- `shelf-service.ts` lines 175–182: `rules.availableToMe === true` produces `inArray(movies.id, subquery WHERE status='AVAILABLE')`.
- `shelf-service.ts` lines 263–270: identical for series using `seriesAvailabilities`.
- `shelves.test.ts` line 588: `availableToMe: true for movies` — mock returns only `movieAvailable`, asserts `items[0].mediaId === 'movie-live'`.
- `shelves.test.ts` line 601: `availableToMe: true for series` — same pattern for series.

---

### AC2 — `availableToMe=false` returns only Media with no current AVAILABLE availability, including zero-availability Media

**PASS**

- `shelf-service.ts` lines 183–191: `rules.availableToMe === false` produces `notInArray(movies.id, subquery WHERE status='AVAILABLE')`. Rows with no availability record are naturally included by `NOT IN`.
- `shelf-service.ts` lines 271–279: identical for series.
- `shelves.test.ts` line 540: `availableToMe: false for movies` — mock returns only `movieUnavailable`, asserts `items[0].mediaId === 'movie-upcoming'`.
- `shelves.test.ts` line 564: same for series.

---

### AC3 — Omitting `availableToMe` leaves availability unrestricted

**PASS**

- `shelf-service.ts` line 191: `undefined` branch returns `undefined` (no SQL condition added).
- `shelves.test.ts` line 553: `availableToMe: undefined for movies` — mock returns both `movieUnavailable` and `movieAvailable`, asserts `items.length === 2`.
- `shelves.test.ts` line 577: same for series.

---

### AC4 — Movie and Series rules use consistent availability semantics

**PASS**

- `evaluateMovies()` (lines 175–191) and `evaluateSeries()` (lines 263–279) use the same three-branch `=== true` / `=== false` / `undefined` pattern over their respective availability tables (`movieAvailabilities` / `seriesAvailabilities`).

---

### AC5 — An explicitly supplied `watchState` for Series is either correctly evaluated or rejected with a clear validation error; it is never silently ignored

**PASS** (rejected with clear error)

- `shelf-service.ts` lines 148–156: after value validation, guard `result.mediaType !== 'MOVIE'` throws `"watchState is only supported when mediaType is 'MOVIE'"`.
- Covers `mediaType: 'SERIES'` explicitly (line 152) and missing `mediaType` (same guard — `result.mediaType` is `undefined`, which is not `'MOVIE'`).
- `shelves.test.ts` unit tests (lines 208–223): `watchState` + SERIES → throws; `watchState` without `mediaType` → throws; `watchState` + MOVIE → accepted.
- `shelves.test.ts` integration tests (lines 329–364): HTTP 400 with matching error message for rejected combinations; HTTP 201 for `MOVIE`.

---

### AC6 — Dynamic Shelf results refresh correctly when availability changes

**PASS** (structural guarantee)

- Availability is computed at query time from the database with no caching layer. Each `GET /shelves/:id` re-evaluates the full `inArray` / `notInArray` subquery. No in-memory cache or stale result path exists in the code path.

---

### AC7 — Automated tests cover true/false/undefined availability filters for Movies and Series plus Series `watchState` behavior

**PASS**

| Scenario | Test location |
|---|---|
| `availableToMe: true`, movies | `shelves.test.ts` line 588 |
| `availableToMe: false`, movies | `shelves.test.ts` line 540 |
| `availableToMe: undefined`, movies | `shelves.test.ts` line 553 |
| `availableToMe: true`, series | `shelves.test.ts` line 601 |
| `availableToMe: false`, series | `shelves.test.ts` line 564 |
| `availableToMe: undefined`, series | `shelves.test.ts` line 577 |
| `watchState` + SERIES → 400 | `shelves.test.ts` lines 208, 329 |
| `watchState` + no mediaType → 400 | `shelves.test.ts` lines 214, 339 |
| `watchState` + MOVIE → 201 | `shelves.test.ts` lines 220, 349 |

---

## Regressions

None. All 325 pre-existing tests continue to pass alongside the 36 tests in `shelves.test.ts`.

## Blocking issues

None.

## Decision

TESTS_PASSED
