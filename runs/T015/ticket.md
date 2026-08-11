# T015 — Formalize the universal media domain and provider-independent product invariants

**Source**: GitHub Issue #32

## Description

## Objective

Update IPTVFlix's durable product/domain documentation to reflect the product pivot from an IPTV-first catalog to a universal personal media library where works exist independently from their availability on any source.

## Context / Problem

The current implementation already has a canonical catalog, external metadata, matching, rich details, search, watchlist and viewing history. The product direction is now broader: IPTV, Plex and future providers must be interchangeable availability sources around one universal catalog. Future agents need this invariant documented before extending the domain further.

## Included

- Update the durable product/architecture documentation under `docs/` to establish these core concepts:
  - **Media** = what the user may discover/watch, independent of source availability.
  - **Availability** = where/how a Media can currently be accessed.
  - **Shelf** = an ordered presentation/discovery grouping of Media.
  - **Source** = a provider adapter such as Xtream, M3U, Plex or future integrations.
- Document Movies and Series as canonical works; Series contain Seasons and Seasons contain Episodes as one coherent hierarchy.
- State explicitly that a Media may exist with zero availabilities.
- State explicitly that one Media may have multiple source/language/quality variants without becoming duplicate catalog cards.
- State explicitly that recommendation, watchlist, tracking and discovery operate on canonical Media identities, not provider items.
- Document the architectural rule that new source integrations must not force source-specific models into the canonical API/UI.
- Document the distinction between global release state (announced/upcoming/theatrical/digital/etc.) and `available to me` on configured sources.
- Reconcile these rules with the actual existing implementation and identify migration/evolution points rather than documenting an imaginary rewrite.

## Acceptance Criteria

- [ ] Durable docs define Media, Availability, Shelf and Source with their responsibilities and relationships.
- [ ] The Series → Season → Episode hierarchy is explicitly documented.
- [ ] A canonical Media is explicitly allowed to exist with zero source availabilities.
- [ ] Multiple source/language/quality variants are explicitly modeled as availabilities/variants of one canonical Media rather than duplicate works.
- [ ] The docs distinguish global release lifecycle from user-specific/source-specific availability.
- [ ] Plex is documented as an example future source using the same adapter boundary as IPTV rather than as a special catalog model.
- [ ] Existing code/schema constraints that need evolution are called out without prescribing an unnecessary full rewrite.
- [ ] Documentation remains concise enough to be reused as AI Dev Factory project memory.

## Excluded / Out of scope

- Schema migrations or runtime code changes.
- Plex implementation.
- Recommendation engine implementation.
- Shelf implementation.

## Dependencies

None. This is the architectural reference for the next product evolution and should be consumable by the other tickets in the batch.
