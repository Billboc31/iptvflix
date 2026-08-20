# Conflict Resolution — T115

Generated at: 2026-08-20T20:30:46Z
Resolved at: 2026-08-20 (commit 14109d68)

---

## Files resolved

### `apps/api/migrations/meta/_journal.json`

**Status:** Resolved — no conflict markers remain.

#### Conflict description

At idx 46, both branches added an entry for `0046_device_account_id`:

| Side | `when` value | Additional entries |
|---|---|---|
| HEAD (T115 branch) | `1000` | idx 47 `0047_t115_catalog_refresh_runs_type`, idx 48 `0048_t115_enrichment_failures` |
| origin/main | `0` | none |

The T115 branch had previously set `when: 1000` on `0046_device_account_id` as part of commit `bdf1d7bf` (renumbering), leaving a `when` drift vs. the canonical main value.

#### Decision

Kept **main's** `when: 0` for `0046_device_account_id` — this is the authoritative value since the migration landed on main first.

Kept **T115's** two new migration entries at the next free indices:
- idx 47 — `0047_t115_catalog_refresh_runs_type` (`when: 2000`)
- idx 48 — `0048_t115_enrichment_failures` (`when: 3000`)

#### Justification

- The ORM/Drizzle migration conflict playbook requires keeping main's existing migration unchanged and appending ticket migrations at `max(main) + 1`.
- `0046_device_account_id` is main's migration; its `when` must match main (`0`).
- T115's migrations (`0047`, `0048`) do not collide with any main migration — no numeric prefix duplication.
- The `when` values `2000`/`3000` on T115 migrations are sequential ordering hints, not timestamps, and are acceptable.

#### Final journal state (idx 44–48)

```
idx 44 → 0044_t107_shelf_served_at            (when: 0)
idx 45 → 0045_t114_profile_taste_disliked_not_interested  (when: 0)
idx 46 → 0046_device_account_id               (when: 0)   ← main, unchanged
idx 47 → 0047_t115_catalog_refresh_runs_type  (when: 2000) ← T115 new
idx 48 → 0048_t115_enrichment_failures        (when: 3000) ← T115 new
```

---

## Assumptions made

- The `when` field in the journal is used as a relative ordering hint, not as a wall-clock timestamp; the exact value for T115 entries does not need to match any specific epoch.
- No other conflicted files existed beyond `_journal.json` (confirmed: 1 conflicted file declared in context, 0 skipped as noise).

## Known limitations

- The production run mandated by the ticket's completion rule remains blocked on infrastructure access (flyctl auth / `DATABASE_URL`). This is orthogonal to the conflict resolution.
- The `when` values on T115 entries (`2000`, `3000`) differ from the `0` convention used by earlier migrations. This is cosmetic and does not affect migration execution order, which is determined by `idx` and `tag` prefix, not `when`.
