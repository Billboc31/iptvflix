# T005 — Implement Xtream Codes catalog ingestion

**Source**: GitHub Issue #6

## Description

## Objective
Implement an Xtream Codes provider adapter that can authenticate against a configured source and retrieve VOD/series catalog data for later normalization into the IPTVFlix canonical catalog.

## Context / Problem
Xtream Codes is the first supported IPTV source type. Provider-specific API contracts must remain isolated from the IPTVFlix domain so later M3U support and other providers do not force UI or domain changes.

## Included
- Implement an Xtream Codes client/provider adapter using configured source credentials.
- Retrieve the provider data required for the first Movies and Series vertical slice, including categories and episode/season information when exposed by the provider.
- Map raw provider responses into an ingestion-layer representation, not directly into frontend models.
- Handle authentication failures, malformed responses, network errors, timeouts, and large catalogs robustly.
- Avoid logging credentials or stream URLs containing credentials.
- Add fixture-based/provider-contract tests so ingestion behaviour can be tested without a live IPTV account.

## Acceptance Criteria
- [ ] A valid configured Xtream source can retrieve movie and series catalog data.
- [ ] Provider DTOs/contracts are isolated from the canonical media domain.
- [ ] Authentication and network failures produce sanitized, actionable errors.
- [ ] Credentials are never exposed in logs or API error payloads.
- [ ] Large provider responses are handled without obviously unsafe unbounded application behaviour.
- [ ] Tests cover representative movies, series, categories, malformed responses, and authentication failure.
- [ ] The adapter exposes a clear boundary that catalog synchronization can consume.

## Excluded / Out of scope
- Canonical media matching/enrichment.
- Persisting the full catalog into IPTVFlix entities.
- M3U ingestion.
- Playback.

## Dependencies
Requires #5 for configured Xtream sources and the common foundation from #2. It can be developed largely in parallel with the canonical catalog work in #4 as long as the provider/domain boundary remains respected.
