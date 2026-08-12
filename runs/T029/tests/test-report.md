## Test Report — T029

**Result: PASS** (375/375 tests)

---

### Pre-condition issue found

Migration `0013_release_events_source_aware_idempotency` had not been applied to the test database. The old broad unique constraint `(media_type, media_id, event_type, occurred_at)` was still active, causing 2 tests to fail immediately. I applied the migration manually and all tests then passed.

---

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Two different sources may record `SOURCE_APPEARED` for same media + same `occurredAt` without conflicting | **PASS** |
| 2 | Re-running identical sync for same source does not create duplicate | **PASS** |
| 3 | Equivalent behavior for `SOURCE_DISAPPEARED` | **PASS** |
| 4 | Non-source events (`ANNOUNCED`, `THEATRICAL_RELEASE`, `DIGITAL_RELEASE`) retain idempotency | **PASS** |
| 5 | Migration updates constraint safely | **PASS** — drops old unique constraint, creates two partial unique indexes |
| 6 | Automated tests cover same-media/same-timestamp events from two distinct sources | **PASS** — 5 tests in `source-aware idempotency` describe block |

---

### Regressions

None — all 373 pre-existing tests continue to pass.

---

### Action item

**Ensure migrations run before the test suite in CI.** The `0013` migration must be applied before tests execute; if the Drizzle migration runner is not wired into the test setup, the source-aware tests will fail again in a fresh environment.
