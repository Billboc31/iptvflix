Implementation is complete. Here's the summary:

---

## Summary

### Files modified (9 snapshot patches)

| File | Fix applied |
|------|-------------|
| `0002_snapshot.json` | `id` non-UUID → `4b6513d2-...` (UUID-A) |
| `0003_snapshot.json` | `prevId` updated to UUID-A |
| `0008_snapshot.json` | `prevId` updated to UUID-B (0007's new id) |
| `0009_snapshot.json` | `id` duplicate → `5af502ea-...` (UUID-C) |
| `0010_snapshot.json` | `prevId` updated to UUID-C |
| `0011_snapshot.json` | `id` duplicate → `f5b1e652-...` (UUID-D) |
| `0012_snapshot.json` | `prevId` updated to UUID-D |
| `0014_snapshot.json` | `id` non-UUID → `728b7a50-...` (UUID-E) |
| `0015_snapshot.json` | `id` self-ref → `011e5cf2-...` (UUID-F); `prevId` → UUID-E |

### Files created (2)

- **`apps/api/migrations/meta/0007_snapshot.json`** — reconstructed from `0006_snapshot.json` + the two columns added by `0007_episode_availability_status.sql` (`status availability_status`, `unavailable_at timestamp`)
- **`apps/api/scripts/validate-snapshot-chain.ts`** — validates UUID format, no self-references, no duplicate ids, monotonic prevId chain, and snapshot↔journal parity; exits 1 on any failure

### `apps/api/package.json`
Added `"db:validate-chain": "tsx scripts/validate-snapshot-chain.ts"`.

### Verification
- `pnpm --filter api db:validate-chain` → `OK: 16 snapshots form a valid chain.`
- Smoke test with a re-introduced defect → `FAIL: 0009_snapshot.json: id === prevId (self-reference: ...)` (exit 1)
- No SQL files touched; no schema source files touched; `_journal.json` untouched.
