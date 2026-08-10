All 18 tests pass and the commit is clean. Here's a summary of what was implemented:

**Files created:**
- `packages/api-contracts/src/sources.ts` — `SourceType`, `SourceResponse`, `CreateSourceBody`, `UpdateSourceBody`, `TestSourceResult`
- `apps/api/src/db/schema/sources.ts` — `source_type` pgEnum + `sources` table (9 columns)
- `apps/api/src/services/source-service.ts` — CRUD + `testSourceConnection` with password always omitted from responses and never logged
- `apps/api/src/routes/sources.ts` — 6 endpoints: POST, GET, PATCH, DELETE `/sources`, GET `/sources/:id`, POST `/sources/:id/test`
- `apps/api/src/routes/sources.test.ts` — 15 tests covering validation, secret redaction, connection success/failure/timeout, M3U stub, log assertion
- `apps/api/migrations/0001_real_leper_queen.sql` — `CREATE TYPE source_type`, `CREATE TABLE sources`

**Files modified:**
- `packages/api-contracts/src/index.ts` — re-exports sources
- `apps/api/src/db/schema/index.ts` — re-exports sources schema
- `apps/api/src/index.ts` — registers `sourcesRoutes`
