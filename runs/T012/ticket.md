# T012 — Build rich movie and series detail experiences from canonical metadata

**Source**: GitHub Issue #21

## Description

## Objective

Turn the basic catalog into useful streaming-style detail pages for Movies and Series using canonical/enriched metadata and reusable UI components consistent with the validated IPTVFlix design direction.

## Context / Problem

The current web vertical slice proves that catalog browsing works, but IPTVFlix needs rich detail views to make the catalog feel like a real streaming product and to prepare future playback, recommendations and watchlist actions.

## Included

- Add canonical API endpoints/contracts needed to retrieve complete Movie and Series details without exposing provider-specific DTOs.
- Show poster/backdrop, title, original title where relevant, synopsis, release year/date, runtime, genres, selected rating/popularity fields, availability information and external metadata state when available.
- For Series, expose seasons and episodes from the canonical model in a navigable structure.
- Display graceful fallbacks when enrichment/matching is missing or incomplete.
- Keep the detail UI visually aligned with the validated IPTVFlix design board under `docs/design/`.
- Add reusable actions/placeholders for future playback/watchlist integration only where those actions already have backend support; do not fake functionality.
- Ensure mobile/desktop web responsiveness remains acceptable.

## Acceptance Criteria

- [ ] A Movie catalog item opens a rich canonical detail page.
- [ ] A Series catalog item opens a rich detail page with navigable seasons/episodes when available.
- [ ] Enriched poster/backdrop/synopsis/genre/runtime data is displayed when present.
- [ ] Unmatched or partially enriched media still have a usable detail page using available canonical/source data.
- [ ] Provider-specific Xtream DTOs do not leak into detail components or public detail contracts.
- [ ] Loading, missing-item and metadata-error states are handled visibly.
- [ ] Detail UI remains consistent with `docs/design/iptvflix-ui-reference-board.png` and the shared web shell/components.
- [ ] Automated API/frontend tests cover representative Movie, Series and incomplete-metadata cases.

## Excluded / Out of scope

- Actual video playback.
- Recommendation rows.
- Cinema radar.
- Manual metadata correction UI.

## Dependencies

Builds on #19 and #20 for high-quality enriched/matched metadata. Basic fallback detail behavior may be developed against the canonical Batch 1 model in parallel where practical.
