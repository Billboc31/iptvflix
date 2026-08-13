# T051 — Add automatic source synchronization and discovery refresh scheduling

**Source**: GitHub Issue #100

## Description

## Objective

Keep IPTVFlix up to date automatically so new IPTV/Plex/M3U availability and external discovery candidates appear without requiring manual synchronization from the UI.

## Context / Problem

The product promise includes noticing when followed/upcoming media becomes available on configured sources. Source synchronization, availability lifecycle, Discovery Pool refresh and generated Shelf refresh now exist, but they are primarily triggered manually or per-request. A hosted always-on backend should perform bounded periodic maintenance automatically.

## Included

- Add configurable periodic scheduling for enabled source synchronization using existing synchronization services rather than duplicating provider logic.
- Schedule Discovery Candidate Pool refresh/maintenance at an appropriate independent cadence.
- Trigger or enqueue dependent refresh work (release lifecycle / recommendation-backed Shelf refresh) only through existing boundaries where required.
- Prevent overlapping syncs for the same source and avoid duplicate work when a manual sync is already running.
- Bound concurrency across sources/providers so large Xtream libraries cannot starve the API.
- Persist enough run state/status to diagnose last success/failure and survive process restarts without assuming in-memory timers are durable truth.
- Add configuration to disable/adjust automated scheduling for local development/tests.
- Surface concise last-sync/next-or-scheduled-state information in the existing source/status UI where useful.
- Ensure one failing provider does not stop maintenance for other sources.

## Acceptance Criteria

- [ ] Enabled configured sources are synchronized automatically on a configurable cadence.
- [ ] Two scheduler ticks cannot run overlapping syncs for the same source.
- [ ] Manual and scheduled synchronization share the same locking/idempotency rules.
- [ ] Source failures are isolated, logged safely and visible without stopping other sources.
- [ ] Discovery Pool maintenance runs independently and remains bounded.
- [ ] Automatic source changes continue to feed the existing availability/release lifecycle correctly.
- [ ] Scheduling can be disabled in test/local environments.
- [ ] Restart behavior does not create an immediate unbounded duplicate storm.
- [ ] Tests cover concurrency, failure isolation, disabled scheduling and restart-safe behavior.

## Excluded / Out of scope

- Push/email/mobile notifications themselves.
- Distributed multi-instance job infrastructure unless required by the actual Railway deployment model.
- Reimplementing provider synchronization.

## Dependencies

Builds on the existing sync-run locking, availability lifecycle, Discovery Pool and Shelf refresh features. Can be developed in parallel with M3U; M3U should automatically benefit once implemented.
