# T014 conflict resolution (manual)

Root cause: T014 generated `0004_careless_moon_knight.sql` while `main` already had `0004_wild_legion.sql`.
The LLM conflict-resolver repeatedly "resolved" by keeping both 0004 files and never renumbering.

Fix applied:
1. Reset branch onto `origin/main`
2. Restored T014 feature files from pre-conflict tip `6438853`
3. Renamed migration to `0005_careless_moon_knight.sql` + journal/snapshot
4. Force-pushed branch; PR #28 is mergeable/clean
