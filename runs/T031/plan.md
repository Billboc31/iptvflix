## Objective

Add a global `UNIQUE(provider_id, provider_item_id)` constraint to `episode_availabilities`, matching the protection already in place for movies and series, so that one provider episode item cannot be silently attached to more than one canonical episode.

## Included

### 1. Schema — `apps/api/src/db/schema/availabilities.ts`

Add a second unique index to `episodeAvailabilities` alongside the existing compound one:

```ts
// before (line ~78)
(t) => [unique().on(t.episodeId, t.providerId, t.providerItemId)]

// after
(t) => [
  unique().on(t.episodeId, t.providerId, t.providerItemId),
  unique().on(t.providerId, t.providerItemId),
]
```

### 2. Migration — new file under `apps/api/migrations/`

Generate with `drizzle-kit generate`, then **prepend** a deduplication block before the `ALTER TABLE ADD CONSTRAINT` statement:

```sql
-- Remove pre-existing cross-episode duplicates (keep earliest firstSeenAt; break ties by id asc)
DELETE FROM episode_availabilities
WHERE id NOT IN (
  SELECT DISTINCT ON (provider_id, provider_item_id) id
  FROM episode_availabilities
  ORDER BY provider_id, provider_item_id, first_seen_at ASC, id ASC
);

-- Add cross-episode uniqueness constraint (mirrors movie_availabilities / series_availabilities)
ALTER TABLE "episode_availabilities"
  ADD CONSTRAINT "episode_availabilities_provider_id_provider_item_id_unique"
  UNIQUE("provider_id","provider_item_id");
```

### 3. Sync code — `apps/api/src/services/catalog-sync-service.ts` (lines ~534–588)

Replace the current lookup (which queries by `(episodeId, providerId, providerItemId)`) with a two-phase check:

1. **SELECT by `(providerId, providerItemId)` only** — returns zero or one row.
2. If the row exists and its `episodeId` differs from the current episode → log a warning and **skip** (do not insert; return without updating).
3. If the row exists with the same `episodeId` → **UPDATE** `lastSeenAt`, `status`, `unavailableAt` (current behavior).
4. If no row exists → **INSERT** (current behavior).

This makes conflict handling explicit and deterministic without silently creating duplicates.

### 4. Tests

**`apps/api/src/db/__tests__/catalog-constraints.test.ts`**

Add a test after the existing compound-constraint test (line ~214):

- Insert a row for `(episodeIdA, 'xtream:server1', 'ep-42')`.
- Attempt to insert `(episodeIdB, 'xtream:server1', 'ep-42')` with a different `episodeId` → expect DB to reject.
- Insert `(episodeIdA, 'xtream:server1', 'ep-99')` (same episode, different item) → expect success (multi-variant still allowed).

**`apps/api/src/services/__tests__/catalog-sync-service.test.ts`**

Add a test (near line ~640):

- Run sync so that `ep-42` is attached to `episodeA`.
- Run sync again with the same `providerItemId` but mapped to `episodeB` (provider data ambiguity).
- Assert that `episodeB` does **not** gain the availability row; `episodeA` retains it.

## Excluded

- Changing uniqueness rules for `movie_availabilities` or `series_availabilities`.
- Altering the episode sync matching logic beyond the conflict-skip guard.
- Any UI or API surface change.
- Backfilling or recovering orphaned availability data beyond what the deduplication DELETE handles.
- Cross-provider uniqueness (two different `providerId` values may still carry the same `providerItemId` string — only the `(providerId, providerItemId)` pair is constrained).

## Acceptance criteria

- `episode_availabilities` has a DB-level `UNIQUE(provider_id, provider_item_id)` constraint visible in `\d episode_availabilities` / `information_schema.table_constraints`.
- Inserting two rows with the same `(provider_id, provider_item_id)` but different `episode_id` values raises a unique-constraint violation.
- Inserting two rows with the same `episode_id` but different `provider_item_id` values succeeds (multi-variant preserved).
- Migration runs cleanly on a DB with no duplicates and on a DB with pre-existing duplicates; it keeps the earliest `firstSeenAt` row in each duplicate group.
- Sync integration test: a provider item already registered to episodeA is not reassigned to episodeB in a subsequent sync pass; episodeB receives no spurious availability row.
- All existing episode availability tests continue to pass (`pnpm test --filter api`).
