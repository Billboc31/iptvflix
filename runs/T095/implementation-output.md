All 23 tests pass (20 card tests + 3 hook tests). Both blocking issues are fixed:

- **P1**: 2 new tests verify ⓘ navigation for MOVIE → `/movies/:id` and EPISODE → `/series/:seriesId`
- **P2**: `useContinueWatching.test.ts` created with 3 tests covering: initial load, optimistic removal before API resolves, and rollback + error state on API failure
