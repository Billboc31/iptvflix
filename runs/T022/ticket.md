# T022 — Build unified Series season and episode availability overview across sources

**Source**: GitHub Issue #39

## Description

## Objective

Make a Series detail page clearly summarize every known Season/Episode, watch progress and availability across configured sources, so users see the complete work rather than navigating provider-specific series entries.

## Context / Problem

For Series, source fragmentation is especially confusing: Plex may contain Seasons 1–3 while IPTV contains Seasons 1–5, and individual episodes may exist in different languages/qualities. IPTVFlix should present one canonical Series hierarchy and overlay availability/progress onto it.

## Included

- Extend canonical Series detail contracts/UI to present the known Series → Season → Episode hierarchy as one coherent structure.
- For each Season, show useful aggregate availability/completeness information (for example available episode count vs known episode count) without implying completeness when metadata is unknown.
- For each Episode, expose current availability across sources and variants using canonical availability contracts.
- Integrate existing viewing-progress state so watched/in-progress/next episode status is visible where reliable.
- Clearly distinguish known-but-unavailable episodes from episodes that are simply not known in metadata.
- Allow the UI to surface the preferred availability plus alternative variants when the resolver exists, without making the Series hierarchy source-specific.
- Keep the presentation usable for partial metadata and partially matched IPTV series.

## Acceptance Criteria

- [ ] One canonical Series page shows its known Seasons and Episodes rather than duplicate provider series structures.
- [ ] A Season can show `X/Y episodes available` when the total known episode count is reliable.
- [ ] An Episode can show availability from multiple configured sources without appearing multiple times in the episode list.
- [ ] Missing availability is visibly distinct from missing/unknown episode metadata.
- [ ] Existing watched/in-progress state is reflected in the episode hierarchy.
- [ ] Partial source coverage (for example Plex S1-S3 and IPTV S1-S5) is represented correctly.
- [ ] Language/quality variants do not duplicate Episode rows.
- [ ] Automated API/frontend tests cover full, partial, multi-source and unavailable episode cases.

## Excluded / Out of scope

- Video player implementation.
- Episode release notifications.
- Automatically downloading missing episodes.
- Rebuilding the metadata matching engine.

## Dependencies

Builds on #33 and benefits from #34/#35 for variant/preferred-availability presentation. Reuses the existing rich Series details and viewing-progress foundation.
