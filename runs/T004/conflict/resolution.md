# Conflict Resolution — T004

Generated at: 2026-08-11T06:45:00Z

## Files Resolved

### 1. `apps/api/migrations/meta/_journal.json`

**Conflict type**: Added by both (AA) — the file did not exist in the common ancestor (before T002 merged to main).

**Ours (main/HEAD)**: Drizzle journal with two entries:
- idx=0 `0000_talented_shiva` (app_config table — from T002)
- idx=1 `0001_sweet_stingray` (full catalog domain schema — genres, movies, series, seasons, episodes, availabilities — from a ticket that merged to main before T004)

**Theirs (T004 replaying T002 commit)**: Journal with only idx=0 `0000_talented_shiva`.

**T004's own migration**: `0001_real_leper_queen` (sources table + source_type enum), which would have collided with main's `0001_sweet_stingray` at idx=1.

**Decision**: Three-way merge. Kept both idx=0 and idx=1 from main unchanged, then inserted T004's sources migration as idx=2 with tag `0002_real_leper_queen`.

**Justification**: Both migrations are independent and must coexist. The catalog schema migration (`0001_sweet_stingray`) landed on main first and must retain idx=1 to preserve migration history integrity for any databases already in that state. T004's sources migration was renumbered to idx=2 to avoid the index collision. The SQL file and snapshot were renamed accordingly (`0002_real_leper_queen.sql`, `meta/0002_snapshot.json`).

**Final journal**:
```
idx=0  0000_talented_shiva   (app_config)
idx=1  0001_sweet_stingray   (catalog domain schema — from main)
idx=2  0002_real_leper_queen (sources + source_type enum — T004)
```

---

### 2. `apps/api/src/db/schema/index.ts`

**Conflict type**: Added by both (AA) — same root cause (T002 created the file).

**Ours (main/HEAD)**: Seven exports:
```ts
export * from './app_config.js'
export * from './genres.js'
export * from './movies.js'
export * from './series.js'
export * from './seasons.js'
export * from './episodes.js'
export * from './availabilities.js'
```

**Theirs (T004 replaying T002 commit)**: Single export — `app_config.js` only.

**T004's own addition**: `sources.js` export (needed by `source-service.ts` and `db/client.ts`).

**Decision**: Union of both sides — kept all of main's domain schema exports and added T004's `sources.js`.

**Justification**: The catalog schema exports from main are orthogonal to T004's sources schema. Dropping them would have broken the catalog domain layer already present on main. Adding `sources.js` is required for T004's service layer to compile and function.

**Final exports** (8 entries):
```ts
export * from './app_config.js'
export * from './genres.js'
export * from './movies.js'
export * from './series.js'
export * from './seasons.js'
export * from './episodes.js'
export * from './availabilities.js'
export * from './sources.js'
```

---

## Migration Chain Integrity

The Drizzle snapshot chain is correct after resolution:

| File | id | prevId |
|---|---|---|
| `meta/0000_snapshot.json` | `58a1fc2a-...` | `00000000-...` (root) |
| `meta/0001_snapshot.json` | `457487f4-...` | `58a1fc2a-...` ✅ |
| `meta/0002_snapshot.json` | `0002_real_leper_queen` | `457487f4-...` ✅ |

---

## Assumptions

- `0001_sweet_stingray` is from another ticket (catalog domain schema — T003 or similar) that merged to main before T004's PR was rebased. Its content (genres, movies, series, seasons, episodes, availabilities + FKs) does not overlap with T004's sources table.
- The renumbering from `0001_real_leper_queen` to `0002_real_leper_queen` is safe because no database has yet applied the T004 sources migration on the production/shared environment (this is a local-dev / self-hosted deployment model).

---

## Known Limitations

- If any branch other than T004 has a migration at idx=2, a further renaming would be needed. The current resolution assumes no other ticket has already claimed idx=2.
- The `source_type` pgEnum in `0002_real_leper_queen.sql` is independent of the catalog schema — no FK between sources and the catalog tables was introduced (deferred to the catalog sync ticket, per T004's plan).
