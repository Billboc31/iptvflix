# T013 — Add canonical catalog search and discovery filters

**Source**: GitHub Issue #22

## Description

## Objective

Make the IPTVFlix catalog quickly explorable through fast search and useful discovery filters over canonical/enriched media data.

## Context / Problem

A large IPTV catalog is unusable if users can only browse broad provider categories. Search and filtering must operate on the normalized canonical catalog so the experience remains provider-independent and can later feed recommendation/discovery features.

## Included

- Add backend search/query capabilities over canonical Movies and Series.
- Support at least title text search and filters for media type, genre, release year/range and availability state when data exists.
- Support additional useful filters such as runtime/rating only when the current canonical metadata model can provide them reliably.
- Define deterministic sorting options suitable for the current product, including relevance for text search and recent IPTV availability where applicable.
- Add web search/discovery UI consistent with the validated IPTVFlix design board.
- Preserve user-entered search/filter state during normal navigation where practical.
- Handle incomplete/unmatched metadata gracefully rather than excluding media unnecessarily.
- Ensure query inputs are validated server-side and cannot generate unsafe arbitrary database expressions.

## Acceptance Criteria

- [ ] Users can search Movies and Series by title through the canonical API/web UI.
- [ ] Users can filter by media type, genre and release period when those fields are available.
- [ ] Search does not depend on Xtream provider DTOs/categories directly.
- [ ] Recent availability can be used as a discovery/sort signal using persisted availability lifecycle data.
- [ ] Unmatched/partially enriched items remain searchable using their available canonical/source title information.
- [ ] Empty/no-result, loading and API-error states are handled clearly in the UI.
- [ ] Search/filter parameters are validated on the backend.
- [ ] Automated tests cover representative queries, combinations, no-results and invalid inputs.

## Excluded / Out of scope

- Natural-language/LLM search.
- Personalized recommendation ranking.
- Cinema radar.
- Full-text search infrastructure such as Elasticsearch/OpenSearch unless repository-scale evidence demonstrates it is necessary.

## Dependencies

Uses the canonical Batch 1 catalog. Enriched filters benefit from #19/#20 but basic search can be developed in parallel using existing canonical fields.
