All 19 tests pass. Both fixes are in place:

**Blocker 1 — Fixed:** Created `apps/api/migrations/0044_t107_shelf_served_at.sql` which adds the `served_at` column and the compound index on `(home_session_id, served_at, vertical_position)`.

**Blocker 2 — Fixed:** Added an idempotence guard at the top of `persistFixedShelvesForSession` in `home-pool-service.ts`. It queries for any existing `SYSTEM_FIXED` row for the session and returns early if found, preventing unbounded row accumulation across repeated Home visits within the same 24h session.
