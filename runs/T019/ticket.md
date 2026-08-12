# T019 — Add universal external catalog discovery for unavailable and upcoming media

**Source**: GitHub Issue #36

## Description

## Objective

Allow users to discover and open canonical Movies/Series that are not currently present on any configured source, including announced/upcoming titles, instead of treating the configured IPTV catalog as the universe of searchable content.

## Context / Problem

IPTVFlix should answer a search for a known upcoming movie even when it has no IPTV/Plex availability. Users need to be able to discover the work, inspect its metadata/release information and later track it. The existing search operates over the local canonical catalog and should remain fast while gaining an external discovery fallback.

## Included

- Add an external-catalog discovery boundary using the existing metadata provider abstraction where appropriate.
- When local canonical search has insufficient/no results, allow discovery of external Movies/Series not yet persisted locally.
- Materialize/persist a canonical Media record when the user opens, saves or otherwise needs to track an external result, without fabricating an availability.
- Represent `availableToMe=false` / zero availabilities clearly in API and web UI.
- Support upcoming/announced media metadata and known release dates/status when the metadata provider exposes them.
- Keep local search results and externally discovered results deduplicated by canonical/external identity.
- Avoid turning ordinary search into an uncontrolled full-database import or excessive provider API usage.
- Handle metadata provider failure/rate limiting without breaking local catalog search.

## Acceptance Criteria

- [ ] Searching for a known Movie not present on any configured source can return an external discovery result.
- [ ] Opening/saving that result can create/reuse one canonical Media with zero availabilities.
- [ ] A future/upcoming title can have a useful detail page even when it is not yet released or available to the user.
- [ ] Local and external results for the same canonical work are not displayed as duplicates.
- [ ] External provider failure still leaves local catalog search usable.
- [ ] The UI clearly distinguishes `not available to me` from `not found`.
- [ ] Provider API calls are bounded/cached appropriately for interactive search.
- [ ] Automated tests cover local hit, external-only hit, upcoming title, deduplication, zero availability and provider failure.

## Excluded / Out of scope

- Importing every external movie/series into the local database.
- Release-follow notifications.
- Recommendation ranking.
- Availability on commercial streaming services not configured as sources.

## Dependencies

Requires the zero-availability canonical model from #33 and uses the existing external metadata provider/enrichment boundary.
