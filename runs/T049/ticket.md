# T049 — Implement M3U catalog ingestion through the common provider boundary

**Source**: GitHub Issue #98

## Description

## Objective

Add real M3U source ingestion so IPTVFlix can consume M3U playlists without introducing provider-specific models into the canonical Media/Availability domain.

## Context / Problem

The source model already represents `M3U`, but actual M3U parsing/ingestion was intentionally deferred. Xtream and Plex now prove the provider-independent synchronization boundary; M3U should enter through that same boundary.

## Included

- Implement an M3U provider adapter for user-configured playlist URLs/credentials where applicable.
- Parse representative extended M3U metadata such as title, group/category, logo and useful provider attributes when present.
- Separate Movies, Series/Episodes and unsupported/live entries conservatively; do not invent canonical metadata from unreliable filename patterns.
- Reuse existing title normalization, matching, metadata enrichment and Availability lifecycle rather than creating an M3U-specific catalog path.
- Preserve provider item identity and raw source title for diagnostics/reprocessing.
- Handle malformed playlists, redirects, authentication/network failures, large playlists and partial metadata robustly.
- Keep secrets and credential-bearing URLs out of logs and public API payloads.
- Integrate M3U with existing source connection-test/synchronization UI where appropriate.

## Acceptance Criteria

- [ ] A configured M3U source can be connection-tested and synchronized.
- [ ] M3U Movies/Series that can be identified safely enter the existing canonical matching/enrichment flow.
- [ ] M3U items matched to existing canonical Media become additional availabilities rather than duplicate cards.
- [ ] Raw titles/provider identifiers remain available within the ingestion/availability boundary.
- [ ] Live-TV or ambiguous entries are not incorrectly persisted as Movies/Series merely to increase coverage.
- [ ] Repeated synchronization is idempotent and disappearance/reappearance follows the common lifecycle rules.
- [ ] Large/malformed playlists fail gracefully without exposing secrets.
- [ ] Tests use fixtures and cover common extended-M3U formats, malformed entries, duplicate works and failure paths.

## Excluded / Out of scope

- Live TV browsing/player UX.
- EPG ingestion.
- Rewriting the canonical matching algorithm.
- Android TV playback.

## Dependencies

Builds on the existing provider-independent Source/Media/Availability architecture. Can run in parallel with hosted deployment work.
