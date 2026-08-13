All done. Here's a summary of what was implemented:

---

## Files created / modified

### New files
| File | Purpose |
|------|---------|
| `apps/api/migrations/0032_catalog_refresh.sql` | Creates `catalog_refresh_runs` table with all plan columns and a partial unique index on `status = 'RUNNING'` |
| `apps/api/src/db/schema/catalog-refresh-runs.ts` | Drizzle schema for the table; typed checkpoint `Record<string, { done: boolean; offset: number }>` |
| `apps/api/src/services/catalog-refresh-service.ts` | `CatalogRefreshService` with stale-lock clearing, bucket segmentation (upcoming/recent/stable), enrichment calls per bucket with appropriate `staleDays`, discovery feed upserts, checkpointed and resumable steps |
| `apps/api/src/routes/catalog-refresh.ts` | `POST /catalog-refresh` (202 / 409) and `GET /catalog-refresh/status` |
| `apps/api/src/services/__tests__/catalog-refresh-service.test.ts` | 12 unit tests: bucket classification (pure), lock error, staleDays propagation per bucket, checkpoint skip |

### Modified files
| File | Change |
|------|--------|
| `apps/api/src/db/schema/index.ts` | Exports `catalog-refresh-runs` |
| `apps/api/src/config/env.ts` | Adds 6 `CATALOG_REFRESH_*` env vars with sensible defaults |
| `apps/api/src/services/scheduler-service.ts` | Adds `catalogRefreshTimer`, optional `catalogRefreshEnabled/CadenceHours` config, `runCatalogRefreshTick()` with cadence check, `CatalogRefreshService` constructor parameter |
| `apps/api/src/index.ts` | Imports and wires `CatalogRefreshService` + `catalogRefreshRoutes`; passes service and config to `SchedulerService` |

### Verification
- **TypeCheck**: zero new errors (2 pre-existing in unrelated test files)
- **Tests**: 51/52 files pass, 718/722 tests pass — all failures pre-existing in `vertical-slice.test.ts`
