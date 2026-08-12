378/378 tests pass, no regressions. Here is the full test report.

---

## T031 Test Report — Enforce provider item uniqueness for episode availabilities

### Acceptance Criteria

**AC1 — The same `(providerId, providerItemId)` cannot be attached to two canonical episodes.**
**PASS.**
- Schema: `availabilities.ts:79` — `unique().on(t.providerId, t.providerItemId)` enforces this at DB level.
- Migration: `0014_episode_availability_provider_uniqueness.sql:10` — `UNIQUE("provider_id","provider_item_id")` constraint added.
- Test: `catalog-constraints.test.ts:216` — `rejects same (provider_id, provider_item_id) across two different episodes in episode_availabilities` → inserts first, second `.rejects.toThrow()`. ✓

**AC2 — Multiple distinct provider items may still be attached to the same episode.**
**PASS.**
- Test: `catalog-constraints.test.ts:254` — `allows multiple distinct provider items to map to the same canonical episode` → inserts `(xtream:server1, ep-multi-1)` and `(xtream:server2, ep-multi-1)` to same episodeId, both succeed. ✓

**AC3 — Existing duplicate data, if any, is handled safely by migration/reconciliation.**
**PASS.**
- Migration: `0014_episode_availability_provider_uniqueness.sql:2-7` — `DELETE` removes cross-episode duplicates before the constraint is added, keeping the row with earliest `firstSeenAt` (ties broken by `id ASC`). The constraint is added only after cleanup. Strategy is deterministic and loss-minimal.

**AC4 — Concurrent or repeated sync cannot create duplicate provider-episode mappings.**
**PASS.**
- Sync service: `catalog-sync-service.ts:554-586` — lookup is by `(providerId, providerItemId)` only; if already bound to a different episode, the reassignment is skipped with a `console.warn`. The DB constraint also acts as a hard backstop for any concurrent path that bypasses the application check.
- Test: `catalog-sync-service.test.ts:642` — `does not reassign a provider item already attached to another canonical episode` → two successive syncs, second remaps the same providerItemId; the row stays on the original episode. ✓

**AC5 — Automated DB/service tests cover the constraint and normal multi-variant behavior.**
**PASS.**
- `catalog-constraints.test.ts` — two direct DB-level tests covering the uniqueness rejection and multi-source allow.
- `catalog-sync-service.test.ts` — two integration-level tests covering multi-source episode availability and conflict/remap prevention.

### Regressions

None. Full suite: **378/378 tests pass** across 28 test files.

### Verdict

**VALIDATED.** All five acceptance criteria are met. The implementation is complete, correctly constrained at both the schema and application layers, covered by automated tests, and introduces no regressions.
