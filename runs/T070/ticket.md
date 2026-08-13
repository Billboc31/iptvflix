# T070 — Drive Movies and Series discovery shelves from the canonical catalog

**Source**: GitHub Issue #137

## Description

Parent: #131

Once the canonical catalog exists, Films/Séries discovery must no longer be limited to provider availability.

Build automatic shelves from canonical metadata: popular, trending/recent, upcoming, genres, language/country where useful, collections/franchises, critically/audience-rated signals, and other useful discovery groupings supported by persisted metadata.

Cards with zero sources must still render normally and open a detail page. Availability is a separate state/badge/action. Provide a clear way to distinguish/filter `All catalog` vs `Available now` without making availability define the catalog.

The hero and shelf candidates should be selected from clean canonical metadata, not raw Xtream names. Existing personalized/custom shelf work should consume the same canonical identities.

Acceptance criteria:
- Movies/Series pages remain rich with zero providers connected.
- Multiple automatic shelves are generated from local canonical metadata.
- Upcoming/unavailable titles can appear and be added to My List.
- Available titles expose playable variants without duplicate cards.
- Users can discover/filter content based on availability when desired.
- Hero/cards always use canonical titles/artwork/metadata.
- Shelf APIs are performant against the large local catalog.
