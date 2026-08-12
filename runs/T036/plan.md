I have all the data needed. Here is the plan.

---

## Objective

Restore a valid, monotonic Drizzle snapshot metadata chain across all 16 migrations (0000–0015) so that `drizzle-kit generate` can run without ancestry errors, and add a repeatable validation check that catches broken chains before future migration PRs merge.

---

## Included

### 1. Full chain audit (read-only, documented in PR description)

Complete table of current `id` / `prevId` per snapshot, identifying every defect:

| File | id | prevId | Defect |
|------|----|--------|--------|
| 0000 | `58a1fc2a` | `00000000` (nil) | — OK — |
| 0001 | `457487f4` | `58a1fc2a` | — OK — |
| 0002 | `0002_real_leper_queen` | `457487f4` | non-UUID id |
| 0003 | `37d7869e` | `0002_real_leper_queen` | consistent with 0002 but non-standard prevId |
| 0004–0006 | UUIDs | UUIDs | — OK — |
| **0007** | **MISSING** | — | snapshot file absent; SQL file and journal entry exist |
| 0008 | `20d53bba` | `7e49dc78` (=0006) | skips 0007 |
| 0009 | `20d53bba` (=0008) | `20d53bba` (=self) | duplicate id + self-reference |
| 0010 | `dc4ae351` | `20d53bba` | references ambiguous id (0008=0009=0011) |
| 0011 | `20d53bba` (=0008=0009) | `dc4ae351` | duplicate id |
| 0012 | `304a9544` | `20d53bba` | references ambiguous id |
| 0013 | `a7f1c2e3` | `304a9544` | — OK — |
| 0014 | `0014_episode_availability_provider_uniqueness` | `a7f1c2e3` | non-UUID id |
| 0015 | (same tag as 0014) | (same tag, =self) | self-reference + non-UUID id |

### 2. Metadata repairs — `apps/api/migrations/meta/`

No SQL file is touched. Only `id` and `prevId` fields inside snapshot JSON files are changed, plus one new snapshot file is created.

Repairs applied in dependency order (each step must precede the next):

**Step A — Fix 0002 non-UUID id**
- `0002_snapshot.json`: replace tag-string `id` with a fresh UUID v4 (e.g. `UUID-A`).
- `0003_snapshot.json`: update `prevId` → `UUID-A`.

**Step B — Reconstruct missing `0007_snapshot.json`**
- Create `apps/api/migrations/meta/0007_snapshot.json`.
- Base content: start from `0006_snapshot.json` and apply schema changes described in `migrations/0007_episode_availability_status.sql` (add/modify table/column/enum entries in the JSON).
- Set `id` = fresh UUID v4 (`UUID-B`), `prevId` = `7e49dc78-742e-4300-8468-8f863295119a` (0006's id).
- `0008_snapshot.json`: update `prevId` → `UUID-B`.

**Step C — Fix 0009 self-reference and duplicate id**
- `0009_snapshot.json`: replace `id` with a fresh UUID v4 (`UUID-C`).
- `0010_snapshot.json`: update `prevId` → `UUID-C`.

**Step D — Fix 0011 duplicate id**
- `0011_snapshot.json`: replace `id` with a fresh UUID v4 (`UUID-D`).
- `0012_snapshot.json`: update `prevId` → `UUID-D`.

**Step E — Fix 0014 non-UUID id**
- `0014_snapshot.json`: replace tag-string `id` with a fresh UUID v4 (`UUID-E`).
- `0015_snapshot.json`: update `prevId` → `UUID-E`.

**Step F — Fix 0015 self-reference and non-UUID id**
- `0015_snapshot.json`: replace `id` with a fresh UUID v4 (`UUID-F`); `prevId` already set to `UUID-E` in step E.

### 3. Validation script — `apps/api/scripts/validate-snapshot-chain.ts`

A standalone TypeScript script (runnable with `tsx`) that:
1. Reads all `migrations/meta/*_snapshot.json` sorted by filename.
2. Asserts each `id` is a valid UUID v4 (not a tag string, not the nil UUID).
3. Asserts `id !== prevId` (no self-reference).
4. Asserts each snapshot's `prevId` equals the preceding snapshot's `id` (nil UUID accepted only for the first).
5. Asserts the set of snapshot filenames matches the journal entries in `_journal.json` (detects missing snapshots like the former 0007 gap).
6. Exits with code 1 and a descriptive message on any failure; exits 0 on success.

### 4. Wire the script into `apps/api/package.json`

Add script entry: `"db:validate-chain": "tsx scripts/validate-snapshot-chain.ts"`.

---

## Excluded

- Any change to `.sql` migration files (0000–0015).
- Any change to the schema source (`src/db/schema/**`).
- Modifying `_journal.json` entries (tags, timestamps, `when` values).
- Adding the validation script to CI (tracked as a follow-up; the script is the deliverable, pipeline wiring is not).
- Generating new application migrations (this ticket only repairs existing metadata).
- Drizzle runtime or query layer changes.

---

## Acceptance criteria

- Every snapshot file in `migrations/meta/` has a `id` field that is a valid UUID v4 and is unique across all snapshots.
- No snapshot has `id === prevId`.
- `0007_snapshot.json` exists with `prevId` = `7e49dc78-742e-4300-8468-8f863295119a` and a unique `id`.
- The full chain 0000 → 0007 → 0008 → … → 0015 is monotonic: each snapshot's `prevId` equals the preceding snapshot's `id`.
- `0013_snapshot.json`, `0014_snapshot.json`, and `0015_snapshot.json` remain in correct order and their schema content (tables, columns, enums) is semantically unchanged relative to the current main branch.
- `pnpm --filter api db:validate-chain` exits 0 on the repaired chain.
- `pnpm --filter api db:validate-chain` exits 1 when any of the original defects are re-introduced (verifiable by temporarily reverting one snapshot and running the script).
- `pnpm --filter api db:generate` runs to completion without snapshot ancestry errors in a local environment with the schema unchanged.
