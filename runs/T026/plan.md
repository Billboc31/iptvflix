## Objective
Fix the Shelf evaluator so that `availableToMe` behaves as a tri-state filter (undefined / true / false) for both Movies and Series, and prevent `watchState` from being silently ignored for Series by rejecting it at validation time with a clear error.

## Included

### `apps/api/src/services/shelf-service.ts`

**`validateDynamicRules()` — reject unsupported `watchState` combinations**
- After the existing `watchState` value check, add a guard: if `watchState` is supplied and `mediaType !== 'MOVIE'`, return a validation error `"watchState is only supported when mediaType is 'MOVIE'"`.
- This covers `mediaType: 'SERIES'` explicitly and the unspecified (mixed) case, where the evaluator would apply `watchState` to movies but silently ignore it for series.

**`evaluateMovies()` — tri-state `availableToMe`**
- Replace the current truthy guard (`rules.availableToMe ? inArray(...) : undefined`) with an explicit three-branch check:
  - `rules.availableToMe === true` → `inArray(movies.id, subquery WHERE status='AVAILABLE')`
  - `rules.availableToMe === false` → `notInArray(movies.id, subquery WHERE status='AVAILABLE')`
  - `rules.availableToMe === undefined` → `undefined` (no filter)

**`evaluateSeries()` — tri-state `availableToMe`**
- Apply the identical three-branch pattern using `seriesAvailabilities`.
- Remove the now-dead `watchState`-ignored comment (line ~261); the validator rejects it before reaching here.

### `apps/api/src/routes/__tests__/shelves.test.ts`

Add test cases for:
- Validation: `watchState` with `mediaType: 'SERIES'` → 400 with message `"watchState is only supported when mediaType is 'MOVIE'"`.
- Validation: `watchState` without `mediaType` → 400 with the same message.
- Validation: `watchState` with `mediaType: 'MOVIE'` → still accepted (regression guard).
- Evaluation: `availableToMe: false` for movies → returns only movies with no `AVAILABLE` availability record (including zero-availability movies).
- Evaluation: `availableToMe: false` for series → returns only series with no `AVAILABLE` availability record (including zero-availability series).
- Evaluation: omitting `availableToMe` for movies → returns both available and unavailable.
- Evaluation: omitting `availableToMe` for series → returns both available and unavailable.

## Excluded

- Implementing a Series-level `watchState` derived from episode progress (no semantics defined; a follow-up ticket should define UNWATCHED / IN_PROGRESS / COMPLETED at series level before coding it).
- Changes to the `ShelfRuleDefinition` contract type in `packages/api-contracts/src/shelves.ts` — `watchState` remains in the type since it is still valid for movies; the constraint is enforced server-side.
- Natural-language shelf creation, recommendation ranking, or new rule types.
- Front-end changes.

## Acceptance criteria

- `GET /shelves/:id` with a dynamic shelf using `availableToMe: true` returns only media that has at least one `movieAvailabilities` / `seriesAvailabilities` row with `status = 'AVAILABLE'`.
- `GET /shelves/:id` with `availableToMe: false` returns only media with **no** such row, including media with zero availability rows.
- `GET /shelves/:id` with `availableToMe` omitted returns media regardless of availability status.
- The same semantics apply symmetrically to movies and series.
- `POST /shelves` with `{ rules: { mediaType: 'SERIES', watchState: 'IN_PROGRESS' } }` returns HTTP 400 with `"watchState is only supported when mediaType is 'MOVIE'"`.
- `POST /shelves` with `{ rules: { watchState: 'IN_PROGRESS' } }` (no `mediaType`) returns HTTP 400 with the same message.
- `POST /shelves` with `{ rules: { mediaType: 'MOVIE', watchState: 'IN_PROGRESS' } }` continues to return HTTP 200.
- All new test cases pass; no existing tests regress.
