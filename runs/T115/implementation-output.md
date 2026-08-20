## Coder-22 output

**Bug fix** (`catalog-stats.test.ts`): The route `catalog-stats.ts` makes 13 DB queries in `Promise.all` (including `seriesSeasonFailureCount` added in a prior cycle), but the test only mocked 12 calls. The 13th unmocked call returned `undefined`, causing `.from()` to throw a TypeError → HTTP 500. Fixed by adding the missing `setupSelectFromWhere({ cnt: 0 })` mock for `seriesSeasonFailureCount` in both test cases, and updating the query count comment from 12 to 13.

**Modified file**: `apps/api/src/routes/__tests__/catalog-stats.test.ts`

**All T115 tests pass**: 33 tests across 4 test files:
- `src/routes/__tests__/catalog-stats.test.ts` — 2 passed
- `src/services/__tests__/metadata-enrichment-service.test.ts` — 22 passed
- `src/services/__tests__/t115-enrichment.test.ts` — 5 passed
- `src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts` — 4 passed

**Remaining blocker (unchanged — human action required)**: The ticket completion rule requires a production run. `flyctl auth login` and `api.iptvflix.com` DNS are not accessible in the AI environment. The playbook at `runs/T115/production-run-playbook.md` is complete and ready. A human operator must:
1. Verify migrations 0044-0047 applied.
2. Capture `/admin/catalog-stats` BEFORE snapshot.
3. `POST /admin/catalog-enrich-missing` with `{"batchSize":50,"concurrency":3,"throttleMs":500}`.
4. Wait for `status: "COMPLETED"`.
5. Capture `/admin/catalog-stats` AFTER snapshot.
6. `GET /admin/catalog-enrich-missing/failures?limit=200`.
7. Publish `runs/T115/production-run-YYYYMMDD.md`.
