All T061 implementation tasks are complete. Here's a summary of everything delivered:

**Files created/modified:**
- `apps/api/src/db/schema/reconciliation-runs.ts` — Drizzle schema with partial unique index (`RUNNING` singleton guard)
- `apps/api/migrations/0025_reconciliation_runs.sql` — SQL migration for enum + table
- `apps/api/src/db/schema/index.ts` — added `reconciliation-runs` export
- `apps/api/src/services/media-reconciliation-service.ts` — full service with cursor-based batch loop, transactional merge, dryRun support, and fire-and-forget split (`startRun` / `executeRun` / `reconcile`)
- `apps/api/src/routes/reconcile.ts` — `POST /admin/reconcile` (202 fire-and-forget) + `GET /admin/reconcile/:runId`
- `apps/api/src/index.ts` — wired `MediaReconciliationService` + `reconcileRoutes` into protected scope
- `apps/api/src/services/__tests__/media-reconciliation-service.test.ts` — 11 integration test scenarios
- `apps/api/migrations/meta/_journal.json` — added idx=24 (`0024_fuzzy_starbolt`) and idx=25 (`0025_reconciliation_runs`) entries
- `apps/api/migrations/meta/0025_snapshot.json` — full snapshot with `reconciliation_runs` table and `reconciliation_status` enum added

The two pre-existing TypeScript errors in `authenticateDevice.test.ts` and `playback-resolver.test.ts` are unrelated to T061. No new type errors were introduced.
