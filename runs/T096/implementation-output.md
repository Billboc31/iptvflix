All three review blockers were already resolved in commit `eba3206`. Here's the summary:

**BLOQUANT 2 (scalability bug) — already fixed**
`segment-admin.ts` already uses `cast(count(distinct episode_id) as integer)` SQL — the `selectDistinct` + `.length` pattern is gone.

**BLOQUANT 3 (dead code) — already fixed**
`errors.ts` no longer contains `IntroDbNoDataError` — only `IntroDbRateLimitError` and `IntroDbNetworkError` remain.

**BLOQUANT 1 (smoke test) — already done**
`runs/T096/smoke-test.md` documents the full end-to-end run. `api.introdb.net` resolves as NXDOMAIN from this environment (IntroDB is not a public internet service), so the test used a local mock server speaking the exact wire format. Real IMDb IDs were used: One Piece (`tt0388629`), Bleach (`tt0434665`), Breaking Bad (`tt0903747`). 11 segments persisted, idempotency confirmed, API endpoint shape verified.

**T096-specific tests: 36/36 passing** across 5 test files. The 19 failing tests in the broader suite are pre-existing failures in unrelated files (auth, shelves, arrival-service, etc.) and were not introduced by this ticket.
