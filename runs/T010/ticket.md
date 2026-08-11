# T010 — Integrate external movie and series metadata enrichment

**Source**: GitHub Issue #19

## Description

## Objective

Enrich canonical Movies and Series with reliable external metadata so IPTVFlix can present a high-quality streaming-style catalog independent of the poor metadata often supplied by IPTV providers.

## Context / Problem

Xtream sources may provide incomplete, inconsistent or low-quality titles, posters, descriptions and classification data. IPTVFlix needs a dedicated enrichment layer that augments canonical catalog entities without coupling them to one IPTV provider or overwriting useful source information irreversibly.

## Included

- Add an external metadata provider abstraction for Movies and Series.
- Implement one initial metadata provider supported by the chosen project configuration.
- Retrieve and persist useful metadata such as canonical title, original title, release year/date, synopsis, poster/backdrop references, genres, runtime where available, external IDs and selected rating/popularity fields when permitted by the provider.
- Keep external metadata provenance explicit so provider data can be refreshed/replaced later.
- Add configuration for provider credentials/API keys through environment/secrets handling.
- Add retry/error handling and rate-limit-aware behavior appropriate to the provider.
- Add a refresh mechanism that avoids repeatedly fetching unchanged metadata unnecessarily.
- Preserve the separation between IPTV source availability and canonical/external metadata.

## Acceptance Criteria

- [ ] Canonical Movies and Series can be enriched through an external metadata provider without exposing IPTV-specific models to the enrichment layer.
- [ ] Metadata credentials are configurable through secrets/environment and never committed or returned to clients.
- [ ] Enriched records persist external identifiers and metadata provenance.
- [ ] Poster/backdrop/synopsis/genre/release information is available through canonical API contracts when enrichment succeeds.
- [ ] Provider failures do not make the underlying IPTV catalog unavailable.
- [ ] Re-running enrichment avoids unnecessary duplicate work for already-current records.
- [ ] Automated tests use mocked/provider fixtures and do not require live external API credentials.

## Excluded / Out of scope

- Fuzzy title matching strategy between raw IPTV names and external titles beyond the minimal provider lookup boundary required here.
- Recommendation scoring.
- Cinema radar.
- Playback.

## Dependencies

Builds on the canonical catalog from Batch 1. Can run in parallel with the end-to-end stabilization ticket #17; the matching ticket will consume this provider boundary.
