# T006 — Synchronize IPTV catalog and track availability lifecycle

**Source**: GitHub Issue #7

## Description

## Objective
Persist provider catalog data into the canonical IPTVFlix catalog while preserving availability lifecycle information needed for discovery, recent additions, and the future cinema radar.

## Context / Problem
IPTVFlix must know not only whether an item is available, but also when it first appeared and whether it disappeared or returned. This information must survive repeated synchronizations and must not be derived only from the current provider snapshot.

## Included
- Implement synchronization from the ingestion boundary into canonical catalog entities and source availability mappings.
- Upsert known provider items without resetting their original `firstSeenAt`.
- Update `lastSeenAt` whenever an item is observed during synchronization.
- Detect items no longer present from a source and represent that state without deleting useful historical availability information.
- Make synchronization safe to retry and resistant to duplicate records.
- Prevent concurrent synchronization of the same source from corrupting catalog state or creating duplicate availability mappings.
- Expose synchronization status/result information suitable for later UI use, including counts for created, updated, missing/unavailable, and failed items.
- Ensure failures leave the system in a coherent/recoverable state.

## Acceptance Criteria
- [ ] A first synchronization creates canonical catalog records and source availability mappings from Xtream ingestion data.
- [ ] Re-running the same catalog synchronization does not create duplicate source mappings or reset `firstSeenAt`.
- [ ] `lastSeenAt` reflects subsequent successful observations.
- [ ] Items missing from a later provider snapshot can be distinguished from currently available items without losing their history.
- [ ] Reappearing items preserve useful availability history and become available again correctly.
- [ ] Concurrent synchronization attempts for the same source cannot both mutate the catalog unsafely.
- [ ] A failed synchronization can be retried without requiring manual database cleanup.
- [ ] Synchronization exposes a sanitized summary/status for callers.
- [ ] Automated tests cover first sync, repeat sync, disappearance, reappearance, retry/idempotency, and concurrency protection.

## Excluded / Out of scope
- External metadata enrichment and fuzzy title matching.
- Cinema radar alerts.
- Recommendation generation.
- Scheduled/background synchronization orchestration beyond what is needed to execute and test a sync.

## Dependencies
Requires the canonical catalog from #4, IPTV source management from #5, and Xtream ingestion from #6.
