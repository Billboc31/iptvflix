All 359 tests pass. Here's a summary of the changes:

---

## Changes

### `apps/api/src/services/shelf-service.ts`

**`validateDynamicRules()`** — after validating the watchState value, a new guard rejects the combination when `mediaType` is not `'MOVIE'` (covers both `SERIES` and omitted):
```
if (result.mediaType !== 'MOVIE') throw ValidationError("watchState is only supported when mediaType is 'MOVIE'")
```

**`evaluateMovies()`** — replaced the truthy `rules.availableToMe ? inArray(...) : undefined` with an explicit three-branch check:
- `=== true` → `inArray(movies.id, subquery WHERE status='AVAILABLE')`
- `=== false` → `notInArray(movies.id, subquery WHERE status='AVAILABLE')`
- `=== undefined` → no filter

**`evaluateSeries()`** — identical three-branch pattern applied using `seriesAvailabilities`; removed the now-dead `// watchState is not supported for series — gracefully ignored` comment.

### `apps/api/src/routes/__tests__/shelves.test.ts`

Added 11 new test cases across two describe blocks:

- `validateDynamicRules`: rejects `watchState` with `SERIES`, rejects without `mediaType`, accepts with `MOVIE`
- `POST /shelves`: route-level validation returning 400 with the correct error message for those two reject cases + regression guard for the MOVIE accept case
- `GET /shelves/:id dynamic availability evaluation`: `availableToMe: false` for movies, `availableToMe: undefined` for movies, `availableToMe: false` for series, `availableToMe: undefined` for series
