# T036 — Repair Drizzle migration snapshot chain after episode lifecycle migration

**Source**: GitHub Issue #75

## Description

## Objective

Restore a valid, monotonic Drizzle migration metadata chain so future schema migrations can be generated and reviewed safely.

## Context / Problem

The migration introduced for episode release lifecycle (`0015_episode_release_events`) appears to have inconsistent Drizzle snapshot metadata on `main`:

- `apps/api/migrations/meta/0015_snapshot.json` uses the same value for `id` and `prevId` instead of referencing the previous snapshot id.
- PR #72 also rewrote `0011_snapshot.json` metadata while adding migration 0015, indicating the snapshot chain has been manually repaired across unrelated historical migrations.
- `_journal.json` lists 0015 normally, but the snapshot chain itself is not reliably monotonic.

This can break or confuse future `drizzle-kit` schema diff generation and make migration conflicts harder to reason about.

## Included

- Audit the Drizzle migration metadata chain from the last known-good snapshot through 0015.
- Repair snapshot `id` / `prevId` relationships without changing the intended SQL migration semantics already applied by 0013–0015.
- Avoid rewriting unrelated historical schema content unless strictly required to restore chain consistency.
- Add a lightweight validation/check so malformed snapshot ancestry is detected before future migration PRs merge.

## Acceptance Criteria

- [ ] Every migration snapshot has a unique `id`.
- [ ] Each snapshot after the first references the immediately preceding snapshot id through `prevId`.
- [ ] `0013`, `0014` and `0015` remain represented in the correct order.
- [ ] Existing migration SQL remains semantically unchanged unless a proven correction is required.
- [ ] A fresh Drizzle schema/migration generation can run without snapshot ancestry errors.
- [ ] Automated or scripted validation catches self-referencing or broken snapshot chains.

## Dependencies

None functionally. This is migration-infrastructure stabilization and can run independently of #60.
