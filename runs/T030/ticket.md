# T030 — Bound and harden Xtream per-series episode metadata synchronization

**Source**: GitHub Issue #65

## Description

## Objective

Make Xtream series/episode synchronization safe for large libraries and unreliable providers.

## Context / Problem

The current Xtream snapshot fetch loads the series list and then calls `getSeriesInfo()` for every series using an unbounded `Promise.all`. Large IPTV catalogs can contain hundreds or thousands of series, causing a burst of concurrent requests against the provider and making a full sync fragile when individual series-info calls fail or time out.

## Included

- Replace unbounded per-series fan-out with bounded concurrency or an equivalent controlled strategy.
- Define failure semantics for one bad/slow series so a single provider error does not unnecessarily invalidate the whole catalog snapshot.
- Preserve authoritative episode lifecycle behavior only where episode data was actually fetched reliably; avoid false disappearance caused by partial provider failures.
- Keep sync-run observability/counts useful for partial failures.

## Acceptance Criteria

- [ ] Xtream `getSeriesInfo()` calls are concurrency-limited.
- [ ] One failed series-info request does not automatically cause unrelated series/episodes to disappear.
- [ ] Partial episode-fetch failures cannot be mistaken for an authoritative empty snapshot for those affected series.
- [ ] Sync result exposes enough failure information for diagnostics.
- [ ] Retry/resync behavior remains deterministic.
- [ ] Automated tests cover large fan-out/concurrency limit, one failing series and partial snapshot safety.

## Dependencies

Builds on the authoritative episode synchronization introduced by #49.
